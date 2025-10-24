# Backend Structure Document

## 1. Backend Architecture

This section describes how the backend is organized, the frameworks and patterns in use, and how the design supports growing traffic, code maintenance, and efficient performance.

### 1.1 Overall Architecture

- **Framework**: Next.js 15 (App Router) serving both server-side API routes and React Server Components.  
- **Language**: TypeScript throughout, ensuring type safety and early error detection.  
- **Design Patterns**:
  - **Modular Services**: Each external marketplace (Shopee, TikTok, Tokopedia, Cults3D) gets its own integration module under `lib/integrations/`.  
  - **Layered Structure**: API routes in `app/api/` call service modules in `lib/`, which in turn interact with the ORM layer in `db/`.  
  - **Component-Driven UI**: Backend APIs are designed to supply data in a shape that matches reusable UI components (`shadcn/ui`).

### 1.2 Scalability, Maintainability & Performance

- **Scalability**:
  - Stateless API routes allow horizontal scaling (multiple server instances behind a load balancer).  
  - Containerization (Docker) ensures each service runs reliably in any environment or orchestrator (Kubernetes, Docker Swarm).  
- **Maintainability**:
  - Clear separation of concerns (authentication, integrations, data access).  
  - Type-safe ORM (Drizzle) keeps schema definitions and queries in one place, easing future changes.  
- **Performance**:
  - Server Components in Next.js reduce client-side bundle size.  
  - Caching strategies (in-memory or external Redis) can be added to gateway layers for heavy API calls.  
  - Database indexes on frequently queried columns (e.g., `external_id`, `store_id`).

## 2. Database Management

This section covers our choice of data store, how data is organized, and best practices for managing it.

### 2.1 Technology Stack

- **Type**: Relational (SQL) database.  
- **System**: PostgreSQL.  
- **ORM**: Drizzle ORM for type-safe schema definitions, queries, and migrations.  
- **Containerization**: PostgreSQL runs in its own Docker container during development.

### 2.2 Data Structure & Access

- **Normalized Tables**: Separate tables for users, platforms, stores, credentials, products, and orders.  
- **Foreign Keys**: Enforce relationships (e.g., a product belongs to one store).  
- **Migrations**: Drizzle’s CLI handles versioned schema changes, ensuring database evolves safely alongside code.  
- **Connection Pooling**: Built into the ORM or via a pooler (PgBouncer) in production to handle many simultaneous requests.

## 3. Database Schema

Below is a human-readable description of the main tables, followed by SQL statements to create them in PostgreSQL.

### 3.1 Tables Overview (Human-Readable)

- **users**: Stores application users (login credentials, profile info).  
- **platforms**: Supported marketplaces (Shopee, TikTok Shop, etc.).  
- **stores**: A user’s individual store on a given platform.  
- **credentials**: Encrypted API keys and secrets for each store.  
- **products**: Aggregated product listings, tied to a store and platform.  
- **orders**: Aggregated order records from each store.

### 3.2 PostgreSQL Schema

```sql
-- 1. Users
eCREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Platforms
eCREATE TABLE platforms (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  api_base_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Stores
eCREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE RESTRICT,
  external_store_id TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform_id, external_store_id)
);

-- 4. Credentials
eCREATE TABLE credentials (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Products
eCREATE TABLE products (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE RESTRICT,
  external_product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2),
  inventory INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, external_product_id)
);

-- 6. Orders
eCREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE RESTRICT,
  external_order_id TEXT NOT NULL,
  status TEXT,
  total_amount NUMERIC(12, 2),
  items JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, external_order_id)
);
``` 

## 4. API Design and Endpoints

We use a RESTful approach via Next.js API Routes. Endpoints are grouped by resource:

### 4.1 Authentication

- **POST /api/auth/signup**: Create a new user.  
- **POST /api/auth/login**: Verify credentials, return session token.  
- **POST /api/auth/logout**: Invalidate the current session.

### 4.2 Platforms & Stores

- **GET /api/platforms**: List all supported platforms.  
- **GET /api/stores**: Retrieve stores linked to the authenticated user.  
- **POST /api/stores**: Add a new store (platform + external ID + credentials).  
- **PUT /api/stores/:storeId**: Update store details or rotate credentials.  
- **DELETE /api/stores/:storeId**: Remove a linked store.

### 4.3 Data Sync & Management

- **GET /api/stores/:storeId/products**: Fetch synced products from local database.  
- **POST /api/stores/:storeId/products/sync**: Trigger on-demand sync from external API.  
- **GET /api/stores/:storeId/orders**: List synced orders.  
- **POST /api/stores/:storeId/orders/sync**: Trigger manual order sync.

### 4.4 Integration-Specific Endpoints

These act as facades to the external APIs and live under dedicated paths:  
- **GET /api/shopee/products**  
- **GET /api/tiktok/orders**  

Each route calls its corresponding service module (`lib/integrations/shopee.ts`, etc.), normalizes data, writes to the database, and responds with the standard schema.

## 5. Hosting Solutions

### 5.1 Cloud Provider

- **Platform**: Vercel (recommended) for serverless Next.js deployment.  
- **Database**: Managed PostgreSQL (AWS RDS, DigitalOcean Managed DB) for high availability and automated backups.

### 5.2 Benefits

- **Reliability**: Serverless functions scale on demand; managed DBs have automated failover.  
- **Scalability**: Vercel auto-scales endpoints; read replicas can be added for the database.  
- **Cost-Effectiveness**: Pay-per-use on Vercel; managed DB plans start small and grow as needed.

## 6. Infrastructure Components

- **Load Balancer**: Vercel’s edge network automatically balances incoming requests across global regions.  
- **Caching**:
  - **Edge Caching** for static assets and immutable API responses.  
  - **Redis** (optional) for in-memory caching of frequent or costly API calls.  
- **Content Delivery Network (CDN)**: Vercel (built-in) or Cloudflare for global asset distribution.  
- **Cron Jobs / Schedulers**: Vercel Cron or a lightweight serverless function for periodic sync tasks.

## 7. Security Measures

- **Authentication & Authorization**:
  - `better-auth` handles sign-up/in, session management, and protected routes.  
  - Role-based access control ensures only store owners and admins can manage data.  
- **Transport Security**: HTTPS enforced on all endpoints (handled by Vercel or your TLS provider).  
- **Data Encryption**:
  - **In Transit**: TLS for network traffic.  
  - **At Rest**: Database encryption (native to managed services) and encrypted storage of API credentials.  
- **Input Validation & Sanitization**: Next.js middleware and JOI or Zod schemas validate request bodies.  
- **Rate Limiting**: Throttle heavy endpoints to protect external APIs and limit abuse.

## 8. Monitoring and Maintenance

- **Error Tracking**: Sentry or Logtail captures runtime exceptions and stack traces.  
- **Logging**: Structured logs (JSON) via Winston or Pino, shipped to a central log service.  
- **Metrics**: Prometheus + Grafana or Vercel Analytics for request rates, latencies, error rates.  
- **Alerts**: Set up alerts for high error rates, increased response times, or low database health.  
- **Database Backups & Migrations**:
  - Automated nightly snapshots from managed DB provider.  
  - Schema migrations via Drizzle CLI, run during CI/CD or maintenance windows.

## 9. Conclusion and Overall Backend Summary

This setup combines a modern, modular design with proven cloud and open-source tools to deliver a robust backend for the `marketplace-hub-manager`:

- **Scalable & Modular**: Stateless API routes, containerized services, and clear separation of integrations.  
- **Maintainable & Type-Safe**: End-to-end TypeScript, Drizzle ORM, and versioned migrations ensure safe evolution.  
- **Secure & Compliant**: Encrypted data, role-based access, and industry-standard auth practices.  
- **Optimized for Performance**: CDN caching, optional Redis, and global edge distribution.  
- **Observability & Reliability**: Comprehensive logging, monitoring, and alerting keep the system healthy.

With this backend foundation, you can confidently build out your centralized e-commerce management interface, integrate additional marketplaces, and serve users with consistent performance and security.