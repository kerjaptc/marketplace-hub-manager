import {
    pgTable,
    text,
    timestamp,
    integer,
    decimal,
    boolean,
    jsonb,
    primaryKey,
    index
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Platform definitions for supported marketplaces
export const platforms = pgTable("platforms", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(), // e.g., "shopee", "tiktok-shop", "tokopedia", "cults3d", "custom"
    displayName: text("display_name").notNull(), // e.g., "Shopee", "TikTok Shop"
    type: text("type").notNull(), // "local" or "digital"
    logoUrl: text("logo_url"),
    baseUrl: text("base_url"), // API base URL
    authType: text("auth_type").notNull(), // "oauth", "api-key", "basic"
    configSchema: jsonb("config_schema"), // JSON schema for required configuration
    rateLimits: jsonb("rate_limits"), // Rate limiting configuration
    isActive: boolean("is_active").default(true).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    nameIdx: index("platforms_name_idx").on(table.name),
    typeIdx: index("platforms_type_idx").on(table.type),
}));

// User's connected stores on each platform
export const stores = pgTable("stores", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    platformId: text("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Store name
    description: text("description"),
    storeUrl: text("store_url"), // Public store URL
    currency: text("currency").default("USD").notNull(), // Default currency for this store
    timezone: text("timezone").default("UTC").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    credentials: jsonb("credentials"), // Encrypted API credentials
    platformConfig: jsonb("platform_config"), // Platform-specific configuration
    lastSyncAt: timestamp("last_sync_at"),
    syncStatus: text("sync_status").default("never"), // "never", "syncing", "success", "error"
    syncError: text("sync_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index("stores_user_id_idx").on(table.userId),
    platformIdIdx: index("stores_platform_id_idx").on(table.platformId),
    storeUrlIdx: index("stores_store_url_idx").on(table.storeUrl),
}));

// Unified products table with platform-specific metadata
export const products = pgTable("products", {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    platformId: text("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
    platformProductId: text("platform_product_id").notNull(), // Original product ID from platform
    sku: text("sku"), // Stock keeping unit
    title: text("title").notNull(),
    description: text("description"),
    shortDescription: text("short_description"),
    price: decimal("price", { precision: 10, scale: 2 }), // Base price
    comparePrice: decimal("compare_price", { precision: 10, scale: 2 }), // Original price for comparison
    cost: decimal("cost", { precision: 10, scale: 2 }), // Cost of goods
    currency: text("currency").default("USD").notNull(),
    stock: integer("stock").default(0), // Available inventory
    trackInventory: boolean("track_inventory").default(true).notNull(),
    weight: decimal("weight", { precision: 8, scale: 3 }),
    dimensions: jsonb("dimensions"), // { length, width, height, unit }
    images: jsonb("images"), // Array of image URLs and metadata
    categories: jsonb("categories"), // Platform-specific categories
    tags: text("tags"), // Comma-separated tags
    status: text("status").default("active"), // "active", "inactive", "draft", "archived"
    isActive: boolean("is_active").default(true).notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    platformMetadata: jsonb("platform_metadata"), // Platform-specific data
    seo: jsonb("seo"), // SEO metadata (title, description, keywords)
    variants: jsonb("variants"), // Product variants (size, color, etc.)
    attributes: jsonb("attributes"), // Additional product attributes
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    storeIdIdx: index("products_store_id_idx").on(table.storeId),
    platformIdIdx: index("products_platform_id_idx").on(table.platformId),
    skuIdx: index("products_sku_idx").on(table.sku),
    statusIdx: index("products_status_idx").on(table.status),
    platformProductIdIdx: index("products_platform_product_id_idx").on(table.platformProductId),
    uniquePlatformProduct: index("products_unique_platform_product_idx").on(table.platformId, table.platformProductId),
}));

// Unified orders table
export const orders = pgTable("orders", {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    platformId: text("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
    platformOrderId: text("platform_order_id").notNull(), // Original order ID from platform
    orderNumber: text("order_number").notNull(), // Human-readable order number
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),

    // Shipping address
    shippingAddress: jsonb("shipping_address"), // Full address as JSON

    // Billing address
    billingAddress: jsonb("billing_address"), // Full address as JSON

    // Order totals
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00").notNull(),
    shipping: decimal("shipping", { precision: 10, scale: 2 }).default("0.00").notNull(),
    discount: decimal("discount", { precision: 10, scale: 2 }).default("0.00").notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").default("USD").notNull(),

    // Order status and timestamps
    status: text("status").default("pending"), // "pending", "processing", "shipped", "delivered", "cancelled", "refunded"
    fulfillmentStatus: text("fulfillment_status").default("unfulfilled"), // "unfulfilled", "partial", "fulfilled"
    paymentStatus: text("payment_status").default("pending"), // "pending", "paid", "failed", "refunded"

    // Platform-specific data
    platformMetadata: jsonb("platform_metadata"), // Platform-specific order data

    // Timestamps
    orderDate: timestamp("order_date").notNull(),
    shippedDate: timestamp("shipped_date"),
    deliveredDate: timestamp("delivered_date"),
    cancelledDate: timestamp("cancelled_date"),

    // Additional fields
    notes: text("notes"), // Internal notes
    customerNotes: text("customer_notes"), // Notes from customer
    trackingNumbers: jsonb("tracking_numbers"), // Array of tracking numbers

    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    storeIdIdx: index("orders_store_id_idx").on(table.storeId),
    platformIdIdx: index("orders_platform_id_idx").on(table.platformId),
    platformOrderIdIdx: index("orders_platform_order_id_idx").on(table.platformOrderId),
    orderNumberIdx: index("orders_order_number_idx").on(table.orderNumber),
    statusIdx: index("orders_status_idx").on(table.status),
    orderDateIdx: index("orders_order_date_idx").on(table.orderDate),
    customerEmailIdx: index("orders_customer_email_idx").on(table.customerEmail),
    uniquePlatformOrder: index("orders_unique_platform_order_idx").on(table.platformId, table.platformOrderId),
}));

// Order line items
export const orderItems = pgTable("order_items", {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    platformProductId: text("platform_product_id").notNull(),

    // Product details at time of order
    productTitle: text("product_title").notNull(),
    productSku: text("product_sku"),
    productImage: text("product_image"), // Main product image URL

    // Variant details
    variantTitle: text("variant_title"), // e.g., "Size: M, Color: Red"
    variantId: text("variant_id"), // Platform-specific variant ID

    // Pricing
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    comparePrice: decimal("compare_price", { precision: 10, scale: 2 }),
    quantity: integer("quantity").notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),

    // Platform-specific data
    platformMetadata: jsonb("platform_metadata"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
    productIdIdx: index("order_items_product_id_idx").on(table.productId),
    platformProductIdIdx: index("order_items_platform_product_id_idx").on(table.platformProductId),
}));

// Synchronization logs
export const syncLogs = pgTable("sync_logs", {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    platformId: text("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "products", "orders", "inventory", "full"
    status: text("status").notNull(), // "started", "running", "completed", "failed", "cancelled"

    // Sync statistics
    recordsProcessed: integer("records_processed").default(0),
    recordsCreated: integer("records_created").default(0),
    recordsUpdated: integer("records_updated").default(0),
    recordsDeleted: integer("records_deleted").default(0),
    recordsFailed: integer("records_failed").default(0),

    // Details and error handling
    details: jsonb("details"), // Additional sync details
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),

    // Timing
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    duration: integer("duration"), // Duration in seconds

    // Metadata
    triggeredBy: text("triggered_by"), // "manual", "scheduled", "webhook"
    triggeredByUserId: text("triggered_by_user_id").references(() => user.id, { onDelete: "set null" }),
    platformMetadata: jsonb("platform_metadata"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    storeIdIdx: index("sync_logs_store_id_idx").on(table.storeId),
    platformIdIdx: index("sync_logs_platform_id_idx").on(table.platformId),
    typeIdx: index("sync_logs_type_idx").on(table.type),
    statusIdx: index("sync_logs_status_idx").on(table.status),
    startedAtIdx: index("sync_logs_started_at_idx").on(table.startedAt),
}));

// Webhook events for real-time updates
export const webhookEvents = pgTable("webhook_events", {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    platformId: text("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(), // "order.created", "product.updated", etc.

    // Event data
    payload: jsonb("payload").notNull(), // Full webhook payload
    processed: boolean("processed").default(false).notNull(),
    processedAt: timestamp("processed_at"),

    // Error handling
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0),

    // Timestamps
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    storeIdIdx: index("webhook_events_store_id_idx").on(table.storeId),
    platformIdIdx: index("webhook_events_platform_id_idx").on(table.platformId),
    eventTypeIdx: index("webhook_events_event_type_idx").on(table.eventType),
    processedIdx: index("webhook_events_processed_idx").on(table.processed),
    receivedAtIdx: index("webhook_events_received_at_idx").on(table.receivedAt),
}));

// Export all tables for easy importing
export type Platform = typeof platforms.$inferSelect;
export type NewPlatform = typeof platforms.$inferInsert;

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;