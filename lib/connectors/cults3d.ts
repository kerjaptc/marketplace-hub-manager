import { BaseConnector, UnifiedProduct, UnifiedOrder, UnifiedOrderItem, PaginatedApiResponse, ConnectorError } from './base';

// Cults3D API response types
interface Cults3DProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  currency: string;
  free: boolean;
  likes: number;
  downloads: number;
  views: number;
  designer: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  images: Array<{
    url: string;
    type: 'main' | 'preview' | 'gallery';
    order: number;
  }>;
  files: Array<{
    id: string;
    name: string;
    size: number;
    format: string;
    url: string;
    downloadUrl: string;
  }>;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  printSettings: {
    technology: string[];
    material: string[];
    support: boolean;
    resolution: number;
    infill: number;
  };
  dimensions: {
    width: number;
    height: number;
    depth: number;
    unit: string;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  status: 'published' | 'draft' | 'private';
  license: {
    type: string;
    commercial: boolean;
    attribution: boolean;
  };
  complexity: 'easy' | 'medium' | 'hard';
  printTime: number;
  supportsCount: number;
  brimsCount: number;
  raftsCount: number;
}

interface Cults3DOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
  total: number;
  currency: string;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  customer: {
    id: string;
    name: string;
    email: string;
    username?: string;
  };
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
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      slug: string;
      designer: {
        id: string;
        name: string;
      };
    };
    price: number;
    quantity: number;
    total: number;
    type: 'file' | 'print';
    files?: Array<{
      id: string;
      name: string;
      format: string;
      size: number;
    }>;
  }>;
  paymentMethod: string;
  paymentTime?: string;
  shippingMethod?: string;
  shippingTime?: string;
  trackingNumbers: string[];
  notes?: string;
  customerNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export class Cults3DConnector extends BaseConnector {
  private apiKey?: string;

  constructor(config: any, credentials: any) {
    super({
      baseUrl: 'https://cults3d.com/api/v1',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerSecond: 3,
        requestsPerMinute: 180,
        burstLimit: 8,
      },
    }, credentials);

    this.apiKey = credentials.apiKey;
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test API key by making a simple request
      const response = await this.makeRequest<{ success: boolean; user: any }>(
        `${this.config.baseUrl}/auth/verify`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (response.success) {
        return true;
      }

      throw new Error('API key validation failed');
    } catch (error) {
      throw new ConnectorError(
        'Cults3D authentication failed',
        'AUTH_ERROR',
        'cults3d',
        error as Error
      );
    }
  }

  async fetchProducts(options: any = {}): Promise<PaginatedApiResponse<any>> {
    try {
      await this.ensureAuthenticated();

      const { page = 1, limit = 50, categoryId, tagId, designerId } = options;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (categoryId) params.append('category', categoryId);
      if (tagId) params.append('tag', tagId);
      if (designerId) params.append('designer', designerId);

      const response = await this.makeRequestWithRetry<{
        success: boolean;
        data: Cults3DProduct[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          itemsPerPage: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      }>(`${this.config.baseUrl}/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return {
        success: true,
        data: response.data,
        pagination: response.pagination,
      };
    } catch (error) {
      throw new ConnectorError(
        'Failed to fetch Cults3D products',
        'FETCH_PRODUCTS_ERROR',
        'cults3d',
        error as Error
      );
    }
  }

  async fetchOrders(options: any = {}): Promise<PaginatedApiResponse<any>> {
    try {
      await this.ensureAuthenticated();

      const { page = 1, limit = 50, startDate, endDate, status } = options;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (startDate) params.append('start_date', startDate.toISOString());
      if (endDate) params.append('end_date', endDate.toISOString());
      if (status) params.append('status', status);

      const response = await this.makeRequestWithRetry<{
        success: boolean;
        data: Cults3DOrder[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          itemsPerPage: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      }>(`${this.config.baseUrl}/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return {
        success: true,
        data: response.data,
        pagination: response.pagination,
      };
    } catch (error) {
      throw new ConnectorError(
        'Failed to fetch Cults3D orders',
        'FETCH_ORDERS_ERROR',
        'cults3d',
        error as Error
      );
    }
  }

  async normalizeProduct(rawProduct: Cults3DProduct): Promise<UnifiedProduct> {
    const images = rawProduct.images
      .sort((a, b) => a.order - b.order)
      .map(img => ({
        url: img.url,
        alt: rawProduct.name,
        order: img.order,
      }));

    const categories = rawProduct.categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
    }));

    const tags = rawProduct.tags.map(tag => tag.name);

    // Create variants based on available files/formats
    const variants = rawProduct.files.map(file => ({
      id: file.id,
      title: `${rawProduct.name} - ${file.format.toUpperCase()}`,
      sku: `${rawProduct.slug}-${file.format}`,
      price: rawProduct.free ? 0 : rawProduct.price,
      attributes: {
        format: file.format,
        size: file.size,
        downloadUrl: file.downloadUrl,
      },
    }));

    return {
      id: this.generateId(),
      storeId: this.credentials.storeId || this.generateId(),
      platformId: 'cults3d',
      platformProductId: rawProduct.id,
      sku: rawProduct.slug,
      title: rawProduct.name,
      description: this.sanitizeHtml(rawProduct.description),
      shortDescription: rawProduct.shortDescription || this.sanitizeHtml(rawProduct.description).substring(0, 200),
      price: rawProduct.free ? 0 : this.parseCurrency(rawProduct.price),
      currency: rawProduct.currency || 'EUR', // Cults3D default currency
      stock: -1, // Digital products have unlimited stock
      trackInventory: false,
      dimensions: {
        width: rawProduct.dimensions.width,
        height: rawProduct.dimensions.height,
        depth: rawProduct.dimensions.depth,
        unit: rawProduct.dimensions.unit,
      },
      images,
      categories,
      tags,
      status: this.mapProductStatus(rawProduct.status),
      isActive: rawProduct.status === 'published',
      isVisible: rawProduct.status === 'published',
      platformMetadata: {
        free: rawProduct.free,
        likes: rawProduct.likes,
        downloads: rawProduct.downloads,
        views: rawProduct.views,
        designer: rawProduct.designer,
        printSettings: rawProduct.printSettings,
        license: rawProduct.license,
        complexity: rawProduct.complexity,
        printTime: rawProduct.printTime,
        supportsCount: rawProduct.supportsCount,
        brimsCount: rawProduct.brimsCount,
        raftsCount: rawProduct.raftsCount,
        publishedAt: rawProduct.publishedAt,
        files: rawProduct.files,
        slug: rawProduct.slug,
      },
      seo: {
        title: rawProduct.name,
        description: rawProduct.shortDescription || this.sanitizeHtml(rawProduct.description).substring(0, 160),
        keywords: tags,
      },
      variants: variants.length > 1 ? variants : undefined,
      attributes: {
        designer: rawProduct.designer.name,
        complexity: rawProduct.complexity,
        printTime: rawProduct.printTime,
        technology: rawProduct.printSettings.technology.join(', '),
        material: rawProduct.printSettings.material.join(', '),
        support: rawProduct.printSettings.support,
        resolution: rawProduct.printSettings.resolution,
        infill: rawProduct.printSettings.infill,
        license: rawProduct.license.type,
        commercial: rawProduct.license.commercial,
      },
      lastSyncAt: new Date(),
      createdAt: this.parseDate(rawProduct.createdAt),
      updatedAt: this.parseDate(rawProduct.updatedAt),
    };
  }

  async normalizeOrder(rawOrder: Cults3DOrder): Promise<UnifiedOrder> {
    const items = await Promise.all(
      rawOrder.items.map(item => this.normalizeOrderItem(item, rawOrder.id))
    );

    return {
      id: this.generateId(),
      storeId: this.credentials.storeId || this.generateId(),
      platformId: 'cults3d',
      platformOrderId: rawOrder.id,
      orderNumber: rawOrder.orderNumber,
      customerName: rawOrder.customer.name,
      customerEmail: rawOrder.customer.email,
      shippingAddress: rawOrder.shippingAddress,
      billingAddress: rawOrder.billingAddress,
      subtotal: this.parseCurrency(rawOrder.subtotal),
      tax: this.parseCurrency(rawOrder.tax),
      shipping: this.parseCurrency(rawOrder.shipping),
      discount: this.parseCurrency(rawOrder.discount),
      total: this.parseCurrency(rawOrder.total),
      currency: rawOrder.currency,
      status: this.mapOrderStatus(rawOrder.status),
      fulfillmentStatus: rawOrder.fulfillmentStatus as any,
      paymentStatus: rawOrder.paymentStatus as any,
      platformMetadata: {
        paymentMethod: rawOrder.paymentMethod,
        shippingMethod: rawOrder.shippingMethod,
        customerUsername: rawOrder.customer.username,
        designer: rawOrder.items.map(item => item.product.designer),
      },
      orderDate: this.parseDate(rawOrder.createdAt),
      shippedDate: rawOrder.shippingTime ? this.parseDate(rawOrder.shippingTime) : undefined,
      notes: rawOrder.notes,
      customerNotes: rawOrder.customerNotes,
      trackingNumbers: rawOrder.trackingNumbers,
      items,
      lastSyncAt: new Date(),
      createdAt: this.parseDate(rawOrder.createdAt),
      updatedAt: this.parseDate(rawOrder.updatedAt),
    };
  }

  private async normalizeOrderItem(item: any, orderId: string): Promise<UnifiedOrderItem> {
    return {
      id: this.generateId(),
      orderId: this.generateId(),
      platformProductId: item.product.id,
      productTitle: item.product.name,
      variantTitle: item.type === 'print' ? 'Physical Print' : 'Digital File',
      unitPrice: this.parseCurrency(item.price),
      quantity: item.quantity,
      total: this.parseCurrency(item.total),
      platformMetadata: {
        type: item.type,
        designer: item.product.designer,
        files: item.files,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.apiKey) {
      throw new ConnectorError(
        'No API key provided',
        'NO_API_KEY',
        'cults3d'
      );
    }
  }

  private mapProductStatus(status: string): UnifiedProduct['status'] {
    switch (status) {
      case 'published':
        return 'active';
      case 'draft':
        return 'draft';
      case 'private':
        return 'inactive';
      default:
        return 'inactive';
    }
  }

  private mapOrderStatus(status: string): UnifiedOrder['status'] {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'delivered';
      case 'cancelled':
        return 'cancelled';
      case 'refunded':
        return 'refunded';
      default:
        return 'pending';
    }
  }
}