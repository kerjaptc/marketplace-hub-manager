# App Flow Document for marketplace-hub-manager

## Onboarding and Sign-In/Sign-Up

When a new user visits the marketplace-hub-manager application, they land on a clean welcome page that briefly introduces the multi-store management features and offers two primary actions: Sign In or Sign Up. Choosing Sign Up takes the user to an account creation form where they enter their email address, pick a secure password, and accept the terms of service. Once they submit the form, the application sends a confirmation link to their email. Clicking this link verifies the account and automatically redirects the user to the Sign In page. On the Sign In page, users enter their registered email and password and click the login button. If they forget their password, a “Forgot Password” link lets them enter their email to receive a reset link. Following that link brings them to a secure page where they choose a new password. After resetting, they are taken back to Sign In. Users remain signed in through session cookies managed by the authentication library. A Sign Out option is always available in the user menu in the header of the application.

## Main Dashboard or Home Page

After successful authentication, the user is redirected to the main dashboard located at `/dashboard`. The dashboard presents a left-hand navigation pane with links to Products, Orders, Analytics, Stores, and Settings. Across the top is a header containing the application logo, a theme switcher for light or dark mode, and the user avatar with a dropdown menu that includes Profile, Billing, and Sign Out. In the center of the dashboard, a set of summary cards shows quick metrics such as total products synced, new orders pending, and overall sales volume. Each of these cards is clickable, sending the user to the corresponding detailed page when selected. From this central view, the user can navigate to any feature area by using the sidebar or by interacting with the summary widgets.

## Detailed Feature Flows and Page Transitions

### Connecting a New Store

When users want to add a new marketplace or custom website, they click the Stores link in the sidebar. On the Stores page, they find an “Add Store” button at the top. Clicking that button opens a modal where they choose the platform from a drop-down list. For OAuth-based platforms like Shopee or TikTok Shop, clicking Continue redirects users to the external login interface of the chosen platform. After granting permission, the user is sent back to the Stores page with the new store listed in their account. For custom website integrations, the modal asks for API credentials such as a store URL and API key. Once they confirm, the application validates the credentials, shows a success message, and adds the store to the list.

### Syncing and Viewing Products

From the sidebar, choosing Products takes the user to a table view of all aggregated product listings. A Sync Products button at the top triggers a request to an API route that calls each connected platform module in turn. While syncing, a loading indicator appears and the button is disabled. When the process finishes, the table reloads to show the latest items. Each row displays product name, SKU, source platform, and stock level. Clicking a row opens a detailed product page where the user can edit local mapping details, adjust pricing rules, and manually refresh this single item by hitting a Refresh button. After editing, a Save button updates the local database and gives a confirmation toast.

### Managing Orders

Selecting Orders navigates the user to a similar table that lists every order across all stores. The page shows columns for order number, date, customer name, platform, and status. A Sync Orders button at the top refreshes new order data in the same way as products. When a user clicks an order row, an Order Detail page appears with full information such as items purchased, shipping address, and platform-specific notes. On this page, users can change the local fulfillment status and leave internal comments. Saving these updates writes back to the local database; it does not modify the original marketplace data.

### Viewing Analytics

The Analytics page features interactive charts that display aggregated sales and order trends over time. By default, it shows a line graph of daily revenue for the past month. Above the chart, date range selectors and a platform filter allow users to refine the view. Changing these parameters triggers a data fetch from the analytics API route, and the graph re-renders with updated metrics. Hovering over data points shows a tooltip with exact values. Users can also switch between chart types, such as bar or pie, using a tabbed menu.

### Editing Profile and Account Details

In the Settings area, the Profile tab shows the user’s basic information like name and email. An Edit button reveals a form where they can update their name, change their email, or upload a new avatar image. A separate Change Password section lets the user enter their current password, then choose and confirm a new one. Submitting the form validates input on the server and returns the user to the Profile view with a success message.

### Managing Subscriptions and Billing

Under the Billing tab in Settings, users see their current plan, renewal date, and payment method. A Change Plan button opens a page listing available subscription tiers. Selecting a new tier and confirming takes the user through a secure payment process handled by the integrated billing service. Once complete, they return to the Billing page with updated subscription details and next billing date.

## Settings and Account Management

The Settings section combines all account and application preferences in one place. Aside from Profile and Billing, a Notifications tab lets users toggle email alerts for events such as new orders or sync failures. Saving preferences writes the choices to their profile and immediately takes them back to the Settings overview. A Link to return to the Dashboard is always visible at the top of the sidebar.

## Error States and Alternate Paths

If a user attempts to sign in with incorrect credentials, the Sign In page displays a clear error message above the form and shakes the input fields to draw attention. During API sync operations, network failures show a dismissible banner at the top of the page with an option to retry. If the user tries to access a protected route without signing in, they are automatically redirected to the Sign In page with a notice prompting them to log in first. Any attempt to navigate to a non-existent route leads to a custom 404 page that offers a link back to the Dashboard or Home. Validation errors on forms highlight the invalid fields in red and display a text explanation below each input.

## Conclusion and Overall App Journey

Starting from the moment a newcomer lands on the welcome page, the journey flows smoothly through account creation, email confirmation, and secure sign-in. Once inside, the user arrives at a dashboard that unifies navigation to all key functions: connecting stores, syncing products, managing orders, and reviewing analytics. Settings provide easy management of personal details, notifications, and subscription billing. Throughout their daily use, users will rely on the responsive tables, interactive charts, and clear error feedback to keep every connected marketplace in sync. This structured path from sign-up to daily operations ensures that store managers can focus on their core business rather than wrestling with multiple interfaces.