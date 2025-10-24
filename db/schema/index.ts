// Export all database tables and types
export * from './auth';
export * from './marketplace';

// Re-export commonly used types for convenience
export type { User, Session, Account, Verification } from './auth';
export type {
    Platform,
    Store,
    Product,
    Order,
    OrderItem,
    SyncLog,
    WebhookEvent,
    NewPlatform,
    NewStore,
    NewProduct,
    NewOrder,
    NewOrderItem,
    NewSyncLog,
    NewWebhookEvent
} from './marketplace';