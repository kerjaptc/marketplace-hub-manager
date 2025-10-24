import { BaseConnector, UnifiedProduct, UnifiedOrder, UnifiedOrderItem, PaginatedApiResponse, ConnectorError } from './base';

// Shopee API response types
interface ShopeeAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface ShopeeProduct {
  item_id: number;
  shopid: number;
  item_name: string;
  description: string;
  original_price: number;
  current_price: number;
  stock: number;
  item_status: 'NORMAL' | 'DELETED' | 'BANNED';
  has_discount: boolean;
  discount: string;
  images: Array<{
    url: string;
    url_large: string;
  }>;
  variations: Array<{
    name: string;
    options: Array<{
      name: string;
      price_adjustment: number;
      stock: number;
    }>;
  }>;
  categories: Array<{
    cat_id: number;
    cat_name: string;
  }>;
  attributes: Array<{
    attribute_id: number;
    attribute_name: string;
    attribute_value: string;
  }>;
  weight: number;
  create_time: number;
  update_time: number;
  days_to_ship: number;
  condition: 'NEW' | 'USED';
  preorder: boolean;
  preorder_period: number;
  size_chart: string;
  item_sku: string;
  sales: number;
  liked_count: number;
  rating_star: number;
  comment_count: number;
}

interface ShopeeOrder {
  order_sn: string;
  order_status: 'UNPAID' | 'READY_TO_SHIP' | 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS' | 'TO_CONFIRM_RECEIVE';
  message_type: number;
  order_flag: string;
  shipping_carrier: string;
  tracking_no: string;
  payment_method: string;
  payment_time: number;
  shipping_time: number;
  create_time: number;
  update_time: number;
  currency: string;
  amount: number;
  buyer_username: string;
  recipient_address: {
    name: string;
    phone: string;
    full_address: string;
    town: string;
    district: string;
    state: string;
    region: string;
    zipcode: string;
  };
  item_list: Array<{
    item_id: number;
    item_name: string;
    item_sku: string;
    model_name: string;
    model_quantity_purchased: number;
    model_original_price: number;
    model_discounted_price: number;
    item_weight: number;
    is_main_item: boolean;
    add_on_deal_id: number;
    add_on_deal_name: string;
    wholesale_id: number;
    group_buy_id: number;
    is_add_on_sub_item: boolean;
  }>;
  total_amount: number;
  actual_shipping_fee: number;
  buyer_canceled_amount: number;
  seller_canceled_amount: number;
  refund_amount: number;
  buyer_paid_amount: number;
  seller_income: number;
  order_chargeable_weight_gram: number;
  estimated_shipping_fee: number;
  goods_to_declare: boolean;
  note: string;
  cancel_by: string;
  cancel_reason: string;
  pay_time: number;
  package_list: Array<{
    package_number: string;
    tracking_no: string;
    order_sn: string;
    package_code: string;
    shipping_carrier: string;
    package_status: string;
    create_time: number;
    tracking_url: string;
  }>;
}

export class ShopeeConnector extends BaseConnector {
  private accessToken?: string;
  private shopId?: string;

  constructor(config: any, credentials: any) {
    super({
      baseUrl: 'https://partner.shopeemobile.com/api/v1',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerSecond: 10,
        requestsPerMinute: 600,
        burstLimit: 20,
      },
    }, credentials);

    this.shopId = credentials.shopId;
  }

  async authenticate(): Promise<boolean> {
    try {
      // Shopee authentication flow
      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v1/auth/token/get';
      const signature = this.generateSignature(
        this.credentials.apiSecret,
        this.credentials.apiKey,
        timestamp,
        path,
        {}
      );

      const response = await this.makeRequest<ShopeeAuthResponse>(
        `${this.config.baseUrl}${path}?partner_id=${this.credentials.apiKey}&timestamp=${timestamp}&sign=${signature}`
      );

      if (response.access_token) {
        this.accessToken = response.access_token;
        return true;
      }

      throw new Error('Authentication failed: No access token received');
    } catch (error) {
      throw new ConnectorError(
        'Shopee authentication failed',
        'AUTH_ERROR',
        'shopee',
        error as Error
      );
    }
  }

  async fetchProducts(options: any = {}): Promise<PaginatedApiResponse<any>> {
    try {
      await this.ensureAuthenticated();

      const { page = 1, pageSize = 100 } = options;
      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v1/item/items/get';

      const params = {
        page_size: pageSize,
        pagination_offset: page - 1,
        shopid: this.shopId!,
        // Add filters as needed
      };

      const signature = this.generateSignature(
        this.credentials.apiSecret,
        this.credentials.apiKey,
        timestamp,
        path,
        params
      );

      const queryString = new URLSearchParams({
        ...params,
        partner_id: this.credentials.apiKey,
        timestamp: timestamp.toString(),
        sign: signature,
        access_token: this.accessToken!,
      }).toString();

      const response = await this.makeRequestWithRetry<{
        response: {
          items: ShopeeProduct[];
          total: number;
          more: boolean;
        };
      }>(`${this.config.baseUrl}${path}?${queryString}`);

      return {
        success: true,
        data: response.response.items,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(response.response.total / pageSize),
          totalItems: response.response.total,
          itemsPerPage: pageSize,
          hasNextPage: response.response.more,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      throw new ConnectorError(
        'Failed to fetch Shopee products',
        'FETCH_PRODUCTS_ERROR',
        'shopee',
        error as Error
      );
    }
  }

  async fetchOrders(options: any = {}): Promise<PaginatedApiResponse<any>> {
    try {
      await this.ensureAuthenticated();

      const { page = 1, pageSize = 100, startDate, endDate } = options;
      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/api/v1/order/orders/get';

      const params: any = {
        page_size: pageSize,
        pagination_offset: page - 1,
        shopid: this.shopId!,
      };

      // Add date filters if provided
      if (startDate) {
        params.create_time_from = Math.floor(startDate.getTime() / 1000);
      }
      if (endDate) {
        params.create_time_to = Math.floor(endDate.getTime() / 1000);
      }

      const signature = this.generateSignature(
        this.credentials.apiSecret,
        this.credentials.apiKey,
        timestamp,
        path,
        params
      );

      const queryString = new URLSearchParams({
        ...params,
        partner_id: this.credentials.apiKey,
        timestamp: timestamp.toString(),
        sign: signature,
        access_token: this.accessToken!,
      }).toString();

      const response = await this.makeRequestWithRetry<{
        response: {
          orders: ShopeeOrder[];
          total: number;
          more: boolean;
        };
      }>(`${this.config.baseUrl}${path}?${queryString}`);

      return {
        success: true,
        data: response.response.orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(response.response.total / pageSize),
          totalItems: response.response.total,
          itemsPerPage: pageSize,
          hasNextPage: response.response.more,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      throw new ConnectorError(
        'Failed to fetch Shopee orders',
        'FETCH_ORDERS_ERROR',
        'shopee',
        error as Error
      );
    }
  }

  async normalizeProduct(rawProduct: ShopeeProduct): Promise<UnifiedProduct> {
    const images = rawProduct.images.map((img, index) => ({
      url: img.url_large || img.url,
      alt: rawProduct.item_name,
      order: index,
    }));

    const categories = rawProduct.categories.map(cat => ({
      id: cat.cat_id.toString(),
      name: cat.cat_name,
    }));

    const variants = rawProduct.variations.map(variation => ({
      id: `${rawProduct.item_id}-${variation.name}`,
      title: variation.name,
      attributes: { name: variation.name },
      options: variation.options.map(option => ({
        name: option.name,
        priceAdjustment: option.price_adjustment,
        stock: option.stock,
      })),
    }));

    return {
      id: this.generateId(),
      storeId: this.credentials.storeId || this.generateId(),
      platformId: 'shopee',
      platformProductId: rawProduct.item_id.toString(),
      sku: rawProduct.item_sku,
      title: rawProduct.item_name,
      description: this.sanitizeHtml(rawProduct.description),
      shortDescription: this.sanitizeHtml(rawProduct.description).substring(0, 200),
      price: this.parseCurrency(rawProduct.current_price),
      comparePrice: this.parseCurrency(rawProduct.original_price),
      currency: rawProduct.currency || 'SGD', // Default to SGD for Shopee SG
      stock: rawProduct.stock,
      trackInventory: true,
      weight: rawProduct.weight / 1000, // Convert to kg
      images,
      categories,
      tags: [], // Shopee doesn't have tags in this response
      status: this.mapProductStatus(rawProduct.item_status),
      isActive: rawProduct.item_status === 'NORMAL',
      isVisible: rawProduct.item_status === 'NORMAL',
      platformMetadata: {
        itemId: rawProduct.item_id,
        shopId: rawProduct.shopid,
        hasDiscount: rawProduct.has_discount,
        discount: rawProduct.discount,
        daysToShip: rawProduct.days_to_ship,
        condition: rawProduct.condition,
        preorder: rawProduct.preorder,
        preorderPeriod: rawProduct.preorder_period,
        sales: rawProduct.sales,
        likedCount: rawProduct.liked_count,
        ratingStar: rawProduct.rating_star,
        commentCount: rawProduct.comment_count,
        createTime: rawProduct.create_time,
        updateTime: rawProduct.update_time,
        attributes: rawProduct.attributes,
        variations: rawProduct.variations,
      },
      seo: {
        title: rawProduct.item_name,
        description: this.sanitizeHtml(rawProduct.description).substring(0, 160),
      },
      variants: variants.length > 0 ? variants : undefined,
      attributes: {
        condition: rawProduct.condition,
        daysToShip: rawProduct.days_to_ship,
        preorder: rawProduct.preorder,
        sales: rawProduct.sales,
        rating: rawProduct.rating_star,
      },
      lastSyncAt: new Date(),
      createdAt: new Date(rawProduct.create_time * 1000),
      updatedAt: new Date(rawProduct.update_time * 1000),
    };
  }

  async normalizeOrder(rawOrder: ShopeeOrder): Promise<UnifiedOrder> {
    const items = await Promise.all(
      rawOrder.item_list.map(item => this.normalizeOrderItem(item, rawOrder.order_sn))
    );

    const shippingAddress = {
      name: rawOrder.recipient_address.name,
      phone: rawOrder.recipient_address.phone,
      address1: rawOrder.recipient_address.full_address,
      city: rawOrder.recipient_address.town,
      province: rawOrder.recipient_address.state,
      country: rawOrder.recipient_address.region,
      postalCode: rawOrder.recipient_address.zipcode,
    };

    return {
      id: this.generateId(),
      storeId: this.credentials.storeId || this.generateId(),
      platformId: 'shopee',
      platformOrderId: rawOrder.order_sn,
      orderNumber: rawOrder.order_sn,
      customerName: rawOrder.buyer_username,
      customerPhone: rawOrder.recipient_address.phone,
      shippingAddress,
      billingAddress: shippingAddress, // Shopee uses same address for both
      subtotal: this.parseCurrency(rawOrder.amount - rawOrder.actual_shipping_fee),
      tax: 0, // Shopee doesn't separate tax in this response
      shipping: this.parseCurrency(rawOrder.actual_shipping_fee),
      discount: this.parseCurrency(rawOrder.buyer_canceled_amount + rawOrder.seller_canceled_amount),
      total: this.parseCurrency(rawOrder.total_amount),
      currency: rawOrder.currency,
      status: this.mapOrderStatus(rawOrder.order_status),
      fulfillmentStatus: this.mapFulfillmentStatus(rawOrder.order_status),
      paymentStatus: this.mapPaymentStatus(rawOrder.order_status),
      platformMetadata: {
        shippingCarrier: rawOrder.shipping_carrier,
        paymentMethod: rawOrder.payment_method,
        orderFlag: rawOrder.order_flag,
        messageType: rawOrder.message_type,
        chargeableWeight: rawOrder.order_chargeable_weight_gram,
        estimatedShippingFee: rawOrder.estimated_shipping_fee,
        goodsToDeclare: rawOrder.goods_to_declare,
        cancelBy: rawOrder.cancel_by,
        cancelReason: rawOrder.cancel_reason,
        packageList: rawOrder.package_list,
      },
      orderDate: new Date(rawOrder.create_time * 1000),
      shippedDate: rawOrder.shipping_time ? new Date(rawOrder.shipping_time * 1000) : undefined,
      notes: rawOrder.note,
      trackingNumbers: rawOrder.package_list.map(pkg => pkg.tracking_no).filter(Boolean),
      items,
      lastSyncAt: new Date(),
      createdAt: new Date(rawOrder.create_time * 1000),
      updatedAt: new Date(rawOrder.update_time * 1000),
    };
  }

  private async normalizeOrderItem(item: any, orderSn: string): Promise<UnifiedOrderItem> {
    return {
      id: this.generateId(),
      orderId: this.generateId(),
      platformProductId: item.item_id.toString(),
      productTitle: item.item_name,
      productSku: item.item_sku,
      variantTitle: item.model_name,
      unitPrice: this.parseCurrency(item.model_discounted_price),
      comparePrice: this.parseCurrency(item.model_original_price),
      quantity: item.model_quantity_purchased,
      total: this.parseCurrency(item.model_discounted_price * item.model_quantity_purchased),
      platformMetadata: {
        isMainItem: item.is_main_item,
        addonDealId: item.add_on_deal_id,
        addonDealName: item.add_on_deal_name,
        wholesaleId: item.wholesale_id,
        groupBuyId: item.group_buy_id,
        isAddonSubItem: item.is_add_on_sub_item,
        itemWeight: item.item_weight,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private generateSignature(
    secret: string,
    apiKey: string,
    timestamp: number,
    path: string,
    params: Record<string, any>
  ): string {
    const crypto = require('crypto');
    const baseString = `${apiKey}${path}${timestamp}${JSON.stringify(params)}`;
    return crypto.createHmac('sha256', secret).update(baseString).digest('hex');
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken) {
      await this.authenticate();
    }
  }

  private mapProductStatus(status: string): UnifiedProduct['status'] {
    switch (status) {
      case 'NORMAL':
        return 'active';
      case 'DELETED':
      case 'BANNED':
        return 'archived';
      default:
        return 'inactive';
    }
  }

  private mapOrderStatus(status: string): UnifiedOrder['status'] {
    switch (status) {
      case 'UNPAID':
        return 'pending';
      case 'READY_TO_SHIP':
      case 'IN_PROGRESS':
        return 'processing';
      case 'TO_CONFIRM_RECEIVE':
        return 'shipped';
      case 'COMPLETED':
        return 'delivered';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  private mapFulfillmentStatus(status: string): UnifiedOrder['fulfillment_status'] {
    switch (status) {
      case 'READY_TO_SHIP':
        return 'unfulfilled';
      case 'IN_PROGRESS':
        return 'partial';
      case 'TO_CONFIRM_RECEIVE':
      case 'COMPLETED':
        return 'fulfilled';
      default:
        return 'unfulfilled';
    }
  }

  private mapPaymentStatus(status: string): UnifiedOrder['paymentStatus'] {
    switch (status) {
      case 'UNPAID':
        return 'pending';
      case 'CANCELLED':
        return 'failed';
      case 'READY_TO_SHIP':
      case 'IN_PROGRESS':
      case 'TO_CONFIRM_RECEIVE':
      case 'COMPLETED':
        return 'paid';
      default:
        return 'pending';
    }
  }
}