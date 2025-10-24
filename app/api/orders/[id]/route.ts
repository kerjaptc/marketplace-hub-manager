import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { orders, orderItems, stores, platforms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const orderId = params.id;

    // Get order details
    const orderResult = await db.select({
      id: orders.id,
      storeId: orders.storeId,
      platformId: orders.platformId,
      platformOrderId: orders.platformOrderId,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      customerPhone: orders.customerPhone,
      shippingAddress: orders.shippingAddress,
      billingAddress: orders.billingAddress,
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
      .where(and(
        eq(orders.id, orderId),
        eq(stores.userId, session.user.id)
      ))
      .limit(1);

    if (orderResult.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const order = orderResult[0];

    // Get order items
    const itemsResult = await db.select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      platformProductId: orderItems.platformProductId,
      productTitle: orderItems.productTitle,
      productSku: orderItems.productSku,
      productImage: orderItems.productImage,
      variantTitle: orderItems.variantTitle,
      variantId: orderItems.variantId,
      unitPrice: orderItems.unitPrice,
      comparePrice: orderItems.comparePrice,
      quantity: orderItems.quantity,
      total: orderItems.total,
      platformMetadata: orderItems.platformMetadata,
      createdAt: orderItems.createdAt,
      updatedAt: orderItems.updatedAt,
    })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(orderItems.createdAt);

    return NextResponse.json({
      order,
      items: itemsResult,
    });

  } catch (error) {
    console.error('Order detail API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}