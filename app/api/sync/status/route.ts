import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { syncLogs, stores, platforms } from '@/db/schema';
import { eq, and, desc, like, or } from 'drizzle-orm';
import { z } from 'zod';

const StatusQuerySchema = z.object({
  storeId: z.string().optional(),
  platformId: z.string().optional(),
  type: z.enum(['products', 'orders', 'inventory', 'full']).optional(),
  status: z.enum(['started', 'running', 'completed', 'failed', 'cancelled']).optional(),
  limit: z.number().min(1).max(100).default(20),
  page: z.number().min(1).default(1),
});

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryData = Object.fromEntries(searchParams.entries());

    const validatedData = StatusQuerySchema.parse({
      ...queryData,
      limit: parseInt(queryData.limit || '20'),
      page: parseInt(queryData.page || '1'),
    });

    // Build the base query
    let baseQuery = db.select({
      id: syncLogs.id,
      storeId: syncLogs.storeId,
      platformId: syncLogs.platformId,
      type: syncLogs.type,
      status: syncLogs.status,
      recordsProcessed: syncLogs.recordsProcessed,
      recordsCreated: syncLogs.recordsCreated,
      recordsUpdated: syncLogs.recordsUpdated,
      recordsDeleted: syncLogs.recordsDeleted,
      recordsFailed: syncLogs.recordsFailed,
      details: syncLogs.details,
      errorMessage: syncLogs.errorMessage,
      startedAt: syncLogs.startedAt,
      completedAt: syncLogs.completedAt,
      duration: syncLogs.duration,
      triggeredBy: syncLogs.triggeredBy,
      triggeredByUserId: syncLogs.triggeredByUserId,
      createdAt: syncLogs.createdAt,
      updatedAt: syncLogs.updatedAt,
      storeName: stores.name,
      platformName: platforms.displayName,
    })
      .from(syncLogs)
      .innerJoin(stores, eq(syncLogs.storeId, stores.id))
      .innerJoin(platforms, eq(syncLogs.platformId, platforms.id))
      .where(eq(stores.userId, session.user.id));

    // Apply filters
    const conditions = [];

    if (validatedData.storeId) {
      conditions.push(eq(syncLogs.storeId, validatedData.storeId));
    }

    if (validatedData.platformId) {
      conditions.push(eq(syncLogs.platformId, validatedData.platformId));
    }

    if (validatedData.type) {
      conditions.push(eq(syncLogs.type, validatedData.type));
    }

    if (validatedData.status) {
      conditions.push(eq(syncLogs.status, validatedData.status));
    }

    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    // Get total count for pagination
    const countQuery = db.select({ count: syncLogs.id })
      .from(syncLogs)
      .innerJoin(stores, eq(syncLogs.storeId, stores.id))
      .where(eq(stores.userId, session.user.id));

    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const [totalResult] = await countQuery;
    const totalItems = totalResult ? Number(totalResult.count) : 0;

    // Apply pagination and ordering
    const offset = (validatedData.page - 1) * validatedData.limit;
    const logs = await baseQuery
      .orderBy(desc(syncLogs.startedAt))
      .limit(validatedData.limit)
      .offset(offset);

    // Calculate pagination info
    const totalPages = Math.ceil(totalItems / validatedData.limit);
    const hasNextPage = validatedData.page < totalPages;
    const hasPreviousPage = validatedData.page > 1;

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        currentPage: validatedData.page,
        totalPages,
        totalItems,
        itemsPerPage: validatedData.limit,
        hasNextPage,
        hasPreviousPage,
      },
    });

  } catch (error) {
    console.error('Sync status API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { syncLogId, action } = body;

    if (!syncLogId || !action) {
      return NextResponse.json(
        { error: 'syncLogId and action are required' },
        { status: 400 }
      );
    }

    if (action === 'cancel') {
      // Cancel a running sync
      const updatedLog = await db.update(syncLogs)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(syncLogs.id, syncLogId),
          or(
            eq(syncLogs.status, 'started'),
            eq(syncLogs.status, 'running')
          )
        ))
        .returning();

      if (updatedLog.length === 0) {
        return NextResponse.json(
          { error: 'Sync log not found or cannot be cancelled' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Sync cancelled successfully',
        data: updatedLog[0],
      });

    } else if (action === 'retry') {
      // Retry a failed sync
      const failedLog = await db.select()
        .from(syncLogs)
        .where(and(
          eq(syncLogs.id, syncLogId),
          eq(syncLogs.status, 'failed')
        ))
        .limit(1);

      if (failedLog.length === 0) {
        return NextResponse.json(
          { error: 'Failed sync log not found' },
          { status: 404 }
        );
      }

      // This would trigger a retry of the original sync operation
      // For now, we'll just mark it as started again
      await db.update(syncLogs)
        .set({
          status: 'started',
          errorMessage: null,
          errorStack: null,
          startedAt: new Date(),
          completedAt: null,
          duration: null,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsDeleted: 0,
          recordsFailed: 0,
          updatedAt: new Date(),
        })
        .where(eq(syncLogs.id, syncLogId));

      return NextResponse.json({
        success: true,
        message: 'Sync retry initiated',
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: cancel, retry' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Sync status action API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}