import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { orders, stores, platforms } from '@/db/schema';
import { eq, and, desc, asc, ilike, or, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

const OrdersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  platformId: z.string().optional(),
  storeId: z.string().optional(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  fulfillmentStatus: z.enum(['unfulfilled', 'partial', 'fulfilled']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['orderDate', 'total', 'customerName', 'status', 'lastSyncAt']).default('orderDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
    const validatedData = OrdersQuerySchema.parse(queryData);

    // Build the base query
    let query = db.select({
      id: orders.id,
      storeId: orders.storeId,
      platformId: orders.platformId,
      platformOrderId: orders.platformOrderId,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      customerPhone: orders.customerPhone,
      subtotal: orders.subtotal,
      tax: orders.tax,
      shipping: orders.shipping,
      discount: orders.discount,
      total: orders.total,
      currency: orders.currency,
      status: orders.status,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentStatus: orders.paymentStatus,
      platformMetadata: orders.platformMetadata,
      orderDate: orders.orderDate,
      shippedDate: orders.shippedDate,
      deliveredDate: orders.deliveredDate,
      cancelledDate: orders.cancelledDate,
      notes: orders.notes,
      customerNotes: orders.customerNotes,
      trackingNumbers: orders.trackingNumbers,
      lastSyncAt: orders.lastSyncAt,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      storeName: stores.name,
      platformName: platforms.displayName,
    })
      .from(orders)
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .innerJoin(platforms, eq(orders.platformId, platforms.id))
      .where(eq(stores.userId, session.user.id));

    // Apply filters
    const conditions = [];

    if (validatedData.search) {
      const searchTerm = `%${validatedData.search}%`;
      conditions.push(
        or(
          ilike(orders.orderNumber, searchTerm),
          ilike(orders.customerName, searchTerm),
          ilike(orders.customerEmail, searchTerm),
          ilike(orders.customerPhone, searchTerm)
        )
      );
    }

    if (validatedData.platformId) {
      conditions.push(eq(orders.platformId, validatedData.platformId));
    }

    if (validatedData.storeId) {
      conditions.push(eq(orders.storeId, validatedData.storeId));
    }

    if (validatedData.status) {
      conditions.push(eq(orders.status, validatedData.status));
    }

    if (validatedData.fulfillmentStatus) {
      conditions.push(eq(orders.fulfillmentStatus, validatedData.fulfillmentStatus));
    }

    if (validatedData.paymentStatus) {
      conditions.push(eq(orders.paymentStatus, validatedData.paymentStatus));
    }

    if (validatedData.startDate) {
      conditions.push(gte(orders.orderDate, new Date(validatedData.startDate)));
    }

    if (validatedData.endDate) {
      conditions.push(lte(orders.orderDate, new Date(validatedData.endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Get total count for pagination
    const countQuery = db.select({ count: orders.id })
      .from(orders)
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .where(eq(stores.userId, session.user.id));

    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const [totalResult] = await countQuery;
    const totalItems = totalResult ? Number(totalResult.count) : 0;

    // Apply sorting
    const sortColumn = {
      orderDate: orders.orderDate,
      total: orders.total,
      customerName: orders.customerName,
      status: orders.status,
      lastSyncAt: orders.lastSyncAt,
    }[validatedData.sortBy];

    if (sortColumn) {
      query = query.orderBy(
        validatedData.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)
      );
    }

    // Apply pagination
    const offset = (validatedData.page - 1) * validatedData.limit;
    const orders_list = await query
      .limit(validatedData.limit)
      .offset(offset);

    // Calculate pagination info
    const totalPages = Math.ceil(totalItems / validatedData.limit);
    const hasNextPage = validatedData.page < totalPages;
    const hasPreviousPage = validatedData.page > 1;

    return NextResponse.json({
      success: true,
      data: orders_list,
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
    console.error('Orders API error:', error);

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