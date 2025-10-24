import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { stores, orders, orderItems, platforms, syncLogs, products } from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { createConnector, isPlatformSupported } from '@/lib/connectors';
import { z } from 'zod';

const SyncOrdersSchema = z.object({
  storeId: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.string().optional(),
  force: z.boolean().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
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

    const platform = params.platform;

    // Validate platform
    if (!isPlatformSupported(platform)) {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validatedData = SyncOrdersSchema.parse(body);

    // Get store info
    let storeQuery = db.select().from(stores)
      .where(and(
        eq(stores.userId, session.user.id),
        eq(stores.platformId, platform),
        eq(stores.isActive, true)
      ));

    if (validatedData.storeId) {
      storeQuery = storeQuery.where(eq(stores.id, validatedData.storeId));
    }

    const stores_list = await storeQuery.limit(1);

    if (stores_list.length === 0) {
      return NextResponse.json(
        { error: 'No active store found for this platform' },
        { status: 404 }
      );
    }

    const store = stores_list[0];

    // Create sync log entry
    const syncLogId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(syncLogs).values({
      id: syncLogId,
      storeId: store.id,
      platformId: platform,
      type: 'orders',
      status: 'started',
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      startedAt: new Date(),
      details: {
        page: validatedData.page,
        limit: validatedData.limit,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        status: validatedData.status,
        force: validatedData.force,
      },
    });

    // Start synchronization in background
    syncOrders({
      platform,
      store,
      options: validatedData,
      syncLogId,
      userId: session.user.id,
    }).catch((error) => {
      console.error('Order sync failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Order synchronization started',
      syncLogId,
    });

  } catch (error) {
    console.error('Orders sync API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Background sync function
async function syncOrders({
  platform,
  store,
  options,
  syncLogId,
  userId,
}: {
  platform: string;
  store: any;
  options: any;
  syncLogId: string;
  userId: string;
}) {
  let recordsProcessed = 0;
  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;

  try {
    // Create connector instance
    const connector = createConnector(
      platform,
      {
        baseUrl: '',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: {
          requestsPerSecond: 10,
          requestsPerMinute: 600,
          burstLimit: 20,
        },
      },
      {
        ...store.credentials,
        storeId: store.id,
      }
    );

    // Authenticate
    await connector.authenticate();

    let currentPage = options.page;
    let hasMore = true;
    const allOrders: any[] = [];

    // Fetch all orders paginated
    while (hasMore) {
      const response = await connector.fetchOrders({
        page: currentPage,
        limit: options.limit,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
        status: options.status,
      });

      if (response.success && response.data) {
        allOrders.push(...response.data);
        hasMore = response.pagination?.hasNextPage;
        currentPage++;

        // Update progress
        recordsProcessed = allOrders.length;
        await db.update(syncLogs)
          .set({
            recordsProcessed,
            updatedAt: new Date(),
          })
          .where(eq(syncLogs.id, syncLogId));

        // Safety check to prevent infinite loops
        if (currentPage > 100) {
          hasMore = false;
        }
      } else {
        hasMore = false;
        recordsFailed += (response.data?.length || 0);
      }
    }

    // Process each order
    for (const rawOrder of allOrders) {
      try {
        const normalizedOrder = await connector.normalizeOrder(rawOrder);

        // Check if order already exists
        const existingOrder = await db.select()
          .from(orders)
          .where(and(
            eq(orders.platformId, platform),
            eq(orders.platformOrderId, normalizedOrder.platformOrderId)
          ))
          .limit(1);

        if (existingOrder.length > 0) {
          // Update existing order
          await db.update(orders)
            .set({
              ...normalizedOrder,
              updatedAt: new Date(),
              lastSyncAt: new Date(),
            })
            .where(eq(orders.id, existingOrder[0].id));

          recordsUpdated++;

          // Process order items
          await processOrderItems(existingOrder[0].id, normalizedOrder.items, platform);
        } else {
          // Insert new order
          const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await db.insert(orders).values({
            ...normalizedOrder,
            id: orderId,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSyncAt: new Date(),
          });

          recordsCreated++;

          // Process order items
          await processOrderItems(orderId, normalizedOrder.items, platform);
        }
      } catch (error) {
        console.error(`Failed to process order ${rawOrder.id || rawOrder.order_sn}:`, error);
        recordsFailed++;
      }
    }

    // Update store last sync time
    await db.update(stores)
      .set({
        lastSyncAt: new Date(),
        syncStatus: 'success',
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, store.id));

    // Mark sync log as completed
    const completedAt = new Date();
    const duration = Math.floor((completedAt.getTime() - new Date().getTime()) / 1000);

    await db.update(syncLogs)
      .set({
        status: 'completed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        completedAt,
        duration,
        updatedAt: completedAt,
      })
      .where(eq(syncLogs.id, syncLogId));

  } catch (error) {
    console.error('Order sync failed:', error);

    // Update store sync status
    await db.update(stores)
      .set({
        syncStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(stores.id, store.id));

    // Mark sync log as failed
    await db.update(syncLogs)
      .set({
        status: 'failed',
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        updatedAt: new Date(),
      })
      .where(eq(syncLogs.id, syncLogId));
  }
}

async function processOrderItems(orderId: string, items: any[], platform: string) {
  for (const item of items) {
    try {
      // Find corresponding product if it exists
      const existingProduct = await db.select()
        .from(products)
        .where(and(
          eq(products.platformId, platform),
          eq(products.platformProductId, item.platformProductId)
        ))
        .limit(1);

      const productId = existingProduct.length > 0 ? existingProduct[0].id : null;

      // Check if order item already exists
      const existingOrderItem = await db.select()
        .from(orderItems)
        .where(and(
          eq(orderItems.orderId, orderId),
          eq(orderItems.platformProductId, item.platformProductId)
        ))
        .limit(1);

      if (existingOrderItem.length > 0) {
        // Update existing order item
        await db.update(orderItems)
          .set({
            ...item,
            productId,
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, existingOrderItem[0].id));
      } else {
        // Insert new order item
        await db.insert(orderItems).values({
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          orderId,
          productId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`Failed to process order item ${item.platformProductId}:`, error);
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
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
    const storeId = searchParams.get('storeId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validate platform
    const platform = params.platform;
    if (!isPlatformSupported(platform)) {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Get orders from database
    let query = db.select({
      id: orders.id,
      platformOrderId: orders.platformOrderId,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      total: orders.total,
      currency: orders.currency,
      status: orders.status,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentStatus: orders.paymentStatus,
      orderDate: orders.orderDate,
      lastSyncAt: orders.lastSyncAt,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
      .from(orders)
      .where(eq(orders.platformId, platform))
      .orderBy(desc(orders.orderDate))
      .limit(limit);

    // Filter by store if specified
    if (storeId) {
      query = query.where(eq(orders.storeId, storeId));
    }

    // Filter by status if specified
    if (status) {
      query = query.where(eq(orders.status, status));
    }

    const orders_list = await query;

    return NextResponse.json({
      success: true,
      data: orders_list,
      count: orders_list.length,
    });

  } catch (error) {
    console.error('Get orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}