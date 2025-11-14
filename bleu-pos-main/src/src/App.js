import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StyleSheetManager } from 'styled-components';
import isPropValid from '@emotion/is-prop-valid';
import NotificationModal from './components/NotificationModal';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

//home: admin & manager
import Dashboard from './components/home/dashboard/dashboard';
import SalesMonitoring from './components/home/salesMonitoring/salesMonitoring';
import TransactionHistory from './components/home/transactionHistory/transactionHistory';
import Products from './components/home/products/products';
import Discounts from './components/home/discounts/discounts';
import SalesReport from './components/home/salesReport/salesReport'
// import TransactionReports from './components/home/transactionReport/transactionReport';
import TransactionHistoryExport from './components/home/transactionHistory/transactionHistoryExport';
import Spillage from './components/home/spillage/spillage';

//cashier
import Menu from './components/cashier/menu';
import Orders from './components/cashier/orders';
import OrderPanel from './components/cashier/orderPanel';
import CashierSales from './components/cashier/cashierSales';
// import CashierSpillage from './components/cashier/cashierSpillage';

import ActivityLogs from './components/home/activityLogs/activityLogs';


function RedirectToLoginSystem() {
  useEffect(() => {
    window.location.href = 'http://localhost:4002/';
  }, []);

  return null;
}

function App() {
  const [notifications, setNotifications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const wsRef = useRef(null);
  const audioRef = useRef(null); // Add audio ref
  const userInteractedRef = useRef(false); // Track if user has interacted

  // Initialize audio on component mount
  useEffect(() => {
    audioRef.current = new Audio('/Notif.mp3');
    audioRef.current.volume = 0.8;
    
    // Mark that user has interacted when they click anywhere
    const handleInteraction = () => {
      userInteractedRef.current = true;
      // Try to load the audio
      audioRef.current.load();
      document.removeEventListener('click', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  // Fetch initial notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:9004/notifications/');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // WebSocket connection
  useEffect(() => {
    fetchNotifications();

    // Establish WebSocket connection
    const ws = new WebSocket('ws://localhost:9004/ws/notifications');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      switch (data.type) {
        case 'new_notification':
          // Add new notification to the list
          setNotifications(prev => [data.payload, ...prev]);
          
          // Play sound if user has interacted
          if (userInteractedRef.current && audioRef.current) {
            audioRef.current.play()
              .then(() => console.log('🔊 Notification sound played'))
              .catch(err => console.error('Error playing sound:', err));
          } else {
            console.log('⚠️ Cannot play sound - user needs to interact with page first');
          }
          break;

        case 'notification_read':
          // Update notification as read
          setNotifications(prev =>
            prev.map(notif =>
              notif.NotificationID === data.payload.NotificationID
                ? { ...notif, IsRead: true }
                : notif
            )
          );
          break;

        case 'notification_done':
          // Remove notification marked as done
          setNotifications(prev =>
            prev.filter(notif => notif.NotificationID !== data.payload.NotificationID)
          );
          break;

        case 'notifications_read_all':
          // Mark all as read
          setNotifications(prev =>
            prev.map(notif => ({ ...notif, IsRead: true }))
          );
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('http://localhost:9004/notifications/read-all', {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }
      
      // WebSocket will broadcast the update
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  // Make these available globally for your header component
  useEffect(() => {
    window.notificationState = {
      notifications,
      unreadCount,
      openModal: () => setIsModalOpen(true),
      closeModal: () => setIsModalOpen(false)
    };
  }, [notifications, unreadCount]);

  return (
    <StyleSheetManager shouldForwardProp={isPropValid}>
      <Router>
        {/* Notification Modal - No bell here, use your existing bell */}
        <NotificationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          notifications={notifications}
          onMarkAllAsRead={handleMarkAllAsRead}
        />

        {/* Existing Routes */}
        <Routes>
          <Route path="/" element={<RedirectToLoginSystem />} />
        
          {/*Admin & Manager*/}
          <Route path="/home/dashboard" element={<Dashboard />} />
          <Route path="/home/salesMonitoring" element={<SalesMonitoring />} />
          <Route path="/home/products" element={<Products />} />
          <Route path="/home/discounts" element={<Discounts />} />
          <Route path="/home/salesReport" element={<SalesReport />} />
          <Route path="/home/transactionHistory" element={<TransactionHistory />} />
          {/* <Route path="/home/transactionReport" element={<TransactionReports />} /> */}
          <Route path="/home/spillage" element={<Spillage />} />

          {/*Cashier*/}
          <Route path="/cashier/menu" element={<Menu />} />
          <Route path="/cashier/orders" element={<Orders />} />
          <Route path="/cashier/orderPanel" element={<OrderPanel />} />
          <Route path="/cashier/cashierSales" element={<CashierSales />} />
          {/* <Route path="/cashier/cashierSpillage" element={<CashierSpillage />} /> */}
          <Route path="/home/activityLogs" element={<ActivityLogs />} />

        </Routes>

        <ToastContainer
          position="top-right"
          autoClose={3000}        // 3 seconds
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
        
      </Router>
    </StyleSheetManager>
  );
}

export default App;