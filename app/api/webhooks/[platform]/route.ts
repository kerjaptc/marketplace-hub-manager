import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { stores, webhookEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createConnector, isPlatformSupported } from '@/lib/connectors';
import crypto from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform;
  const startTime = Date.now();

  try {
    // Validate platform
    if (!isPlatformSupported(platform)) {
      console.error(`Webhook: Unsupported platform ${platform}`);
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Get the raw body for signature verification
    const body = await request.text();
    const headers = request.headers;

    // Get signature from headers (platform-specific)
    const signature = headers.get('x-signature') || headers.get('x-shopee-signature') || headers.get('signature');

    // Find the store that this webhook belongs to
    // This is a simplified approach - in production, you might want to use
    // store-specific webhook URLs or additional identifiers
    const stores_list = await db.select()
      .from(stores)
      .where(and(
        eq(stores.platformId, platform),
        eq(stores.isActive, true)
      ))
      .limit(10); // Get multiple stores to try

    if (stores_list.length === 0) {
      console.error(`Webhook: No active stores found for platform ${platform}`);
      return NextResponse.json(
        { error: 'No active stores found' },
        { status: 404 }
      );
    }

    let verifiedStore = null;

    // Try to verify the webhook signature with each store
    for (const store of stores_list) {
      if (await verifyWebhookSignature(platform, body, signature, store)) {
        verifiedStore = store;
        break;
      }
    }

    if (!verifiedStore) {
      console.error(`Webhook: Signature verification failed for platform ${platform}`);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error(`Webhook: Invalid JSON payload for platform ${platform}:`, error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Determine event type (platform-specific)
    const eventType = determineEventType(platform, payload, headers);

    // Store the webhook event
    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(webhookEvents).values({
      id: eventId,
      storeId: verifiedStore.id,
      platformId: platform,
      eventType,
      payload,
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Process the webhook asynchronously
    processWebhook(eventId, platform, payload, verifiedStore).catch((error) => {
      console.error(`Webhook processing failed for event ${eventId}:`, error);
    });

    // Return immediate response to acknowledge receipt
    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      eventId,
    });

  } catch (error) {
    console.error(`Webhook error for platform ${platform}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Verify webhook signature (platform-specific)
async function verifyWebhookSignature(
  platform: string,
  body: string,
  signature: string | null,
  store: any
): Promise<boolean> {
  if (!signature) {
    // Some platforms don't use signatures
    return true;
  }

  try {
    switch (platform) {
      case 'shopee':
        return verifyShopeeSignature(body, signature, store);
      case 'cults3d':
        return verifyCults3DSignature(body, signature, store);
      case 'tiktok-shop':
        return verifyTikTokSignature(body, signature, store);
      case 'tokopedia':
        return verifyTokopediaSignature(body, signature, store);
      default:
        // For custom platforms, implement your own verification logic
        return true;
    }
  } catch (error) {
    console.error(`Signature verification error for platform ${platform}:`, error);
    return false;
  }
}

function verifyShopeeSignature(body: string, signature: string, store: any): boolean {
  // Shopee webhook signature verification
  // This is a placeholder implementation
  // Refer to Shopee's webhook documentation for the actual signature verification logic
  try {
    const expectedSignature = crypto
      .createHmac('sha256', store.credentials.webhookSecret || '')
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Shopee signature verification error:', error);
    return false;
  }
}

function verifyCults3DSignature(body: string, signature: string, store: any): boolean {
  // Cults3D webhook signature verification
  // This is a placeholder implementation
  try {
    const expectedSignature = crypto
      .createHmac('sha256', store.credentials.webhookSecret || '')
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Cults3D signature verification error:', error);
    return false;
  }
}

function verifyTikTokSignature(body: string, signature: string, store: any): boolean {
  // TikTok Shop webhook signature verification
  // This is a placeholder implementation
  return true; // Placeholder
}

function verifyTokopediaSignature(body: string, signature: string, store: any): boolean {
  // Tokopedia webhook signature verification
  // This is a placeholder implementation
  return true; // Placeholder
}

// Determine event type from payload and headers
function determineEventType(platform: string, payload: any, headers: Headers): string {
  // Try to get event type from headers first
  const headerEventType = headers.get('x-event-type') || headers.get('event-type') || headers.get('event');
  if (headerEventType) {
    return `${platform}.${headerEventType}`;
  }

  // Determine from payload structure (platform-specific)
  switch (platform) {
    case 'shopee':
      if (payload.code === '0') {
        if (payload.data?.order_sn) {
          return 'shopee.order.updated';
        }
        if (payload.data?.item_id) {
          return 'shopee.product.updated';
        }
      }
      return 'shopee.unknown';

    case 'cults3d':
      if (payload.type) {
        return `cults3d.${payload.type}`;
      }
      if (payload.event) {
        return `cults3d.${payload.event}`;
      }
      return 'cults3d.unknown';

    case 'tiktok-shop':
      if (payload.event_type) {
        return `tiktok-shop.${payload.event_type}`;
      }
      return 'tiktok-shop.unknown';

    case 'tokopedia':
      if (payload.eventType) {
        return `tokopedia.${payload.eventType}`;
      }
      return 'tokopedia.unknown';

    default:
      return `${platform}.unknown`;
  }
}

// Process webhook asynchronously
async function processWebhook(
  eventId: string,
  platform: string,
  payload: any,
  store: any
) {
  try {
    console.log(`Processing webhook ${eventId} for platform ${platform}`);

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

    // Process based on event type
    const eventType = await db.select({ eventType: webhookEvents.eventType })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, eventId))
      .limit(1);

    if (eventType.length === 0) return;

    const eventTypeName = eventType[0].eventType;

    switch (eventTypeName) {
      case 'shopee.order.updated':
      case 'tiktok-shop.order.created':
      case 'tokopedia.order.created':
        await handleOrderUpdate(platform, payload, connector, store);
        break;

      case 'shopee.product.updated':
      case 'cults3d.product.updated':
        await handleProductUpdate(platform, payload, connector, store);
        break;

      default:
        console.log(`No handler for event type: ${eventTypeName}`);
    }

    // Mark webhook as processed
    await db.update(webhookEvents)
      .set({
        processed: true,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookEvents.id, eventId));

    console.log(`Webhook ${eventId} processed successfully`);

  } catch (error) {
    console.error(`Failed to process webhook ${eventId}:`, error);

    // Mark webhook as failed
    await db.update(webhookEvents)
      .set({
        processed: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: db.schema.webhookEvents.retryCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(webhookEvents.id, eventId));
  }
}

async function handleOrderUpdate(platform: string, payload: any, connector: any, store: any) {
  console.log(`Handling order update for platform ${platform}`);

  // Extract order data from payload (platform-specific)
  let orderData;
  switch (platform) {
    case 'shopee':
      orderData = payload.data;
      break;
    case 'tiktok-shop':
      orderData = payload.order_data;
      break;
    case 'tokopedia':
      orderData = payload.order_info;
      break;
    default:
      orderData = payload;
  }

  if (!orderData) {
    console.log('No order data found in webhook payload');
    return;
  }

  // Normalize and store the order
  try {
    const normalizedOrder = await connector.normalizeOrder(orderData);
    // Implementation for storing the order would go here
    console.log(`Order ${normalizedOrder.orderNumber} processed from webhook`);
  } catch (error) {
    console.error('Failed to normalize order from webhook:', error);
  }
}

async function handleProductUpdate(platform: string, payload: any, connector: any, store: any) {
  console.log(`Handling product update for platform ${platform}`);

  // Extract product data from payload (platform-specific)
  let productData;
  switch (platform) {
    case 'shopee':
      productData = payload.data;
      break;
    case 'cults3d':
      productData = payload.product;
      break;
    default:
      productData = payload;
  }

  if (!productData) {
    console.log('No product data found in webhook payload');
    return;
  }

  // Normalize and store the product
  try {
    const normalizedProduct = await connector.normalizeProduct(productData);
    // Implementation for storing the product would go here
    console.log(`Product ${normalizedProduct.title} processed from webhook`);
  } catch (error) {
    console.error('Failed to normalize product from webhook:', error);
  }
}