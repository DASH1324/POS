# User Guide

This guide explains how to use the Bleu POS (Point of Sale) System for cashiers, managers, and administrators.

## System Overview

The Bleu POS System is a comprehensive point-of-sale solution that handles sales transactions, inventory management, discounts, receipts, and more. It consists of a web-based interface accessible through a browser.

## User Roles

### Cashier
Cashiers handle day-to-day sales transactions, manage orders, and process payments.

### Manager/Administrator
Managers have access to advanced features including:
- Dashboard analytics
- Sales monitoring and reporting
- Product management
- Discount and promotion management
- Transaction history
- Activity logs
- Receipt management
- Waste/spillage tracking

## Getting Started

1. **Login**: Access the system through the login page (typically at `http://localhost:4002/`).
2. **Navigation**: Use the sidebar or navigation menu to access different sections.

## Cashier Functions

### Menu Management
- View available products organized by categories
- Add items to cart
- Apply discounts and promotions
- Calculate totals including tax

### Order Processing
- Create new orders
- Modify existing orders
- Cancel orders (with appropriate permissions)
- Process payments

### Session Management
- Start/end cashier sessions
- View session summaries
- Track sales performance

## Manager/Administrator Functions

### Dashboard
- Overview of key metrics (daily sales, top products, etc.)
- Real-time sales monitoring
- Quick access to recent transactions

### Sales Monitoring
- Detailed sales analytics
- Export sales reports
- Monitor performance by time periods

### Product Management
- Add/edit/delete products
- Manage inventory levels
- Update pricing

### Discount Management
- Create discount codes
- Set up promotions
- Manage discount validity periods

### Transaction History
- Search and filter transactions
- View detailed transaction information
- Export transaction data

### Activity Logs
- Monitor system activities
- Track user actions for audit purposes
- View blockchain-recorded activities

### Receipt Management
- Generate and print receipts
- Manage receipt templates
- Handle receipt reprints

### Waste/Spillage Tracking
- Log waste incidents
- Track spillage reports
- Generate waste management reports

## Notifications

The system includes a real-time notification system:
- New order alerts
- Low inventory warnings
- System status updates
- Custom notifications

## Blockchain Integration

Certain activities are logged to a blockchain for enhanced security and auditability. Users can view blockchain-verified transaction data through the Customer Blockchain View.

## Best Practices

1. **Always log out** when leaving the workstation
2. **Verify transactions** before processing payments
3. **Report issues** promptly using the notification system
4. **Keep sessions** active only during work hours
5. **Regular backups** are handled automatically by the system

## Troubleshooting

### Common Issues
- **Login problems**: Check network connection and credentials
- **Slow performance**: Clear browser cache or check system resources
- **Printer issues**: Verify printer connections and settings
- **Notification delays**: Check WebSocket connection status

### Support
For technical issues, contact your system administrator or refer to the developer documentation.

---

*For developer information, see the [Developer Guide](./developer-guide.md).*
