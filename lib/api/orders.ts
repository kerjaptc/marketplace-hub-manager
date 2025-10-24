import { z } from 'zod';

// Order types for API responses
export const OrderSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  platformId: z.string(),
  platformOrderId: z.string(),
  orderNumber: z.string(),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  shippingAddress: z.any(),
  billingAddress: z.any().nullable(),
  subtotal: z.string(),
  tax: z.string(),
  shipping: z.string(),
  discount: z.string(),
  total: z.string(),
  currency: z.string(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  fulfillmentStatus: z.enum(['unfulfilled', 'partial', 'fulfilled']),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']),
  platformMetadata: z.any(),
  orderDate: z.string(),
  shippedDate: z.string().nullable(),
  deliveredDate: z.string().nullable(),
  cancelledDate: z.string().nullable(),
  notes: z.string().nullable(),
  customerNotes: z.string().nullable(),
  trackingNumbers: z.array(z.string()),
  lastSyncAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string().nullable(),
  platformProductId: z.string(),
  productTitle: z.string(),
  productSku: z.string().nullable(),
  productImage: z.string().nullable(),
  variantTitle: z.string().nullable(),
  variantId: z.string().nullable(),
  unitPrice: z.string(),
  comparePrice: z.string().nullable(),
  quantity: z.number(),
  total: z.string(),
  platformMetadata: z.any(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OrderListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(OrderSchema),
  pagination: z.object({
    currentPage: z.number(),
    totalPages: z.number(),
    totalItems: z.number(),
    itemsPerPage: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export const OrderDetailSchema = z.object({
  order: OrderSchema,
  items: z.array(OrderItemSchema),
});

export const OrdersQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
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

export const SyncOrdersRequestSchema = z.object({
  storeId: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.string().optional(),
  force: z.boolean().default(false),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  fulfillmentStatus: z.enum(['unfulfilled', 'partial', 'fulfilled']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  trackingNumbers: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
export type OrderDetail = z.infer<typeof OrderDetailSchema>;
export type OrdersQuery = z.infer<typeof OrdersQuerySchema>;
export type SyncOrdersRequest = z.infer<typeof SyncOrdersRequestSchema>;
export type UpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>;

// API functions
export class OrdersAPI {
  private static baseUrl = '/api/sync';

  static async getOrders(query: OrdersQuery): Promise<OrderListResponse> {
    const params = new URLSearchParams({
      page: query.page.toString(),
      limit: query.limit.toString(),
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    if (query.search) params.append('search', query.search);
    if (query.platformId) params.append('platformId', query.platformId);
    if (query.storeId) params.append('storeId', query.storeId);
    if (query.status) params.append('status', query.status);
    if (query.fulfillmentStatus) params.append('fulfillmentStatus', query.fulfillmentStatus);
    if (query.paymentStatus) params.append('paymentStatus', query.paymentStatus);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);

    const response = await fetch(`/api/orders?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    return response.json();
  }

  static async getOrder(orderId: string): Promise<OrderDetail> {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch order: ${response.statusText}`);
    }

    return response.json();
  }

  static async updateOrderStatus(orderId: string, data: UpdateOrderStatus): Promise<Order> {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update order: ${response.statusText}`);
    }

    return response.json();
  }

  static async syncOrders(platform: string, data: SyncOrdersRequest): Promise<{
    success: boolean;
    message: string;
    syncLogId: string;
  }> {
    const response = await fetch(`/api/sync/${platform}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync orders: ${response.statusText}`);
    }

    return response.json();
  }

  static async exportOrders(query: OrdersQuery): Promise<Blob> {
    const params = new URLSearchParams({
      format: 'csv',
      ...query,
    });

    const response = await fetch(`/api/orders/export?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to export orders: ${response.statusText}`);
    }

    return response.blob();
  }

  static async getOrderStats(): Promise<{
    totalOrders: number;
    pendingOrders: number;
    processingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalRevenue: string;
    thisMonthRevenue: string;
  }> {
    const response = await fetch('/api/orders/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch order stats: ${response.statusText}`);
    }

    return response.json();
  }

  static async getPlatforms(): Promise<Array<{
    id: string;
    name: string;
    displayName: string;
    type: string;
    isActive: boolean;
  }>> {
    const response = await fetch('/api/platforms', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch platforms: ${response.statusText}`);
    }

    return response.json();
  }
}