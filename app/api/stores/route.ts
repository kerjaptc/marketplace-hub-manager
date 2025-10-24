import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { stores, platforms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platformId = searchParams.get('platformId');

    // Build the base query
    let query = db.select({
      id: stores.id,
      name: stores.name,
      platformId: stores.platformId,
      platformName: platforms.displayName,
      isActive: stores.isActive,
      syncStatus: stores.syncStatus,
      lastSyncAt: stores.lastSyncAt,
    })
      .from(stores)
      .innerJoin(platforms, eq(stores.platformId, platforms.id))
      .where(and(
        eq(stores.userId, session.user.id),
        eq(stores.isActive, true)
      ));

    // Filter by platform if specified
    if (platformId) {
      query = query.where(eq(stores.platformId, platformId));
    }

    const stores_list = await query.orderBy(stores.name);

    return NextResponse.json(stores_list);

  } catch (error) {
    console.error('Stores API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}