import { z } from "zod";

// Base response schemas for consistent API responses
export const BaseApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export const PaginatedResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.array(z.any()),
  pagination: z.object({
    currentPage: z.number(),
    totalPages: z.number(),
    totalItems: z.number(),
    itemsPerPage: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
  error: z.string().optional(),
});

// Common types
export interface BaseApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedApiResponse<T = any> extends BaseApiResponse<T[]> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  burstLimit: number;
}

export interface ConnectorConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: RateLimitConfig;
}

export interface SyncProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  current?: string;
}

export interface SyncOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  onProgress?: (progress: SyncProgress) => void;
}

// Platform-agnostic product interface
export interface UnifiedProduct {
  id: string;
  storeId: string;
  platformId: string;
  platformProductId: string;
  sku?: string;
  title: string;
  description?: string;
  shortDescription?: string;
  price: number;
  comparePrice?: number;
  cost?: number;
  currency: string;
  stock: number;
  trackInventory: boolean;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  images: Array<{
    url: string;
    alt?: string;
    order?: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    level?: number;
  }>;
  tags?: string[];
  status: 'active' | 'inactive' | 'draft' | 'archived';
  isActive: boolean;
  isVisible: boolean;
  platformMetadata: Record<string, any>;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  variants?: Array<{
    id: string;
    title?: string;
    sku?: string;
    price?: number;
    comparePrice?: number;
    stock?: number;
    weight?: number;
    attributes: Record<string, any>;
  }>;
  attributes: Record<string, any>;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Platform-agnostic order interface
export interface UnifiedOrder {
  id: string;
  storeId: string;
  platformId: string;
  platformOrderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: {
    name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  billingAddress?: {
    name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  platformMetadata: Record<string, any>;
  orderDate: Date;
  shippedDate?: Date;
  deliveredDate?: Date;
  cancelledDate?: Date;
  notes?: string;
  customerNotes?: string;
  trackingNumbers: string[];
  items: UnifiedOrderItem[];
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnifiedOrderItem {
  id: string;
  orderId: string;
  productId?: string;
  platformProductId: string;
  productTitle: string;
  productSku?: string;
  productImage?: string;
  variantTitle?: string;
  variantId?: string;
  unitPrice: number;
  comparePrice?: number;
  quantity: number;
  total: number;
  platformMetadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Base connector class
export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected credentials: Record<string, any>;
  protected rateLimitTracker: {
    requests: number[];
    lastReset: number;
  };

  constructor(config: ConnectorConfig, credentials: Record<string, any>) {
    this.config = config;
    this.credentials = credentials;
    this.rateLimitTracker = {
      requests: [],
      lastReset: Date.now(),
    };
  }

  // Abstract methods that must be implemented by each platform connector
  abstract authenticate(): Promise<boolean>;
  abstract fetchProducts(options?: SyncOptions): Promise<PaginatedApiResponse<any>>;
  abstract fetchOrders(options?: SyncOptions): Promise<PaginatedApiResponse<any>>;
  abstract normalizeProduct(rawProduct: any): Promise<UnifiedProduct>;
  abstract normalizeOrder(rawOrder: any): Promise<UnifiedOrder>;

  // Common utility methods
  protected async makeRequest<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.checkRateLimit();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MarketplaceHubManager/1.0',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  protected async makeRequestWithRetry<T = any>(
    url: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<T> {
    try {
      return await this.makeRequest<T>(url, options);
    } catch (error) {
      if (attempt <= this.config.retryAttempts) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        return this.makeRequestWithRetry<T>(url, options, attempt + 1);
      }
      throw error;
    }
  }

  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneSecondAgo = now - 1000;

    // Clean old requests
    this.rateLimitTracker.requests = this.rateLimitTracker.requests.filter(
      timestamp => timestamp > oneMinuteAgo
    );

    // Check per-second limit
    const requestsLastSecond = this.rateLimitTracker.requests.filter(
      timestamp => timestamp > oneSecondAgo
    ).length;

    if (requestsLastSecond >= this.config.rateLimit.requestsPerSecond) {
      const sleepTime = 1000 - (now - Math.max(...this.rateLimitTracker.requests));
      await this.sleep(sleepTime);
    }

    // Check per-minute limit
    if (this.rateLimitTracker.requests.length >= this.config.rateLimit.requestsPerMinute) {
      const sleepTime = 60000 - (now - Math.min(...this.rateLimitTracker.requests));
      await this.sleep(sleepTime);
    }

    // Track this request
    this.rateLimitTracker.requests.push(now);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected parseCurrency(amount: string | number, currency: string = 'USD'): number {
    if (typeof amount === 'number') return amount;
    return parseFloat(amount.replace(/[^0-9.-]/g, '')) || 0;
  }

  protected parseDate(date: string | Date): Date {
    if (date instanceof Date) return date;
    return new Date(date);
  }

  protected sanitizeHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  protected extractImageUrl(images: any[]): string[] {
    if (!Array.isArray(images)) return [];
    return images
      .map(img => img.url || img.src || img)
      .filter(url => url && typeof url === 'string');
  }
}

// Common error class
export class ConnectorError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

// Export type utilities
export type ApiClient = BaseConnector;
export type { ConnectorConfig, RateLimitConfig, SyncOptions, SyncProgress };