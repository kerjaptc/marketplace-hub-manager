CREATE TABLE "platforms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"type" text NOT NULL,
	"logo_url" text,
	"base_url" text,
	"auth_type" text NOT NULL,
	"config_schema" jsonb,
	"rate_limits" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platforms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"store_url" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"credentials" jsonb,
	"platform_config" jsonb,
	"last_sync_at" timestamp,
	"sync_status" text DEFAULT 'never',
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"platform_product_id" text NOT NULL,
	"sku" text,
	"title" text NOT NULL,
	"description" text,
	"short_description" text,
	"price" decimal(10,2),
	"compare_price" decimal(10,2),
	"cost" decimal(10,2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"stock" integer DEFAULT 0,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"weight" decimal(8,3),
	"dimensions" jsonb,
	"images" jsonb,
	"categories" jsonb,
	"tags" text,
	"status" text DEFAULT 'active',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"platform_metadata" jsonb,
	"seo" jsonb,
	"variants" jsonb,
	"attributes" jsonb,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"platform_order_id" text NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"shipping_address" jsonb,
	"billing_address" jsonb,
	"subtotal" decimal(10,2) NOT NULL,
	"tax" decimal(10,2) DEFAULT 0.00 NOT NULL,
	"shipping" decimal(10,2) DEFAULT 0.00 NOT NULL,
	"discount" decimal(10,2) DEFAULT 0.00 NOT NULL,
	"total" decimal(10,2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending',
	"fulfillment_status" text DEFAULT 'unfulfilled',
	"payment_status" text DEFAULT 'pending',
	"platform_metadata" jsonb,
	"order_date" timestamp NOT NULL,
	"shipped_date" timestamp,
	"delivered_date" timestamp,
	"cancelled_date" timestamp,
	"notes" text,
	"customer_notes" text,
	"tracking_numbers" jsonb,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text,
	"platform_product_id" text NOT NULL,
	"product_title" text NOT NULL,
	"product_sku" text,
	"product_image" text,
	"variant_title" text,
	"variant_id" text,
	"unit_price" decimal(10,2) NOT NULL,
	"compare_price" decimal(10,2),
	"quantity" integer NOT NULL,
	"total" decimal(10,2) NOT NULL,
	"platform_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_deleted" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"details" jsonb,
	"error_message" text,
	"error_stack" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration" integer,
	"triggered_by" text,
	"triggered_by_user_id" text,
	"platform_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platforms_name_idx" ON "platforms" ("name");
--> statement-breakpoint
CREATE INDEX "platforms_type_idx" ON "platforms" ("type");
--> statement-breakpoint
CREATE INDEX "stores_user_id_idx" ON "stores" ("user_id");
--> statement-breakpoint
CREATE INDEX "stores_platform_id_idx" ON "stores" ("platform_id");
--> statement-breakpoint
CREATE INDEX "stores_store_url_idx" ON "stores" ("store_url");
--> statement-breakpoint
CREATE INDEX "products_store_id_idx" ON "products" ("store_id");
--> statement-breakpoint
CREATE INDEX "products_platform_id_idx" ON "products" ("platform_id");
--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "products" ("sku");
--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" ("status");
--> statement-breakpoint
CREATE INDEX "products_platform_product_id_idx" ON "products" ("platform_product_id");
--> statement-breakpoint
CREATE INDEX "products_unique_platform_product_idx" ON "products" ("platform_id", "platform_product_id");
--> statement-breakpoint
CREATE INDEX "orders_store_id_idx" ON "orders" ("store_id");
--> statement-breakpoint
CREATE INDEX "orders_platform_id_idx" ON "orders" ("platform_id");
--> statement-breakpoint
CREATE INDEX "orders_platform_order_id_idx" ON "orders" ("platform_order_id");
--> statement-breakpoint
CREATE INDEX "orders_order_number_idx" ON "orders" ("order_number");
--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" ("status");
--> statement-breakpoint
CREATE INDEX "orders_order_date_idx" ON "orders" ("order_date");
--> statement-breakpoint
CREATE INDEX "orders_customer_email_idx" ON "orders" ("customer_email");
--> statement-breakpoint
CREATE INDEX "orders_unique_platform_order_idx" ON "orders" ("platform_id", "platform_order_id");
--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" ("order_id");
--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" ("product_id");
--> statement-breakpoint
CREATE INDEX "order_items_platform_product_id_idx" ON "order_items" ("platform_product_id");
--> statement-breakpoint
CREATE INDEX "sync_logs_store_id_idx" ON "sync_logs" ("store_id");
--> statement-breakpoint
CREATE INDEX "sync_logs_platform_id_idx" ON "sync_logs" ("platform_id");
--> statement-breakpoint
CREATE INDEX "sync_logs_type_idx" ON "sync_logs" ("type");
--> statement-breakpoint
CREATE INDEX "sync_logs_status_idx" ON "sync_logs" ("status");
--> statement-breakpoint
CREATE INDEX "sync_logs_started_at_idx" ON "sync_logs" ("started_at");
--> statement-breakpoint
CREATE INDEX "webhook_events_store_id_idx" ON "webhook_events" ("store_id");
--> statement-breakpoint
CREATE INDEX "webhook_events_platform_id_idx" ON "webhook_events" ("platform_id");
--> statement-breakpoint
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events" ("event_type");
--> statement-breakpoint
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events" ("processed");
--> statement-breakpoint
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" ("received_at");
--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_triggered_by_user_id_user_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;