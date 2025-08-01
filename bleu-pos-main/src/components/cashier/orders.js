// FILE: orders.js

import React, { useState, useEffect, useCallback } from "react";
import "./orders.css";
import Navbar from "../navbar";
import DataTable from "react-data-table-component";
import OrderPanel from "./orderPanel";

const SALES_API_BASE_URL = 'http://127.0.0.1:9000';
const ONLINE_API_BASE_URL = 'http://127.0.0.1:7004';
const AUTH_API_BASE_URL = 'http://127.0.0.1:4000';
const INVENTORY_API_BASE_URL = 'http://127.0.0.1:8002'; // Added for inventory service

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
            const parsedItems = Array.isArray(order.items) ? order.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                size: item.size || 'Standard', 
                extras: item.extras || []
            })) : [];

            const totalQuantity = parsedItems.reduce((sum, item) => sum + item.quantity, 0);

            return {
                id: order.order_id,
                customerName: order.customer_name,
                date: new Date(order.order_date),
                orderType: order.order_type,
                paymentMethod: order.payment_method,
                total: order.total_amount,
                status: order.order_status ? order.order_status.toUpperCase() : 'UNKNOWN',
                items: totalQuantity,
                orderItems: parsedItems,
                source: 'online',
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

    // Handle order cancellation (requires PIN for store orders)
    if (newStatus === 'CANCELLED') {
        if (orderToUpdate.source === 'store' && details && details.pin) {
            try {
                const pinResponse = await fetch(`${AUTH_API_BASE_URL}/users/verify-pin`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ pin: details.pin })
                });
                const pinData = await pinResponse.json();
                if (!pinResponse.ok) throw new Error(pinData.detail || "Invalid Manager PIN.");

                const cancelUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/status`;
                const cancelBody = JSON.stringify({ newStatus: 'cancelled', cancelDetails: { managerUsername: pinData.managerUsername } });
                const cancelResponse = await fetch(cancelUrl, { method: 'PATCH', headers, body: cancelBody });
                if (!cancelResponse.ok) throw new Error((await cancelResponse.json()).detail || "Failed to cancel the store order.");
                
                alert("Store order successfully cancelled!");
            } catch (err) {
                console.error("Store Cancellation Error:", err);
                alert(`Error: ${err.message}`);
            }
        } else if (orderToUpdate.source === 'online') {
            // This path is for cancelling PENDING online orders
            try {
                const url = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
                const body = JSON.stringify({ new_status: newStatus });
                const response = await fetch(url, { method: 'PATCH', headers, body });
                if (!response.ok) throw new Error((await response.json()).detail || 'Failed to cancel online order.');
                
                alert("Online order successfully cancelled!");
            } catch (err) {
                console.error("Online Cancellation Error:", err);
                alert(`Error: ${err.message}`);
            }
        }
    
    // Handle all other status updates
    } else {
      // ** CHANGE: This block now includes inventory deduction **
      // SPECIAL WORKFLOW: Accepting an online order (PENDING -> PREPARING)
      if (orderToUpdate.source === 'online' && newStatus === 'PREPARING' && orderToUpdate.status === 'PENDING') {
        try {
          // Step 1: Post to POS and Deduct Inventory in parallel
          const posOrderPayload = {
            online_order_id: orderToUpdate.id,
            customer_name: orderToUpdate.customerName,
            order_type: orderToUpdate.orderType,
            payment_method: orderToUpdate.paymentMethod,
            subtotal: orderToUpdate.total,
            total_amount: orderToUpdate.total,
            status: 'processing',
            items: orderToUpdate.orderItems.map(item => ({ name: item.name, quantity: item.quantity, price: item.price, category: item.category || 'Online', addons: item.addons || {} }))
          };

          const deductionPayload = {
            cartItems: orderToUpdate.orderItems.map(item => ({ name: item.name, quantity: item.quantity }))
          };
          
          const [posResponse, ingredientsResponse, materialsResponse] = await Promise.allSettled([
              fetch(`${SALES_API_BASE_URL}/auth/purchase_orders/online-order`, { method: 'POST', headers, body: JSON.stringify(posOrderPayload) }),
              fetch(`${INVENTORY_API_BASE_URL}/ingredients/deduct-from-sale`, { method: 'POST', headers, body: JSON.stringify(deductionPayload) }),
              fetch(`${INVENTORY_API_BASE_URL}/materials/deduct-from-sale`, { method: 'POST', headers, body: JSON.stringify(deductionPayload) })
          ]);

          // Check for critical failure (POS system)
          if (posResponse.status === 'rejected' || !posResponse.value.ok) {
              const errorText = posResponse.status === 'fulfilled' ? await posResponse.value.text() : posResponse.reason;
              throw new Error(`Critical Error: Could not save to POS. ${errorText}`);
          }
          
          // Log non-critical failures (inventory)
          if (ingredientsResponse.status === 'rejected' || !ingredientsResponse.value.ok) console.error("Failed to deduct ingredients:", ingredientsResponse.status === 'fulfilled' ? await ingredientsResponse.value.text() : ingredientsResponse.reason);
          if (materialsResponse.status === 'rejected' || !materialsResponse.value.ok) console.error("Failed to deduct materials:", materialsResponse.status === 'fulfilled' ? await materialsResponse.value.text() : materialsResponse.reason);
          
          console.log("Order saved to POS and inventory deduction initiated.");
  
          // Step 2: Update the Online Order Status
          const onlineStatusUrl = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
          const onlineStatusBody = JSON.stringify({ new_status: newStatus }); // newStatus is 'PREPARING'
          const onlineResponse = await fetch(onlineStatusUrl, { method: 'PATCH', headers, body: onlineStatusBody });
          if (!onlineResponse.ok) throw new Error((await onlineResponse.json()).detail || 'POS/Inventory updated, but failed to update online order status.');
          
          alert("Order accepted and is now being prepared!");
  
        } catch (err) {
          console.error("Error accepting order:", err);
          alert(`Error: ${err.message}`);
        }
      // GENERAL WORKFLOW: For all other status changes
      } else {
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
            if (!response.ok) throw new Error((await response.json()).detail || 'Failed to update order status.');
            alert((await response.json()).message || "Order status updated successfully!");
        } catch (err) {
            console.error("Error updating status:", err);
            alert(`Error: ${err.message}`);
        }
      }
    }

    // Refresh data and UI after any operation
    await fetchOrders();
    setSelectedOrder(prev => prev && prev.id === orderToUpdate.id ? { ...prev, status: newStatus.toUpperCase() } : null);
  };

  const ordersData = activeTab === "store" ? storeOrders : onlineOrders;
  const filteredData = ordersData.filter(order => {
    const text = searchText.toLowerCase();
    const matchesSearch = String(order.id).toLowerCase().includes(text) || (order.dateDisplay && order.dateDisplay.toLowerCase().includes(text)) || (order.customerName && order.customerName.toLowerCase().includes(text)) || order.status.toLowerCase().includes(text);
    const matchesDate = filterDate ? order.localDateString === filterDate : true;
    const matchesStatus = filterStatus ? order.status.toUpperCase() === filterStatus.toUpperCase() : true;
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
            {activeTab === 'store' 
              ? (<> 
                  <option value="COMPLETED">Completed</option> 
                  <option value="PROCESSING">Processing</option> 
                  <option value="CANCELLED">Cancelled</option> 
                 </>) 
              : (<> 
                  <option value="PENDING">Pending</option> 
                  <option value="PREPARING">Preparing</option> 
                  <option value="WAITING FOR PICK UP">Waiting For Pick Up</option>
                  <option value="DELIVERING">Delivering</option>
                  <option value="COMPLETED">Completed</option> 
                  <option value="CANCELLED">Cancelled</option> 
                 </>)}
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