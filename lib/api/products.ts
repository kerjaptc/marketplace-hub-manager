import { z } from 'zod';

// Product types for API responses
export const ProductSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  platformId: z.string(),
  platformProductId: z.string(),
  sku: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  price: z.string(),
  comparePrice: z.string().nullable(),
  cost: z.string().nullable(),
  currency: z.string(),
  stock: z.number(),
  trackInventory: z.boolean(),
  weight: z.string().nullable(),
  dimensions: z.any().nullable(),
  images: z.array(z.any()),
  categories: z.array(z.any()),
  tags: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'draft', 'archived']),
  isActive: z.boolean(),
  isVisible: z.boolean(),
  platformMetadata: z.any(),
  seo: z.any().nullable(),
  variants: z.array(z.any()).nullable(),
  attributes: z.any(),
  lastSyncAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProductListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(ProductSchema),
  pagination: z.object({
    currentPage: z.number(),
    totalPages: z.number(),
    totalItems: z.number(),
    itemsPerPage: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export const SyncProductsRequestSchema = z.object({
  storeId: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  force: z.boolean().default(false),
});

export const ProductsQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  platformId: z.string().optional(),
  storeId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'draft', 'archived']).optional(),
  sortBy: z.enum(['title', 'price', 'stock', 'createdAt', 'updatedAt', 'lastSyncAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
export type SyncProductsRequest = z.infer<typeof SyncProductsRequestSchema>;
export type ProductsQuery = z.infer<typeof ProductsQuerySchema>;

// API functions
export class ProductsAPI {
  private static baseUrl = '/api/sync';

  static async getProducts(query: ProductsQuery): Promise<ProductListResponse> {
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

    const response = await fetch(`/api/products?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    return response.json();
  }

  static async syncProducts(platform: string, data: SyncProductsRequest): Promise<{
    success: boolean;
    message: string;
    syncLogId: string;
  }> {
    const response = await fetch(`/api/sync/${platform}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync products: ${response.statusText}`);
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

  static async getStores(platformId?: string): Promise<Array<{
    id: string;
    name: string;
    platformId: string;
    platformName: string;
    isActive: boolean;
    syncStatus: string;
    lastSyncAt: string | null;
  }>> {
    const params = platformId ? `?platformId=${platformId}` : '';
    const response = await fetch(`/api/stores${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stores: ${response.statusText}`);
    }

    return response.json();
  }
}