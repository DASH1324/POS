// FILE: orders.js

import React, { useState, useEffect, useCallback } from "react";
import "./orders.css";
import Navbar from "../navbar";
import DataTable from "react-data-table-component";
import OrderPanel from "./orderPanel";

const SALES_API_BASE_URL = 'http://127.0.0.1:9000';
const ONLINE_API_BASE_URL = 'http://127.0.0.1:7004';
const AUTH_API_BASE_URL = 'http://127.0.0.1:4000';

function Orders() {
  const [activeTab, setActiveTab] = useState("store");
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [username, setUsername] = useState('');
  const [storeOrders, setStoreOrders] = useState([]);
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const storedUsername = localStorage.getItem('username'); 
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const getLocalDateString = useCallback((date) => {
    if (!(date instanceof Date) || isNaN(date)) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  
  const getTodayLocalDate = useCallback(() => getLocalDateString(new Date()), [getLocalDateString]);

  const fetchOrders = useCallback(async () => {
    if (storeOrders.length === 0 && onlineOrders.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error("Authentication error: You must be logged in to view orders.");
      const headers = { 'Authorization': `Bearer ${token}` };
      const [storeResponse, onlineResponse] = await Promise.allSettled([
        fetch(`${SALES_API_BASE_URL}/auth/purchase_orders/status/processing`, { headers }),
        fetch(`${ONLINE_API_BASE_URL}/cart/admin/orders/manage`, { headers })
      ]);
      let newStoreOrders = [];
      let newOnlineOrders = [];
      let errors = [];
      if (storeResponse.status === 'fulfilled' && storeResponse.value.ok) {
        const data = await storeResponse.value.json();
        const orders = Array.isArray(data) ? data : [];
        newStoreOrders = orders.map(order => ({
            id: order.id, customerName: 'In-Store', date: new Date(order.date), orderType: order.orderType,
            paymentMethod: order.paymentMethod || 'N/A', total: order.total, status: order.status ? order.status.toUpperCase() : 'UNKNOWN',
            items: order.orderItems ? order.orderItems.reduce((acc, item) => acc + item.quantity, 0) : 0,
            orderItems: order.orderItems ? order.orderItems.map(item => ({...item, size: item.size || 'Standard', extras: item.extras || []})) : [],
            source: 'store',
          })).filter(o => o.orderType === 'Dine in' || o.orderType === 'Take out');
      } else {
        errors.push("Failed to load store orders.");
        console.error("Store Order Fetch Error:", storeResponse.reason || (storeResponse.value && storeResponse.value.statusText));
      }
      if (onlineResponse.status === 'fulfilled' && onlineResponse.value.ok) {
        const data = await onlineResponse.value.json();
        const orders = Array.isArray(data) ? data : [];
        newOnlineOrders = orders.map(order => {
            const parseOnlineItems = (itemString, total) => {
                if (!itemString) return { items: [], totalQuantity: 0 };
                const items = itemString.split(',').map(part => {
                    const match = part.trim().match(/(.+) \(x(\d+)\)/);
                    if (match) return { name: match[1].trim(), quantity: parseInt(match[2], 10), price: 0, category: 'online-order', addons: {} };
                    return null;
                }).filter(Boolean);
                const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                if (items.length === 0) return { items: [{ name: itemString, quantity: 1, price: total, category: 'online-order', addons: {} }], totalQuantity: 1 };
                return { items, totalQuantity };
            };
            const { items: parsedItems, totalQuantity } = parseOnlineItems(order.items, order.total_amount);
            return {
              id: order.order_id, customerName: order.customer_name, date: new Date(order.order_date),
              orderType: order.order_type, paymentMethod: order.payment_method, total: order.total_amount,
              status: order.order_status ? order.order_status.toUpperCase() : 'UNKNOWN',
              items: totalQuantity, orderItems: parsedItems, source: 'online',
            };
        });
      } else {
        errors.push("Failed to load online orders.");
        console.error("Online Order Fetch Error:", onlineResponse.reason || (onlineResponse.value && onlineResponse.value.statusText));
      }
      if (errors.length > 0) setError(errors.join(' '));
      const processAndSort = (orders) => orders.map(o => ({ ...o, localDateString: getLocalDateString(o.date), dateDisplay: o.date.toLocaleString("en-US", { month: "long", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })})).sort((a, b) => b.date - a.date);
      setStoreOrders(processAndSort(newStoreOrders));
      setOnlineOrders(processAndSort(newOnlineOrders));
    } catch (e) {
      console.error("Failed to fetch orders:", e);
      setError(e.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [getLocalDateString, storeOrders.length, onlineOrders.length]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const storeColumns = [
    { name: "ORDER ID", selector: (row) => row.id, sortable: true, width: "25%" }, { name: "DATE & TIME", selector: (row) => row.dateDisplay, sortable: true, width: "30%" },
    { name: "ITEMS", selector: (row) => `${row.items} Items`, sortable: true, width: "15%" }, { name: "TOTAL", selector: (row) => `₱${row.total.toFixed(2)}`, sortable: true, width: "15%" },
    { name: "STATUS", selector: (row) => row.status, cell: (row) => (<span className={`orderpanel-status-badge orderpanel-${row.status.toLowerCase().replace(/\s+/g, '')}`}>{row.status}</span>), width: "15%" },
  ];
  const onlineColumns = [
    { name: "ORDER ID", selector: (row) => row.id, sortable: true, width: "15%" }, { name: "CUSTOMER", selector: (row) => row.customerName, sortable: true, width: "20%" },
    { name: "DATE & TIME", selector: (row) => row.dateDisplay, sortable: true, width: "25%" }, { name: "TOTAL", selector: (row) => `₱${row.total.toFixed(2)}`, sortable: true, width: "15%" },
    { name: "TYPE", selector: (row) => row.orderType, sortable: true, width: "10%" }, { name: "STATUS", selector: (row) => row.status, cell: (row) => (<span className={`orderpanel-status-badge orderpanel-${row.status.toLowerCase().replace(/\s+/g, '')}`}>{row.status}</span>), width: "15%" },
  ];

  const handleUpdateStatus = async (orderToUpdate, newStatus, details) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert("Authentication error. Please log in again.");
      return;
    }
    
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // --- Corrected Cancellation Flow ---
   if (newStatus === 'CANCELLED' && details && details.pin) {
      try {
        // --- THIS IS THE FIX ---
        // The URL must match the router prefix in your users.py file.
        const pinResponse = await fetch(`${AUTH_API_BASE_URL}/users/verify-pin`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ pin: details.pin })
        });
        
        const pinData = await pinResponse.json();
        if (!pinResponse.ok) {
          throw new Error(pinData.detail || "Invalid Manager PIN.");
        }
        
        // Step 2: If PIN is valid, use the VERIFIED username to cancel the order
        const verifiedManagerUsername = pinData.managerUsername;
        const cancelUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/status`;
        const cancelBody = JSON.stringify({
          newStatus: 'cancelled',
          cancelDetails: {
            managerUsername: verifiedManagerUsername,
          }
        });
        
        const cancelResponse = await fetch(cancelUrl, { method: 'PATCH', headers, body: cancelBody });
        const cancelData = await cancelResponse.json();
        if (!cancelResponse.ok) {
          throw new Error(cancelData.detail || "Failed to cancel the order.");
        }
        alert(cancelData.message || "Order successfully cancelled!");
      } catch (err) {
        console.error("Cancellation Error:", err);
        alert(`Error: ${err.message}`);
      }
    } else {
      // --- Flow for all other status updates (Unchanged) ---
      let url, body;
      if (orderToUpdate.source === 'store') {
          url = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/status`;
          body = JSON.stringify({ newStatus: newStatus.toLowerCase() });
      } else if (orderToUpdate.source === 'online') {
          url = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
          body = JSON.stringify({ new_status: newStatus });
      } else {
          alert("Cannot update order: Unknown source.");
          return;
      }
      try {
          const response = await fetch(url, { method: 'PATCH', headers, body });
          const responseData = await response.json();
          if (!response.ok) {
            throw new Error(responseData.detail || 'Failed to update order status.');
          }
          alert(responseData.message || "Order status updated successfully!");
      } catch (err) {
          console.error("Error updating status:", err);
          alert(`Error: ${err.message}`);
      }
    }

    // After any update, refresh all orders and UI state
    await fetchOrders();
    setSelectedOrder(prev => prev && prev.id === orderToUpdate.id ? { ...prev, status: newStatus.toUpperCase() } : null);
  };

  const ordersData = activeTab === "store" ? storeOrders : onlineOrders;
  const filteredData = ordersData.filter(order => {
    const text = searchText.toLowerCase();
    const matchesSearch = String(order.id).toLowerCase().includes(text) || (order.dateDisplay && order.dateDisplay.toLowerCase().includes(text)) || (order.customerName && order.customerName.toLowerCase().includes(text)) || order.status.toLowerCase().includes(text);
    const matchesDate = filterDate ? order.localDateString === filterDate : true;
    const matchesStatus = filterStatus ? order.status === filterStatus : true;
    return matchesSearch && matchesDate && matchesStatus;
  });

  const clearFilters = () => { setSearchText(""); setFilterDate(getTodayLocalDate()); setFilterStatus(""); };
  const handleTabChange = (tab) => { setActiveTab(tab); clearFilters(); setSelectedOrder(null); };
  useEffect(() => { if (filteredData.length > 0) { if (!selectedOrder || !filteredData.find(o => o.id === selectedOrder.id)) { setSelectedOrder(filteredData[0]); } } else { setSelectedOrder(null); } }, [filteredData, selectedOrder]);
  useEffect(() => { const getMostRecentOrderDate = (orders) => { if (!orders || orders.length === 0) return null; return orders[0].localDateString; }; const currentOrders = activeTab === "store" ? storeOrders : onlineOrders; if (currentOrders.length > 0) { const mostRecentDate = getMostRecentOrderDate(currentOrders); setFilterDate(mostRecentDate); } else { setFilterDate(getTodayLocalDate()); } }, [activeTab, storeOrders, onlineOrders, getTodayLocalDate]);

  return (
    <div className="orders-main-container">
      <Navbar isOrderPanelOpen={true} username={username} />
      <div className="orders-content-container orders-panel-open">
        <div className="orders-tab-container">
          <button className={`orders-tab ${activeTab === "store" ? "active" : ""}`} onClick={() => handleTabChange("store")}>Store</button>
          <button className={`orders-tab ${activeTab === "online" ? "active" : ""}`} onClick={() => handleTabChange("online")}>Online</button>
        </div>
        <div className="orders-filter-bar">
          <input type="text" placeholder="Search..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="orders-filter-input" />
          <input type="date" value={filterDate || ''} onChange={(e) => setFilterDate(e.target.value)} className="orders-filter-input" max={getTodayLocalDate()} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="orders-filter-input">
            <option value="">All Status</option>
            {activeTab === 'store' ? (<> <option value="COMPLETED">Completed</option> <option value="PROCESSING">Processing</option> <option value="CANCELLED">Cancelled</option> </>) : (<> <option value="PENDING">Pending</option> <option value="PREPARING">Preparing</option> <option value="DELIVERED">Delivered</option> <option value="CANCELLED">Cancelled</option> </>)}
          </select>
          <button className="orders-clear-btn" onClick={clearFilters}>Clear Filters</button>
        </div>
        <div className="orders-table-container">
          {loading && ordersData.length === 0 ? (<div className="orders-message-container">Loading orders...</div>) : error && ordersData.length === 0 ? (<div className="orders-message-container orders-error">{error}</div>) : (
            <DataTable
              columns={activeTab === 'store' ? storeColumns : onlineColumns}
              data={filteredData}
              pagination highlightOnHover responsive fixedHeader fixedHeaderScrollHeight="60vh"
              conditionalRowStyles={[{ when: row => row.id === selectedOrder?.id, style: { backgroundColor: "#e9f9ff", boxShadow: "inset 0 0 0 1px #2a9fbf" } }]}
              onRowClicked={(row) => setSelectedOrder(row)}
              noDataComponent={<div className="orders-message-container">{`No ${activeTab} orders found for the selected filters.`}</div>}
              customStyles={{ headCells: { style: { backgroundColor: "#4B929D", color: "#fff", fontWeight: "600", fontSize: "14px", padding: "15px", textTransform: "uppercase", letterSpacing: "1px" } }, rows: { style: { minHeight: "60px", padding: "10px", fontSize: "14px", color: "#333" } }, cells: { style: { fontSize: "14px" } }, }}
            />
          )}
        </div>
        {selectedOrder && ( <OrderPanel order={selectedOrder} isOpen={true} onClose={() => setSelectedOrder(null)} isStore={selectedOrder.source === 'store'} onUpdateStatus={handleUpdateStatus} /> )}
      </div>
    </div>
  );
}

export default Orders;