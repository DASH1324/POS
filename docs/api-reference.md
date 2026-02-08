# API Reference

This document provides detailed API documentation for all microservices in the Bleu POS System.

## Service Overview

| Service | Port | Base URL | Description |
|---------|------|----------|-------------|
| SalesServices | 9000 | `http://localhost:9000` | Sales and order management |
| BlockchainServices | 9005 | `http://localhost:9005` | Blockchain logging |
| DiscountServices | 7003 | `http://localhost:7003` | Discount management |
| NotificationServices | 9004 | `http://localhost:9004` | Notifications |
| ReceiptServices | 9003 | `http://localhost:9003` | Receipt generation |
| SessionServices | 9001 | `http://localhost:9001` | Session management |
| WasteServices | 9002 | `http://localhost:9002` | Waste tracking |

## Authentication

All API endpoints require JWT authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

## Sales Services API

### Create Sale
**POST** `/auth/sales/`

Creates a new sales transaction.

**Request Body:**
```json
{
  "cartItems": [
    {
      "id": 1,
      "name": "Americano",
      "quantity": 2,
      "price": 3.50,
      "category": "Coffee",
      "addons": [
        {
          "addonId": 1,
          "addonName": "Extra Shot",
          "price": 1.00,
          "quantity": 1
        }
      ]
    }
  ],
  "orderType": "dine-in",
  "paymentMethod": "cash",
  "appliedDiscounts": [
    {
      "discountName": "Student Discount",
      "discountId": 1,
      "itemDiscounts": [
        {
          "itemIndex": 0,
          "quantity": 1,
          "discountAmount": 0.50
        }
      ]
    }
  ],
  "appliedPromotions": [
    {
      "promotionName": "Buy 1 Get 1",
      "promotionId": 2,
      "itemPromotions": [
        {
          "itemIndex": 0,
          "quantity": 1,
          "promotionAmount": 1.75
        }
      ]
    }
  ],
  "promotionalDiscountAmount": 0.0,
  "manualDiscountAmount": 0.0,
  "gcashReference": null
}
```

**Response:**
```json
{
  "saleId": 123,
  "subtotal": 8.50,
  "discountAmount": 0.50,
  "finalTotal": 8.00
}
```

### Get Orders by Status
**GET** `/auth/sales/status/{status}`

Retrieves orders filtered by status.

**Parameters:**
- `status`: Order status (processing, completed, cancelled)

**Response:**
```json
[
  {
    "id": 123,
    "orderType": "dine-in",
    "paymentMethod": "cash",
    "date": "2024-01-15T10:30:00",
    "status": "processing",
    "cashierName": "john_doe",
    "gcashReference": null,
    "orderItems": [
      {
        "saleItemId": 456,
        "name": "Americano",
        "quantity": 2,
        "price": 3.50,
        "category": "Coffee",
        "addons": [],
        "itemDiscounts": [],
        "itemPromotions": []
      }
    ],
    "subtotal": 7.00,
    "addOns": 0.0,
    "promotionalDiscount": 0.0,
    "manualDiscount": 0.0,
    "total": 7.00
  }
]
```

## Discount Services API

### Create Discount
**POST** `/discounts/`

Creates a new discount.

**Request Body:**
```json
{
  "discountName": "Student Discount",
  "applicationType": "all_products",
  "selectedCategories": [],
  "selectedProducts": [],
  "discountType": "percentage",
  "discountValue": 10.0,
  "minSpend": 5.00,
  "validFrom": "2024-01-01",
  "validTo": "2024-12-31",
  "status": "active"
}
```

### Get All Discounts
**GET** `/discounts/`

Retrieves all discounts.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Student Discount",
    "application": "All Products",
    "discount": "10.0%",
    "minSpend": 5.0,
    "validFrom": "2024-01-01",
    "validTo": "2024-12-31",
    "status": "active",
    "type": "percentage",
    "application_type": "all_products",
    "applicable_products": [],
    "applicable_categories": []
  }
]
```

### Update Discount
**PUT** `/discounts/{discount_id}`

Updates an existing discount.

### Delete Discount
**DELETE** `/discounts/{discount_id}`

Soft deletes a discount.

### Get Available Products
**GET** `/available-products`

Retrieves products available for discount application.

**Response:**
```json
[
  {
    "ProductName": "Americano"
  }
]
```

### Get Available Categories
**GET** `/available-categories`

Retrieves categories available for discount application.

**Response:**
```json
[
  {
    "name": "Coffee"
  }
]
```

## Blockchain Services API

### Log to Blockchain
**POST** `/blockchain/log`

Logs an operation to the blockchain.

**Request Body:**
```json
{
  "service_identifier": "SALES_SERVICE",
  "action": "CREATE",
  "entity_type": "Sale",
  "entity_id": 123,
  "actor_username": "john_doe",
  "change_description": "Created new sale",
  "data": {
    "sale_id": 123,
    "total": 15.50
  }
}
```

### Get Blockchain Logs
**GET** `/blockchain-logs/`

Retrieves blockchain activity logs.

## Notification Services API

### Get Notifications
**GET** `/notifications/`

Retrieves all notifications.

### Mark All as Read
**PATCH** `/notifications/read-all`

Marks all notifications as read.

### WebSocket Connection
**WS** `/ws/notifications`

Real-time notification updates.

**Message Types:**
- `new_notification`: New notification received
- `notification_read`: Notification marked as read
- `notification_done`: Notification completed
- `notifications_read_all`: All notifications read

## Receipt Services API

### Generate Receipt
**POST** `/receipts/generate`

Generates a receipt for a sale.

### Get Receipt
**GET** `/receipts/{receipt_id}`

Retrieves a specific receipt.

## Session Services API

### Start Session
**POST** `/sessions/start`

Starts a new cashier session.

### End Session
**POST** `/sessions/end`

Ends an active cashier session.

### Get Session Summary
**GET** `/sessions/{session_id}/summary`

Retrieves session performance summary.

## Waste Services API

### Log Waste
**POST** `/wastelogs/`

Logs a waste incident.

### Get Waste Logs
**GET** `/wastelogs/`

Retrieves waste logs with filtering options.

## Health Check Endpoints

All services provide health check endpoints:

### Basic Health
**GET** `/`

Returns basic service status.

**Response:**
```json
{
  "status": "ok",
  "message": "Service is running",
  "version": "1.0.0"
}
```

### Detailed Health
**GET** `/health`

Returns detailed health information including dependencies.

## Error Responses

### Standard Error Format
```json
{
  "detail": "Error description"
}
```

### Common HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error
- `503`: Service Unavailable

## Rate Limiting

API endpoints implement rate limiting to prevent abuse:
- Authenticated requests: 1000 per hour
- Health checks: Unlimited
- WebSocket connections: 10 per user

## Versioning

API versioning follows URL path versioning:
- Current version: v1 (no prefix)
- Future versions: `/v2/endpoint`

## Data Formats

- **Dates**: ISO 8601 format (`YYYY-MM-DD`)
- **Timestamps**: ISO 8601 with time (`YYYY-MM-DDTHH:MM:SS`)
- **Currency**: Decimal with 2 decimal places
- **Percentages**: Decimal representation

## Pagination

List endpoints support pagination:

**Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

**Response:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 50,
  "pages": 3
}
```

---

*For setup instructions, see the [Setup and Installation](./setup-installation.md) guide.*
