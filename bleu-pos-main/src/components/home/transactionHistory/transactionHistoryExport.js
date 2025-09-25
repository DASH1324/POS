import React from 'react';
import './transactionHistoryExport.css';
import logo from '../../../assets/logo.png';

const TransactionHistoryExport = () => {
  const transactions = [
    {
      id: 'SO-10',
      date: '9/21/2025',
      cashier: 'POScashier2',
      orderType: 'Take out',
      items: 1,
      discounts: 'Discount Applied',
      total: '₱256.00',
      paymentMethod: 'GCash',
      status: 'Completed'
    },
    {
      id: 'SO-9',
      date: '9/21/2025',
      cashier: 'cashierPOS',
      orderType: 'Dine in',
      items: 2,
      discounts: 'None',
      total: '₱120.00',
      paymentMethod: 'Cash',
      status: 'Processing'
    },
    {
      id: 'SO-8',
      date: '9/21/2025',
      cashier: 'POSadmin2',
      orderType: 'Take out',
      items: 1,
      discounts: 'Discount Applied',
      total: '₱168.00',
      paymentMethod: 'GCash',
      status: 'Processing'
    },
    {
      id: 'SO-7',
      date: '9/21/2025',
      cashier: 'POScashier2',
      orderType: 'Dine in',
      items: 2,
      discounts: 'None',
      total: '₱330.00',
      paymentMethod: 'Cash',
      status: 'Completed'
    },
    {
      id: 'SO-6',
      date: '9/21/2025',
      cashier: 'cashierPOS',
      orderType: 'Dine in',
      items: 1,
      discounts: 'None',
      total: '₱99.00',
      paymentMethod: 'GCash',
      status: 'Completed'
    },
    {
      id: 'SO-5',
      date: '9/21/2025',
      cashier: 'POSadmin2',
      orderType: 'Dine in',
      items: 2,
      discounts: 'None',
      total: '₱120.00',
      paymentMethod: 'Cash',
      status: 'Completed'
    },
    {
      id: 'SO-4',
      date: '9/21/2025',
      cashier: 'POScashier2',
      orderType: 'Dine in',
      items: 1,
      discounts: 'None',
      total: '₱110.00',
      paymentMethod: 'GCash',
      status: 'Completed'
    },
    {
      id: 'SO-3',
      date: '9/20/2025',
      cashier: 'cashierPOS',
      orderType: 'Dine in',
      items: 2,
      discounts: 'None',
      total: '₱180.00',
      paymentMethod: 'Cash',
      status: 'Completed'
    },
    {
      id: 'SO-2',
      date: '9/20/2025',
      cashier: 'POSadmin2',
      orderType: 'Dine in',
      items: 1,
      discounts: 'None',
      total: '₱69.00',
      paymentMethod: 'GCash',
      status: 'Processing'
    },
    {
      id: 'SO-1',
      date: '9/20/2025',
      cashier: 'POScashier2',
      orderType: 'Dine in',
      items: 2,
      discounts: 'Discount Applied',
      total: '₱144.00',
      paymentMethod: 'Cash',
      status: 'Completed'
    }
  ];

  const currentDate = new Date();
  const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear()}, ${currentDate.getHours()}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')} ${currentDate.getHours() >= 12 ? 'PM' : 'AM'}`;

  return (
    <div className="transaction-history-container">
      {/* Header Section */}
      <div className="header-section">
        <div className="logo-section">
          <div className="logo">
            <img src={logo} alt="Bleu Bean Cafe Logo" className="logo-image" />
          </div>
        </div>
        <div className="title-section">
          <h1 className="report-title">Transaction History - Store</h1>
          <div className="report-info">
            <p>Generated on: {formattedDate}</p>
            <p>Transaction Date Range: All Dates</p>
            <p>Status: Completed</p>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="table-container">
        <table className="transaction-table">
          <thead>
            <tr className="table-header">
              <th>Transaction ID</th>
              <th>Date</th>
              <th>Cashier</th>
              <th>Order Type</th>
              <th>Item(s)</th>
              <th>Discounts</th>
              <th>Total</th>
              <th>Payment Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr key={transaction.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{transaction.id}</td>
                <td>{transaction.date}</td>
                <td>{transaction.cashier}</td>
                <td>{transaction.orderType}</td>
                <td>{transaction.items}</td>
                <td>{transaction.discounts}</td>
                <td>{transaction.total}</td>
                <td>{transaction.paymentMethod}</td>
                <td>{transaction.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="summary-section">
        <h2 className="summary-title">Transaction History Summary</h2>
        <div className="summary-info">
          <p>Total Transactions: {transactions.length}</p>
          <p>Total Sales: ₱{transactions.reduce((sum, transaction) => {
            const amount = parseFloat(transaction.total.replace('₱', '').replace(',', ''));
            return sum + amount;
          }, 0).toFixed(2)}</p>
          <p>Total Items: {transactions.reduce((sum, transaction) => sum + transaction.items, 0)}</p>
          <p>Total Discount Applied: {transactions.filter(t => t.discounts === 'Discount Applied').length}</p>
          <p>Promotion Applied: 0</p>
          <p>Generated by: Admin</p>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryExport;
