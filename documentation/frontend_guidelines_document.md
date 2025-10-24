# Frontend Guidelines for Marketplace Hub Manager

This document outlines the frontend architecture, design principles, styling, component structure, state management, routing, performance optimizations, and testing strategies for the **Marketplace Hub Manager**. It’s designed to help any developer (even without deep technical background) understand how the frontend is set up and why.

## 1. Frontend Architecture

### Frameworks and Libraries
- **Next.js 15 (App Router)**: Provides file-based routing, server components, and API routes in a single framework.  
- **React 18**: Powers the component-based UI.  
- **TypeScript**: Ensures type safety across UI code and API interactions.  
- **Tailwind CSS & `shadcn/ui`**: A utility-first CSS framework plus a library of pre-built, accessible React components.  
- **`next-themes`**: Manages light/dark/system themes.  
- **`better-auth`**: Handles user authentication flows.  
- **Drizzle ORM & PostgreSQL**: Server-side database layer for storing aggregated store data.  
- **Docker & docker-compose**: Containerize services for consistent development and deployment.

### Scalability, Maintainability, and Performance
- **Server Components & API Routes** allow us to colocate data fetching and UI logic, reducing client bundle size.  
- **Component-based design** (via React & `shadcn/ui`) makes it easy to add or modify UI features without touching unrelated parts.  
- **TypeScript** prevents many classes of bugs early in development, making long-term maintenance smoother.  
- **Tailwind’s JIT** compilation and purging remove unused CSS classes, keeping style bundles lean.

## 2. Design Principles

### Usability
- Straightforward, consistent layouts: Sidebar navigation, top-level headers.  
- Clear affordances: Buttons, links and form fields use consistent styling and hover/focus states.

### Accessibility
- Use semantic HTML (buttons, forms, headings).  
- Leverage `shadcn/ui` components, which follow WAI-ARIA best practices.  
- Ensure all interactive elements have keyboard focus styles and `aria-*` labels where needed.

### Responsiveness
- Mobile-first breakpoints in Tailwind ensure the dashboard adapts from smartphone to desktop.  
- Data tables collapse or scroll horizontally on narrow screens.  
- Navigation collapses into a hamburger menu on small viewports.

## 3. Styling and Theming

### Styling Approach
- **Utility-first with Tailwind CSS**: Use Tailwind classes to style elements directly in JSX.  
- **`shadcn/ui`**: Provides styled components (tables, modals, inputs) built on top of Tailwind.  
- No separate SASS or BEM; utilities keep style definitions co-located with markup.

### Theming
- **Light & Dark Modes** via `next-themes`.  
- Theme toggle in the header persists user preference in `localStorage`.  
- System theme detection falls back gracefully.

### Visual Style
- **Design Style**: Modern, flat design with subtle depth (shadows, rounded corners).  
- **Color Palette**:
  - Primary: #4F46E5 (Indigo)  
  - Secondary: #6366F1 (Light Indigo)  
  - Accent: #10B981 (Emerald)  
  - Neutral Background (Light): #F9FAFB  
  - Neutral Background (Dark): #111827  
  - Text Primary: #1F2937  
  - Text Secondary: #4B5563  
  - Border/Divider: #E5E7EB  
  - Danger: #EF4444 (Red)  
  - Warning: #F59E0B (Amber)  

- **Font**: Inter (system-UI fallback). Chosen for readability and modern appearance.

## 4. Component Structure

### Organization
```
/pages or /app         // Next.js routes and layouts
/components           // Shared UI components and data tables
/components/ui        // `shadcn/ui` primitives (Button, Input, Dialog)
/lib                  // Marketplace integration modules (shopee.ts, tiktok.ts)
/styles               // Global styles or Tailwind overrides (if any)
```

### Reusability and Maintainability
- **Atomic Components** in `/components/ui` form the building blocks (buttons, inputs, tables).  
- **Composite Components** (e.g., DataTable) wrap primitives with custom logic and styles.  
- Naming and folder structure enable quick discovery and consistent reuse across pages.

## 5. State Management

### Local vs. Shared vs. Server State
- **Local State**: `useState` for ephemeral UI states (modal open/closed, form inputs).  
- **Shared Client State**: React Context (via `next-themes`) manages theme selection.  
- **Server/API State**: **TanStack Query (React Query)** handles data fetching, caching, synchronization, and loading states.

### Why This Approach
- React Query abstracts common patterns (loading, refetch, cache invalidation) when syncing with Next.js API routes.  
- Minimal boilerplate compared to Redux for data-fetching scenarios.

## 6. Routing and Navigation

### Next.js App Router
- **File-based routing** under the `/app` directory: each folder corresponds to a route.  
- **`layout.tsx`** defines global wrappers (theme provider, auth guard, header/sidebar).  
- **Nested layouts** enable shared UI (e.g., sidebar) across dashboard pages.

### Navigation Structure
- **Sidebar**: Links to Dashboard Home, Products, Orders, Analytics, Settings.  
- **Breadcrumbs**: Show current location within nested pages.  
- **Dynamic Routes**: e.g., `/dashboard/stores/[storeId]/products` for store-specific views.

## 7. Performance Optimization

- **Automatic Code Splitting** by Next.js: Only load the JS needed for the current page.  
- **Dynamic Imports** for heavy components (charts, maps) using `next/dynamic`.  
- **Image Optimization**: `next/image` for responsive, lazy-loaded images.  
- **Tailwind PurgeCSS**: Strips out unused CSS classes in production.  
- **Caching & CDN**: Leverage Vercel or similar to serve static assets close to users.  
- **Prefetching** of Next.js links for instant navigation between known routes.

## 8. Testing and Quality Assurance

### Unit Tests
- **Jest**: Validate utility functions, data transformations in `lib/`.  
- Mock external APIs to isolate logic.

### Integration Tests
- **React Testing Library**: Render components with mock providers.  
- Test that DataTable displays rows given sample data, that forms validate inputs correctly.

### End-to-End (E2E) Tests
- **Playwright or Cypress**: Simulate real user flows:  
  - Sign up and sign in  
  - Connect a new store  
  - Sync products and view them in the table  
- Mock marketplace APIs to control test scenarios.

### Component Development
- **Storybook**: Build and preview UI components in isolation.  
- Document variants (buttons, dialogs, tables) and accessibility attributes.

## 9. Conclusion and Overall Frontend Summary

This frontend setup combines the power of Next.js, React, TypeScript, Tailwind CSS, and `shadcn/ui` to deliver a modern, scalable, and maintainable e-commerce hub interface. Key takeaways:

- **Scalable Architecture**: Server components + API routes keep the client bundle light and logic clear.  
- **Design Principles**: Focus on usability, accessibility, and responsiveness ensures all users can manage stores on any device.  
- **Consistent Styling**: Utility-first CSS and theming deliver a cohesive look and feel across the dashboard.  
- **Robust State & Data Handling**: React Query + Next.js provides smooth data sync, caching, and error handling.  
- **Quality Assurance**: A testing pyramid (unit, integration, E2E) combined with Storybook maintains high reliability as features grow.

By following these guidelines, contributors can confidently extend and maintain the Marketplace Hub Manager’s frontend, ensuring a seamless user experience and a solid foundation for future enhancements.