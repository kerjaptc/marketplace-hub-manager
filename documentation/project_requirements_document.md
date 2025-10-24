# Project Requirements Document (PRD)

## 1. Project Overview

**Paragraph 1:**
The **Marketplace Hub Manager** is a full-stack starter template designed to serve as the foundation for a centralized hub that lets store managers handle multiple e-commerce channels (Shopee, TikTok Shop, Tokopedia, Cults3D) and custom websites (e.g., motekarfpv.com, r3dfpv.com) from one responsive web app. It offers built-in user authentication, a protected dashboard, pre-built UI components for data tables and charts, a PostgreSQL database via Drizzle ORM, and light/dark theming—everything you need to start integrating external marketplaces and custom business logic.

**Paragraph 2:**
This template is being built to solve the common pain point of juggling separate interfaces for each online store. By unifying product listings, orders, inventory, and analytics into a single interface, it helps e-commerce teams save time, reduce errors, and make faster decisions. Key objectives for success include: secure, role-based user access; a modular codebase that’s easy to extend with new marketplace integrations; fast data synchronization; and a consistent, responsive UI on desktop and mobile.

---

## 2. In-Scope vs. Out-of-Scope

### In-Scope (Version 1.0)
- User sign-up and sign-in flows (better-auth)
- Protected dashboard area (`/app/dashboard/`) with layout and routing
- Core UI components (`shadcn/ui`) for tables, forms, dialogs, charts
- PostgreSQL integration via Drizzle ORM for users, stores, platforms, products, orders, credentials
- Light/dark theme toggling (`next-themes`)
- Boilerplate for Next.js API routes under `/app/api/`
- Docker and `docker-compose` setup for local development and testing
- Basic data-sync button (e.g., “Sync Products”) that calls a placeholder API route

### Out-of-Scope (Planned for Later Phases)
- Full implementation of each marketplace integration module (Shopee, TikTok, etc.)
- Scheduled background jobs or cron-style syncing (only scaffolding provided)
- Advanced analytics dashboards (ML-driven insights)
- Payment gateway integration
- Native mobile apps or desktop clients
- Chatbots or AI-powered support features
- Multi-tenant or white-label capabilities

---

## 3. User Flow

**Paragraph 1:**
A new user lands on the public homepage and clicks **Sign Up**. They fill in their email and password, submit the form, and get logged in automatically. After authentication, they arrive at the **Dashboard**. The left sidebar shows navigation links: **Overview**, **Products**, **Orders**, **Analytics**, and **Settings**. The main panel starts with a high-level overview card (total products, total orders, recent activity).

**Paragraph 2:**
In **Settings**, the user clicks **Add Store**, selects a platform (e.g., Shopee), and enters API credentials. Back in **Products**, they see an empty table with a **Sync Products** button. Clicking it triggers a call to `/api/shopee/products`, which fetches data, normalizes it, and stores it in PostgreSQL. The table updates to show product names, SKUs, stock levels, and source platform. The user can filter, sort, or export the list. They browse to **Orders** to view recent orders, then toggle the theme switch in the navbar before logging out.

---

## 4. Core Features

- **Authentication & Authorization**: Full sign-up/sign-in, session management, protected routes, role-based access control
- **Dashboard Layout**: Sidebar navigation, main content area, overview cards, breadcrumb support
- **UI Components**: Data tables (sorting/filtering/pagination), forms, dialogs, charts—all via `shadcn/ui`
- **Database Schema**: Entities for users, stores, platforms, products, orders, and secure API credentials, managed by Drizzle ORM
- **API Routes**: Next.js API endpoints as facades for external integrations (e.g., `/api/shopee/*`, `/api/cults3d/*`)
- **Integration Modules** (scaffold): `lib/shopee-api.ts`, `lib/tiktok-api.ts`, etc., each handling auth, rate limiting, data fetching, and normalization
- **Data Synchronization**: On-demand sync actions plus scaffolding for scheduled tasks
- **Theming**: Light, dark, or system theme via `next-themes`
- **Containerization**: Docker images and `docker-compose` for app and database

---

## 5. Tech Stack & Tools

- **Frontend & Framework**: Next.js 15 (App Router) with React 18 and TypeScript
- **Styling & UI**: Tailwind CSS, `shadcn/ui`, `next-themes` for theming
- **Authentication**: `better-auth` library for secure sign-up/sign-in flows
- **State Management**: (Suggested) TanStack Query (React Query) for client-side data fetching and caching
- **Backend & ORM**: Next.js API Routes + Drizzle ORM, PostgreSQL
- **Containerization**: Docker, docker-compose
- **Testing** (recommended): Jest for unit tests, React Testing Library for components, Playwright/Cypress for E2E
- **IDE & Plugins**: VS Code with Docker, TypeScript, Tailwind CSS, and Drizzle ORM extensions

---

## 6. Non-Functional Requirements

- **Performance**: Page loads under 300 ms; API responses under 200 ms (excluding external API latency)
- **Security**: HTTPS everywhere, secure cookies, JWT/session tokens, password hashing, environment variable secrets, RBAC
- **Compliance & Privacy**: GDPR-ready data handling; users can delete their account and data
- **Usability**: Responsive design across mobile, tablet, desktop; keyboard navigation; clear error messages
- **Accessibility**: WCAG AA standards—ARIA labels on interactive elements, sufficient color contrast

---

## 7. Constraints & Assumptions

- External marketplace APIs require valid API credentials and have rate limits
- Drizzle ORM migrations must run before first launch
- Docker Desktop or a compatible container runtime is available in dev/CI
- Node.js 18+ environment for Next.js 15
- Users have modern evergreen browsers (Chrome, Firefox, Edge, Safari)
- No on-premise or legacy IE support required

---

## 8. Known Issues & Potential Pitfalls

- **API Rate Limits**: Each marketplace enforces its own limits; implement throttling and retry logic in `lib/*-api.ts` modules.
- **Inconsistent Data Schemas**: Different platforms return different fields—build a normalization layer to map external fields to your common schema.
- **Error Handling**: Network failures or invalid credentials must surface clear, user-friendly messages and log full details to an external service (e.g., Sentry).
- **Cron Jobs in Serverless**: If deployed on Vercel or similar, scheduled tasks may require a separate worker or third-party cron service.
- **Schema Migrations**: Locking issues can occur during concurrent deployments—use Drizzle’s migration locks and CI checks to prevent conflicts.

---

This PRD lays out all core requirements, scope boundaries, user journeys, and technical considerations for the Marketplace Hub Manager. It serves as the single source of truth for subsequent documents on tech stack details, frontend guidelines, backend architecture, app flow diagrams, file structure conventions, and CI/CD setup.