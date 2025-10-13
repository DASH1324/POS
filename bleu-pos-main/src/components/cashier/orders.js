import React, { useState, useEffect, useCallback } from "react";
import "./orders.css";
import Navbar from "../navbar";
import DataTable from "react-data-table-component";
import OrderPanel from "./orderPanel";
import { toast } from 'react-toastify';

const SALES_API_BASE_URL = 'http://127.0.0.1:9000';
const ONLINE_API_BASE_URL = 'http://127.0.0.1:7004';
const AUTH_API_BASE_URL = 'http://127.0.0.1:4000';
const INVENTORY_API_BASE_URL = 'http://127.0.0.1:8002';

function Orders() {
  const [activeTab, setActiveTab] = useState("store");
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState('');
  const [storeOrders, setStoreOrders] = useState([]);
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedUserRole = localStorage.getItem('userRole');
    if (storedUsername) {
      setUsername(storedUsername);
    }
    if (storedUserRole) {
      setUserRole(storedUserRole);
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

      const storeStatusesToFetch = ['processing', 'completed', 'cancelled', 'refunded'];
      const storeFetchPromises = storeStatusesToFetch.map(status =>
        fetch(`${SALES_API_BASE_URL}/auth/sales/status/${status}`, { headers })
      );

      const [onlineResponse, ...storeResponsesSettled] = await Promise.allSettled([
        fetch(`${ONLINE_API_BASE_URL}/cart/admin/orders/manage`, { headers }),
        ...storeFetchPromises
      ]);

      let newStoreOrders = [];
      let newOnlineOrders = [];
      let errors = [];

      // Process store orders
      for (const storeResponse of storeResponsesSettled) {
        if (storeResponse.status === 'fulfilled' && storeResponse.value.ok) {
          const data = await storeResponse.value.json();
          const orders = Array.isArray(data) ? data : [];
          const mappedOrders = orders.map(order => {
            return {
              id: order.id, 
              customerName: 'In-Store', 
              date: new Date(order.date), 
              orderType: order.orderType,
              paymentMethod: order.paymentMethod || 'N/A', 
              total: order.total, 
              status: order.status ? order.status.toUpperCase() : 'UNKNOWN',
              items: order.orderItems ? order.orderItems.reduce((acc, item) => acc + item.quantity, 0) : 0,
              orderItems: order.orderItems ? order.orderItems.map(item => ({
                ...item, 
                size: item.size || 'Standard', 
                addons: item.addons || []
              })) : [],
              source: 'store',
              discount: order.discount || order.appliedDiscount || 0,
              addOns: order.addOns || order.appliedAddOns || order.addons || 0,
              cashierName: order.cashierName || 'Unknown'
            };
          }).filter(o => o.orderType === 'Dine in' || o.orderType === 'Take out');
          
          newStoreOrders.push(...mappedOrders);
        } else {
          errors.push("Failed to load some store orders.");
          console.error("Store Order Fetch Error:", storeResponse.reason || (storeResponse.value && storeResponse.value.statusText));
        }
      }

      // Process online orders
      if (onlineResponse.status === 'fulfilled' && onlineResponse.value.ok) {
        const data = await onlineResponse.value.json();
        
        const orders = Array.isArray(data) ? data : [];
        newOnlineOrders = orders.map(order => {
          const parsedItems = Array.isArray(order.items) ? order.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            size: item.size || 'Standard', 
            category: item.category,
            addons: item.addons || []
          })) : [];

          const totalQuantity = parsedItems.reduce((sum, item) => sum + item.quantity, 0);
          
          // Calculate total add-ons cost from all items
          const totalAddOnsCost = parsedItems.reduce((sum, item) => {
            if (item.addons && Array.isArray(item.addons)) {
              const itemAddOnsCost = item.addons.reduce((addonSum, addon) => {
                return addonSum + (addon.price || addon.Price || 0);
              }, 0);
              return sum + itemAddOnsCost;
            }
            return sum;
          }, 0);

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
            discount: order.discount || order.applied_discount || 0,
            addOns: totalAddOnsCost,
            cashierName: order.cashier_name || 'Unknown',
            reference_number: order.reference_number || order.gcash_reference_number || null  // ✅ FIXED: Added reference number
          };
        });
      } else {
        errors.push("Failed to load online orders.");
        console.error("Online Order Fetch Error:", onlineResponse.reason || (onlineResponse.value && onlineResponse.value.statusText));
      }
      
      if (errors.length > 0) setError(errors.join(' '));
      
      const processAndSort = (orders) => orders.map(o => ({ 
        ...o, 
        localDateString: getLocalDateString(o.date), 
        dateDisplay: o.date.toLocaleString("en-US", { 
          month: "long", 
          day: "2-digit", 
          year: "numeric", 
          hour: "numeric", 
          minute: "2-digit", 
          hour12: true 
        })
      })).sort((a, b) => b.date - a.date);
      
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
    { 
      name: "ORDER COUNT", 
      selector: (row, index) => index + 1, 
      cell: (row, index) => `${index + 1}.`,
      sortable: false, 
      width: "15%" 
    }, 
    { name: "DATE & TIME", selector: (row) => row.dateDisplay, sortable: true, width: "30%" },
    { name: "ITEMS", selector: (row) => `${row.items} Items`, sortable: true, width: "20%" }, 
    { name: "TOTAL", selector: (row) => `₱${row.total.toFixed(2)}`, sortable: true, width: "15%" },
    { 
      name: "STATUS", 
      selector: (row) => row.status, 
      cell: (row) => (
        <span className={`orderpanel-status-badge orderpanel-${row.status.toLowerCase().replace(/\s+/g, '')}`}>
          {row.status}
        </span>
      ), 
      width: "20%" 
    },
  ];
  
  const onlineColumns = [
    { 
      name: "ORDER COUNT", 
      selector: (row, index) => index + 1, 
      cell: (row, index) => `${index + 1}.`,
      sortable: false, 
      width: "15%" 
    }, 
    { name: "CUSTOMER", selector: (row) => row.customerName, sortable: true, width: "20%" },
    { name: "DATE & TIME", selector: (row) => row.dateDisplay, sortable: true, width: "25%" }, 
    { name: "TOTAL", selector: (row) => `₱${row.total.toFixed(2)}`, sortable: true, width: "15%" },
    { name: "TYPE", selector: (row) => row.orderType, sortable: true, width: "10%" }, 
    { 
      name: "STATUS", 
      selector: (row) => row.status, 
      cell: (row) => (
        <span className={`orderpanel-status-badge orderpanel-${row.status.toLowerCase().replace(/\s+/g, '')}`}>
          {row.status}
        </span>
      ), 
      width: "15%" 
    },
  ];

  const handleUpdateStatus = async (orderToUpdate, newStatus, details) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

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
          const cancelBody = JSON.stringify({ 
            newStatus: 'cancelled', 
            cancelDetails: { managerUsername: pinData.managerUsername } 
          });
          const cancelResponse = await fetch(cancelUrl, { method: 'PATCH', headers, body: cancelBody });
          if (!cancelResponse.ok) throw new Error((await cancelResponse.json()).detail || "Failed to cancel the store order.");
          
          toast.success("Store order successfully cancelled!");
        } catch (err) {
          console.error("Store Cancellation Error:", err);
          toast.error(`Error: ${err.message}`);
        }
      } else if (orderToUpdate.source === 'online') {
        try {
          const url = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
          const body = JSON.stringify({ new_status: newStatus });
          const response = await fetch(url, { method: 'PATCH', headers, body });
          if (!response.ok) throw new Error((await response.json()).detail || 'Failed to cancel online order.');
          
          toast.success("Online order successfully cancelled!");
        } catch (err) {
          console.error("Online Cancellation Error:", err);
          toast.error(`Error: ${err.message}`);
        }
      }
    
    } else {
      if (orderToUpdate.source === 'online' && newStatus === 'PREPARING' && orderToUpdate.status === 'PENDING') {
        try {
          console.log("=== ORDER ITEMS BEFORE PROCESSING ===");
          orderToUpdate.orderItems.forEach(item => {
            console.log(`Item: ${item.name}, Category: "${item.category}", Quantity: ${item.quantity}`);
          });

          const posOrderPayload = {
            online_order_id: orderToUpdate.id,
            customer_name: orderToUpdate.customerName,
            cashier_name: username,
            order_type: orderToUpdate.orderType,
            payment_method: orderToUpdate.paymentMethod,
            subtotal: orderToUpdate.total,
            total_amount: orderToUpdate.total,
            status: 'processing',
            reference_number: orderToUpdate.reference_number || `ONLINE-${orderToUpdate.id}`,  // ✅ FIXED: Added reference number
            items: orderToUpdate.orderItems.map(item => ({ 
              name: item.name, 
              quantity: item.quantity, 
              price: item.price, 
              category: item.category,
              addons: item.addons || [] 
            }))
          };

          console.log("=== POS ORDER PAYLOAD ===");
          console.log(JSON.stringify(posOrderPayload, null, 2));

          // Separate items by category
          const productItems = [];
          const merchandiseItems = [];
          
          console.log("=== SEPARATING ITEMS BY CATEGORY ===");
          orderToUpdate.orderItems.forEach(item => {
            // Normalize category for comparison (trim and case-insensitive)
            const normalizedCategory = (item.category || '').trim().toLowerCase();
            
            console.log(`Processing: ${item.name}`);
            console.log(`  Original category: "${item.category}"`);
            console.log(`  Normalized category: "${normalizedCategory}"`);
            
            // Check if it's merchandise (accept multiple possible values)
            if (normalizedCategory === 'merchandise' || 
                normalizedCategory === 'all items' || 
                normalizedCategory === 'allitems') {
              // Add to merchandise deduction
              merchandiseItems.push({
                name: item.name,
                quantity: item.quantity
              });
              console.log(`  ✓ Added to MERCHANDISE deduction`);
            } else {
              // Add to product deduction (Coffee/Non-Coffee)
              productItems.push({
                product_name: item.name,
                quantity: item.quantity,
                category: item.category
              });
              console.log(`  ✓ Added to PRODUCT deduction`);
            }
          });

          // Build deduction payload for products (ingredients/materials)
          const productDeductionPayload = {
            cartItems: productItems.map(item => ({
              name: item.product_name,
              quantity: item.quantity,
              addons: (orderToUpdate.orderItems.find(oi => oi.name === item.product_name)?.addons || [])
                .map(addon => ({
                  addon_id: addon.addon_id || addon.AddonID || 0,
                  addon_name: addon.addon_name || addon.AddonName || '',
                  price: addon.price || addon.Price || 0,
                  quantity: 1
                }))
            }))
          };

          // Build deduction payload for merchandise
          const merchandiseDeductionPayload = {
            cartItems: merchandiseItems
          };

          console.log("=== PRODUCT DEDUCTION PAYLOAD ===");
          console.log(JSON.stringify(productDeductionPayload, null, 2));
          console.log("=== MERCHANDISE DEDUCTION PAYLOAD ===");
          console.log(JSON.stringify(merchandiseDeductionPayload, null, 2));
          console.log(`=== API CALLS TO BE MADE: ${1 + (productItems.length > 0 ? 2 : 0) + (merchandiseItems.length > 0 ? 1 : 0)} ===`);

          // Prepare all API calls
          const apiCalls = [
            fetch(`${SALES_API_BASE_URL}/auth/purchase_orders/online-order`, { 
              method: 'POST', 
              headers, 
              body: JSON.stringify(posOrderPayload) 
            })
          ];

          // Add product deduction calls if there are products
          if (productItems.length > 0) {
            apiCalls.push(
              fetch(`${INVENTORY_API_BASE_URL}/ingredients/deduct-from-sale`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify(productDeductionPayload) 
              }),
              fetch(`${INVENTORY_API_BASE_URL}/materials/deduct-from-sale`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify(productDeductionPayload) 
              })
            );
          }

          // Add merchandise deduction call if there are merchandise items
          if (merchandiseItems.length > 0) {
            apiCalls.push(
              fetch(`${INVENTORY_API_BASE_URL}/merchandise/deduct-from-sale`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify(merchandiseDeductionPayload) 
              })
            );
          }

          // Execute all calls
          const results = await Promise.allSettled(apiCalls);

          // Check POS save result (first call)
          const posResponse = results[0];
          if (posResponse.status === 'rejected' || !posResponse.value.ok) {
            const errorText = posResponse.status === 'fulfilled' ? await posResponse.value.text() : posResponse.reason;
            throw new Error(`Critical Error: Could not save to POS. ${errorText}`);
          }

          // Log other results
          let callIndex = 1;
          if (productItems.length > 0) {
            const ingredientsResponse = results[callIndex++];
            if (ingredientsResponse.status === 'rejected' || !ingredientsResponse.value.ok) {
              console.error("Failed to deduct ingredients:", 
                ingredientsResponse.status === 'fulfilled' ? await ingredientsResponse.value.text() : ingredientsResponse.reason);
            }

            const materialsResponse = results[callIndex++];
            if (materialsResponse.status === 'rejected' || !materialsResponse.value.ok) {
              console.error("Failed to deduct materials:", 
                materialsResponse.status === 'fulfilled' ? await materialsResponse.value.text() : materialsResponse.reason);
            }
          }

          if (merchandiseItems.length > 0) {
            const merchandiseResponse = results[callIndex++];
            if (merchandiseResponse.status === 'rejected' || !merchandiseResponse.value.ok) {
              const errorText = merchandiseResponse.status === 'fulfilled' 
                ? await merchandiseResponse.value.text() 
                : merchandiseResponse.reason;
              console.error("❌ MERCHANDISE DEDUCTION FAILED:");
              console.error("  Status:", merchandiseResponse.status);
              console.error("  Error:", errorText);
              console.error("  Payload sent:", JSON.stringify(merchandiseDeductionPayload, null, 2));
              toast.warning("Order accepted but merchandise deduction may have failed. Please check inventory.");
            } else {
              const successData = await merchandiseResponse.value.json();
              console.log("✅ Successfully deducted merchandise inventory");
              console.log("  Response:", successData);
            }
          }
          
          console.log("Order saved to POS and inventory deduction initiated.");

          // Update online order status
          const onlineStatusUrl = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
          const onlineStatusBody = JSON.stringify({ new_status: newStatus });
          const onlineResponse = await fetch(onlineStatusUrl, { method: 'PATCH', headers, body: onlineStatusBody });
          if (!onlineResponse.ok) {
            throw new Error((await onlineResponse.json()).detail || 'POS/Inventory updated, but failed to update online order status.');
          }
          
          toast.success("Order accepted and is now being prepared!");

        } catch (err) {
          console.error("Error accepting order:", err);
          toast.error(`Error: ${err.message}`);
        }
      } else {
        try {
          const updatePromises = [];

          if (orderToUpdate.source === 'store') {
            const url = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/status`;
            const body = JSON.stringify({ newStatus: newStatus.toLowerCase() });
            updatePromises.push(fetch(url, { method: 'PATCH', headers, body }));

          } else if (orderToUpdate.source === 'online') {
            const oosUrl = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
            const oosBody = JSON.stringify({ new_status: newStatus });
            updatePromises.push(fetch(oosUrl, { method: 'PATCH', headers, body: oosBody }));
            
            if (newStatus === 'COMPLETED') {
              const posStatus = 'completed';
              const posUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/online/${orderToUpdate.id}/status`;
              const posBody = JSON.stringify({ newStatus: posStatus });
              updatePromises.push(fetch(posUrl, { method: 'PATCH', headers, body: posBody }));
            }
          } else {
            toast.error("Cannot update order: Unknown source.");
            return;
          }

          const results = await Promise.allSettled(updatePromises);
          
          let hasErrors = false;
          results.forEach(result => {
            if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)) {
              hasErrors = true;
              console.error("An update failed:", result.reason || result.value.statusText);
            }
          });

          if (hasErrors) {
            throw new Error('One or more status updates failed. Check the console for details.');
          }
          
          toast.success("Order status updated successfully!");

        } catch (err) {
          console.error("Error updating status:", err);
          toast.error(`Error: ${err.message}`);
        }
      }
    }

    await fetchOrders();
    setSelectedOrder(prev => prev && prev.id === orderToUpdate.id ? { ...prev, status: newStatus.toUpperCase() } : null);
  };

  const ordersData = activeTab === "store" ? storeOrders : onlineOrders;
  
  // Filter orders based on cashier and status
  const filteredData = ordersData.filter(order => {
    const text = searchText.toLowerCase();
    const matchesSearch = String(order.id).toLowerCase().includes(text) || 
                         (order.dateDisplay && order.dateDisplay.toLowerCase().includes(text)) || 
                         (order.customerName && order.customerName.toLowerCase().includes(text)) || 
                         order.status.toLowerCase().includes(text);
    const matchesDate = filterDate ? order.localDateString === filterDate : true;
    const matchesStatus = filterStatus ? order.status.toUpperCase() === filterStatus.toUpperCase() : true;
    
    // Cashier filter logic
    const isPending = order.status === 'PENDING';
    
    // Only show:
    // 1. PENDING orders (visible to everyone - not yet accepted)
    // 2. Orders where the current user is the cashier (for all other statuses)
    const matchesCashier = isPending || order.cashierName === username;
    
    return matchesSearch && matchesDate && matchesStatus && matchesCashier;
  });

  const clearFilters = () => { 
    setSearchText(""); 
    setFilterDate(getTodayLocalDate()); 
    setFilterStatus(""); 
  };
  
  const handleTabChange = (tab) => { 
    setActiveTab(tab); 
    clearFilters(); 
    setSelectedOrder(null); 
  };

  useEffect(() => { 
    if (filteredData.length > 0) { 
      if (!selectedOrder || !filteredData.find(o => o.id === selectedOrder.id)) { 
        setSelectedOrder(filteredData[0]); 
      } 
    } else { 
      setSelectedOrder(null); 
    } 
  }, [filteredData, selectedOrder]);

  useEffect(() => { 
    // Always default to today's date when switching tabs
    setFilterDate(getTodayLocalDate()); 
  }, [activeTab, getTodayLocalDate]);

  return (
    <div className="orders-main-container">
      <Navbar isOrderPanelOpen={!!selectedOrder} username={username} />
      <div className={`orders-content-container ${selectedOrder ? 'orders-panel-open' : ''}`}>
        <div className="orders-tab-container">
          <button 
            className={`orders-tab ${activeTab === "store" ? "active" : ""}`} 
            onClick={() => handleTabChange("store")}
          >
            Store
          </button>
          <button 
            className={`orders-tab ${activeTab === "online" ? "active" : ""}`} 
            onClick={() => handleTabChange("online")}
          >
            Online
          </button>
        </div>
        
        <div className="cOrders-filter-bar">
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchText} 
            onChange={(e) => setSearchText(e.target.value)} 
            className="cOrders-filter-input" 
          />
          <input 
            type="date" 
            value={filterDate || ''} 
            onChange={(e) => setFilterDate(e.target.value)} 
            className="cOrders-filter-input" 
            max={getTodayLocalDate()} 
          />
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            className="cOrders-filter-input"
          >
            <option value="">All Status</option>
            {activeTab === 'store' 
              ? (
                <> 
                  <option value="COMPLETED">Completed</option> 
                  <option value="PROCESSING">Processing</option> 
                  <option value="CANCELLED">Cancelled</option> 
                  <option value="REFUNDED">Refunded</option> 
                </> 
              ) 
              : (
                <> 
                  <option value="PENDING">Pending</option> 
                  <option value="PREPARING">Preparing</option> 
                  <option value="WAITING FOR PICK UP">Waiting For Pick Up</option>
                  <option value="DELIVERING">Delivering</option>
                  <option value="COMPLETED">Completed</option> 
                  <option value="CANCELLED">Cancelled</option> 
                </>
              )}
          </select>
          <button className="cOrders-clear-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
        
        <div className="orders-table-container">
          {loading && ordersData.length === 0 ? (
            <div className="orders-message-container">Loading orders...</div>
          ) : error && ordersData.length === 0 ? (
            <div className="orders-message-container orders-error">{error}</div>
          ) : (
            <DataTable
              columns={activeTab === 'store' ? storeColumns : onlineColumns}
              data={filteredData}
              pagination 
              highlightOnHover 
              responsive 
              fixedHeader 
              fixedHeaderScrollHeight="60vh"
              conditionalRowStyles={[
                { 
                  when: row => row.id === selectedOrder?.id, 
                  style: { 
                    backgroundColor: "#e9f9ff", 
                    boxShadow: "inset 0 0 0 1px #2a9fbf" 
                  } 
                }
              ]}
              onRowClicked={(row) => setSelectedOrder(row)}
              noDataComponent={
                <div className="orders-message-container">
                  {`No ${activeTab} orders found for the selected filters.`}
                </div>
              }
              customStyles={{ 
                headCells: { 
                  style: { 
                    backgroundColor: "#4B929D", 
                    color: "#fff", 
                    fontWeight: "600", 
                    fontSize: "14px", 
                    padding: "15px", 
                    textTransform: "uppercase", 
                    letterSpacing: "1px" 
                  } 
                }, 
                rows: { 
                  style: { 
                    minHeight: "60px", 
                    padding: "10px", 
                    fontSize: "14px", 
                    color: "#333" 
                  } 
                }, 
                cells: { 
                  style: { 
                    fontSize: "14px" 
                  } 
                }
              }}
            />
          )}
        </div>
        
        {selectedOrder && ( 
          <OrderPanel 
            order={selectedOrder} 
            isOpen={true} 
            onClose={() => setSelectedOrder(null)} 
            isStore={selectedOrder.source === 'store'} 
            onUpdateStatus={handleUpdateStatus} 
          /> 
        )}
      </div>
    </div>
  );
}

export default Orders;