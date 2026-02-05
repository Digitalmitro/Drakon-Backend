# ShipStation and Stripe Integration Updates

## Summary
This document describes the backend changes applied to fix ShipStation Custom Store status mapping, shipping details, and shipnotify handling after Stripe payment.

## Changes Made

### 1) Custom Store OrderStatus mapping
- Updated the Custom Store feed to map statuses using configurable, case-sensitive values.
- Prioritizes `paymentStatus` over `orderStatus` to reflect paid orders immediately.
- Files:
  - Drakon-Backend/controllers/shipstationController.js
  - Drakon-Backend/controllers/orderController.js

**New environment variables (exact match required):**
- `SHIPSTATION_CUSTOMSTORE_PAID_STATUS`
- `SHIPSTATION_CUSTOMSTORE_UNPAID_STATUS`
- Optional:
  - `SHIPSTATION_CUSTOMSTORE_SHIPPED_STATUS`
  - `SHIPSTATION_CUSTOMSTORE_CANCELLED_STATUS`
  - `SHIPSTATION_CUSTOMSTORE_ON_HOLD_STATUS`

### 2) Shipping data in order feed
- Added `Weight` and `WeightUnits` per item when item weight exists.
- Uses `weightUnits` from the order item if present, otherwise defaults to `Pounds`.
- Files:
  - Drakon-Backend/controllers/shipstationController.js
  - Drakon-Backend/controllers/orderController.js

### 3) Order creation now stores shipping method and weight units
- Order creation now accepts `shippingMethod` from the request body.
- Order items accept optional `weightUnits`.
- Files:
  - Drakon-Backend/controllers/orderController.js
  - Drakon-Backend/models/Order.js

### 4) Stripe payment confirmation updates orders
- `/api/stripe/confirm` now updates the order to `paymentStatus: "Paid"` when `orderId` or `orderNumber` is provided.
- Updates `lastModified` to force ShipStation re-import to pick up paid status.
- File:
  - Drakon-Backend/controllers/stripeController.js

### 5) Shipnotify endpoint for Custom Store
- Added `POST /api/shipstation/shipnotify` with Basic Auth and XML parsing.
- Updates the order to `Shipped`, sets `shippingMethod`, and persists `trackingNumber`.
- Files:
  - Drakon-Backend/controllers/shipstationController.js
  - Drakon-Backend/routes/shipstationRoutes.js
  - Drakon-Backend/models/Order.js

## Expected Behavior After Deployment
- Paid Stripe orders should appear in ShipStation as paid and move to Awaiting Shipment, provided the ShipStation Paid/Unpaid status values match the environment variables above.
- Shipping method and weights are included in the Custom Store feed to allow ShipStation service mapping and label creation.
- ShipStation shipnotify POSTs update orders to Shipped and store tracking numbers.

## Notes
- If ShipStation uses a different Custom Store URL, confirm it points to:
  - `GET /api/shipstation/orders`
  - `POST /api/shipstation/shipnotify`
- Basic Auth uses `SHIPSTATION_USERNAME` and `SHIPSTATION_PASSWORD` for these endpoints.
