# E-commerce Service Boundaries Reference

## Service Responsibilities

| Service | Domain Owned | Port | Type |
| ------- | ------------ | ---- | ---- |
| **catalog-microservice** | Products, categories, attributes, media, pricing | 3372 | Core |
| **inventory-microservice** | Warehouses, stock levels, movements, reservations | 3373 | Core |
| **suppliers-microservice** | Supplier configs, supplier products, import jobs, category mappings | 3374 | Core |
| **orders-microservice** | Orders, order items, status history, shipments | 3375 | Core |
| **allegro-service** | Allegro offers, Allegro accounts, multi-account sync | 3403 | Channel |
| **flipflop** | Own e-commerce site — displays catalog, forwards orders | 3500 | Channel |
| **aukro-service** | Aukro marketplace integration (API-based) | 3376 | Channel |
| **heureka-service** | Heureka feed generation (XML/CSV export) | 3377 | Channel |
| **bazos-service** | Bazos classifieds integration | 3378 | Channel |

## Data Ownership Rules

| Data Entity | Owner Service | Notes |
| ----------- | ------------- | ----- |
| Products (title, description, brand, EAN, images) | catalog-microservice | Single source of truth; all other services reference by `product_id` |
| Categories & attribute definitions | catalog-microservice | |
| Pricing rules | catalog-microservice | |
| Warehouses | inventory-microservice | |
| Stock levels & reservations | inventory-microservice | `available = quantity - reserved` |
| Stock movement history | inventory-microservice | |
| Supplier credentials & mappings | suppliers-microservice | API credentials stored encrypted |
| Supplier product copies & import jobs | suppliers-microservice | Mapped to catalog `product_id` after import |
| Orders & order items | orders-microservice | References catalog `product_id`; channel recorded on order row |
| Allegro offers & accounts | allegro-service | Linked to catalog `product_id` |

## Event Bus Contracts (RabbitMQ)

| Event | Publisher | Subscribers | Payload fields |
| ----- | --------- | ----------- | -------------- |
| `stock.updated` | inventory-microservice | allegro-service, flipflop, aukro-service, heureka-service, bazos-service | `productId`, `sku`, `warehouseId`, `previousQuantity`, `newQuantity`, `available`, `reason`, `referenceId` |
| `stock.low` | inventory-microservice | notifications-microservice | `productId`, `warehouseId`, `quantity`, `reorderPoint` |
| `stock.out` | inventory-microservice | notifications-microservice, all channel services | `productId`, `warehouseId` |
| `order.created` | orders-microservice | inventory-microservice (reserve stock) | `orderId`, `channel`, `items[]` |
| `order.paid` | orders-microservice | notifications-microservice | `orderId` |
| `order.shipped` | orders-microservice | inventory-microservice (decrement), channel services | `orderId`, `shipmentId`, `trackingNumber` |
| `order.cancelled` | orders-microservice | inventory-microservice (release reservation) | `orderId` |

## Integration Matrix (inter-service calls)

| Caller | Calls | Reason |
| ------ | ----- | ------ |
| suppliers-microservice | catalog-microservice | Push imported products |
| suppliers-microservice | inventory-microservice | Push supplier stock levels |
| orders-microservice | inventory-microservice | Reserve / decrement stock |
| orders-microservice | payments-microservice | Payment processing |
| allegro-service | orders-microservice | Forward Allegro orders |
| flipflop | catalog-microservice | Read product data |
| flipflop | inventory-microservice | Read stock levels |
| flipflop | orders-microservice | Submit customer orders |
| All services | auth-microservice | JWT validation |
| All services | logging-microservice | Centralized logging |
| catalog-microservice | ai-microservice | AI descriptions & translations |
| suppliers-microservice | ai-microservice | Auto-map categories, translate descriptions |
| orders-microservice | notifications-microservice | Order confirmations, shipping alerts |
| inventory-microservice | notifications-microservice | Low-stock / out-of-stock alerts |

## Port Allocation

| Service | Port | Type |
| ------- | ---- | ---- |
| catalog-microservice | 3372 | New — Core |
| inventory-microservice | 3373 | New — Core |
| suppliers-microservice | 3374 | New — Core |
| orders-microservice | 3375 | New — Core |
| aukro-service | 3376 | New — Channel |
| heureka-service | 3377 | New — Channel |
| bazos-service | 3378 | New — Channel |
| allegro-service | 3403 | Existing — Channel |
| flipflop | 3500 | Existing — Channel |
| database-server (Postgres) | 5432 | Shared infra |
| database-server (Redis) | 6379 | Shared infra |
| logging-microservice | 3367 | Shared infra |
| notifications-microservice | 3368 | Shared infra |
| auth-microservice | 3370 | Shared infra |
| payments-microservice | 3468 | Shared infra |
| ai-microservice | 3380 | Shared infra |
