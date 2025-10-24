import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { stores, products, platforms, syncLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createConnector, isPlatformSupported } from '@/lib/connectors';
import { z } from 'zod';

const SyncProductsSchema = z.object({
  storeId: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
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
    const validatedData = SyncProductsSchema.parse(body);

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
      type: 'products',
      status: 'started',
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      startedAt: new Date(),
      details: {
        page: validatedData.page,
        limit: validatedData.limit,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        force: validatedData.force,
      },
    });

    // Start synchronization in background
    syncProducts({
      platform,
      store,
      options: validatedData,
      syncLogId,
      userId: session.user.id,
    }).catch((error) => {
      console.error('Product sync failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Product synchronization started',
      syncLogId,
    });

  } catch (error) {
    console.error('Products sync API error:', error);

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
async function syncProducts({
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
    const allProducts: any[] = [];

    // Fetch all products paginated
    while (hasMore) {
      const response = await connector.fetchProducts({
        page: currentPage,
        limit: options.limit,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
      });

      if (response.success && response.data) {
        allProducts.push(...response.data);
        hasMore = response.pagination?.hasNextPage;
        currentPage++;

        // Update progress
        recordsProcessed = allProducts.length;
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

    // Process each product
    for (const rawProduct of allProducts) {
      try {
        const normalizedProduct = await connector.normalizeProduct(rawProduct);

        // Check if product already exists
        const existingProduct = await db.select()
          .from(products)
          .where(and(
            eq(products.platformId, platform),
            eq(products.platformProductId, normalizedProduct.platformProductId)
          ))
          .limit(1);

        if (existingProduct.length > 0) {
          // Update existing product
          await db.update(products)
            .set({
              ...normalizedProduct,
              updatedAt: new Date(),
              lastSyncAt: new Date(),
            })
            .where(eq(products.id, existingProduct[0].id));

          recordsUpdated++;
        } else {
          // Insert new product
          await db.insert(products).values({
            ...normalizedProduct,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSyncAt: new Date(),
          });

          recordsCreated++;
        }
      } catch (error) {
        console.error(`Failed to process product ${rawProduct.id || rawProduct.item_id}:`, error);
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
    console.error('Product sync failed:', error);

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
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validate platform
    const platform = params.platform;
    if (!isPlatformSupported(platform)) {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Get products from database
    let query = db.select({
      id: products.id,
      platformProductId: products.platformProductId,
      sku: products.sku,
      title: products.title,
      price: products.price,
      currency: products.currency,
      stock: products.stock,
      status: products.status,
      isActive: products.isActive,
      lastSyncAt: products.lastSyncAt,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
      .from(products)
      .where(and(
        eq(products.platformId, platform),
        eq(products.isActive, true)
      ))
      .orderBy(desc(products.updatedAt))
      .limit(limit);

    // Filter by store if specified
    if (storeId) {
      query = query.where(eq(products.storeId, storeId));
    }

    const products_list = await query;

    return NextResponse.json({
      success: true,
      data: products_list,
      count: products_list.length,
    });

  } catch (error) {
    console.error('Get products API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}