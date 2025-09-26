import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StyleSheetManager } from 'styled-components';
import isPropValid from '@emotion/is-prop-valid';

  //home: admin & manager
  import Dashboard from './components/home/dashboard/dashboard';
  import SalesMonitoring from './components/home/salesMonitoring/salesMonitoring';
  import TransactionHistory from './components/home/transactionHistory/transactionHistory';
  import Products from './components/home/products/products';
  import Discounts from './components/home/discounts/discounts';
  import SalesReport from './components/home/salesReport/salesReport'
  import TransactionReports from './components/home/transactionReport/transactionReport';
  import TransactionHistoryExport from './components/home/transactionHistory/transactionHistoryExport';
  import Spillage from './components/home/spillage/spillage';

  //cashier
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
      <StyleSheetManager shouldForwardProp={isPropValid}>
        <Router>
          <Routes>
            <Route path="/" element={<RedirectToLoginSystem />} />
          
            {/*Admin & Manager*/}
            <Route path="/home/dashboard" element={<Dashboard />} />
              <Route path="/home/salesMonitoring" element={<SalesMonitoring />} />
              <Route path="/home/products" element={<Products />} />
              <Route path="/home/discounts" element={<Discounts />} />
              <Route path="/home/salesReport" element={<SalesReport />} />
              <Route path="/home/transactionHistory" element={<TransactionHistory />} />
              <Route path="/home/transactionReport" element={<TransactionReports />} />
              <Route path="/home/transactionHistory" element={<TransactionHistoryExport />} />
              <Route path="/home/spillage" element={<Spillage />} />

              {/*Cashier*/}
              <Route path="/cashier/menu" element={<Menu />} />
              <Route path="/cashier/orders" element={<Orders />} />
              <Route path="/cashier/orderPanel" element={<OrderPanel />} />
              <Route path="/cashier/cashierSales" element={<CashierSales />} />
              <Route path="/cashier/cashierSpillage" element={<CashierSpillage />} />
          </Routes>
        </Router>
      </StyleSheetManager>
    );
  }

  export default App;