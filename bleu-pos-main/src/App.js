import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/admin/dashboard';
import SalesMonitoring from './components/admin/salesMon';
import TransactionHistory from './components/admin/transHis';
import Products from './components/admin/products';
import Discounts from './components/admin/discounts';
import SalesReports from './components/admin/salesRep';
import TransactionReports from './components/admin/transRep';
import Menu from './components/cashier/menu';
import Orders from './components/cashier/orders';
import OrderPanel from './components/cashier/orderPanel';
import CashierSales from './components/cashier/cashierSales';
import CashierSpillage from './components/cashier/cashierSpillage';

function RedirectToLoginSystem() {
  useEffect(() => {
    window.location.href = 'http://localhost:4002/';
  }, []);

  return null;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RedirectToLoginSystem />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/salesMon" element={<SalesMonitoring />} />
        <Route path="/admin/transHis" element={<TransactionHistory />} />
        <Route path="/admin/products" element={<Products />} />
        <Route path="/admin/discounts" element={<Discounts />} />
        <Route path="/admin/salesRep" element={<SalesReports />} />
        <Route path="/admin/transRep" element={<TransactionReports />} />
        <Route path="/cashier/menu" element={<Menu />} />
        <Route path="/cashier/orders" element={<Orders />} />
        <Route path="/cashier/orderPanel" element={<OrderPanel />} />
        <Route path="/cashier/cashierSales" element={<CashierSales />} />
        <Route path="/cashier/cashierSpillage" element={<CashierSpillage />} />
      </Routes>
    </Router>
  );
}

export default App;
