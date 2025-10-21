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
              subtotal: order.subtotal || 0,
              promotionalDiscount: order.promotionalDiscount || 0,
              manualDiscount: order.manualDiscount || 0,
              appliedDiscounts: order.appliedDiscounts || [],
              addOns: order.addOns || order.appliedAddOns || order.addons || 0,
              cashierName: order.cashierName || 'Unknown',
              reference_number: order.GCashReferenceNumber || null
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
            reference_number: order.reference_number || order.gcash_reference_number || null
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

  // Helper function to convert frontend status to backend format
  const convertStatusForBackend = (status) => {
    // Backend expects lowercase with spaces
    return status.toLowerCase();
  };

  // Replace the handleUpdateStatus function in Orders.js

const handleUpdateStatus = async (orderToUpdate, newStatus, details) => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    toast.error("Authentication error. Please log in again.");
    return;
  }

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  if (newStatus === 'CANCELLED') {
    // Both store and online orders require manager PIN for cancellation
    if (details && details.pin) {
      try {
        // Verify manager PIN
        const pinResponse = await fetch(`${AUTH_API_BASE_URL}/users/verify-pin`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ pin: details.pin })
        });
        const pinData = await pinResponse.json();
        if (!pinResponse.ok) throw new Error(pinData.detail || "Invalid Manager PIN.");

        if (orderToUpdate.source === 'store') {
          const cancelUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/status`;
          const cancelBody = JSON.stringify({ 
            newStatus: 'cancelled', 
            cancelDetails: { managerUsername: pinData.managerUsername } 
          });
          const cancelResponse = await fetch(cancelUrl, { method: 'PATCH', headers, body: cancelBody });
          if (!cancelResponse.ok) throw new Error((await cancelResponse.json()).detail || "Failed to cancel the store order.");
          
          toast.success("Store order successfully cancelled!");
        } else if (orderToUpdate.source === 'online') {
          // NEW LOGIC: If order is PENDING, it's already in POS - just update status
          if (orderToUpdate.status === 'PENDING') {
            console.log("=== CANCELLING PENDING ORDER (ALREADY IN POS) ===");
            
            const referenceNumber = orderToUpdate.reference_number;
            if (!referenceNumber) {
              toast.error("Cannot cancel: Missing reference number for the order.");
              return;
            }

            // Update POS status to cancelled
            const posUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/online/${encodeURIComponent(referenceNumber)}/status`;
            const posBody = JSON.stringify({ newStatus: 'cancelled' });
            const posUpdateResponse = await fetch(posUrl, { method: 'PATCH', headers, body: posBody });
            
            if (!posUpdateResponse.ok) {
              const errorText = await posUpdateResponse.text();
              console.error('Failed to update POS status to cancelled:', errorText);
              throw new Error(`Failed to cancel order in POS: ${errorText}`);
            }
            
            console.log('✅ Successfully updated POS status to cancelled');
          }

          // Update online order status to CANCELLED
          const url = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
          const body = JSON.stringify({ new_status: newStatus });
          const response = await fetch(url, { method: 'PATCH', headers, body });
          if (!response.ok) throw new Error((await response.json()).detail || 'Failed to cancel online order.');
          
          toast.success("Online order successfully cancelled!");
        }
      } catch (err) {
        console.error("Cancellation Error:", err);
        toast.error(`Error: ${err.message}`);
      }
    } else {
      toast.error("Manager PIN is required to cancel orders.");
      return;
    }
  
  } else {
    // ACCEPTING ORDER (PENDING -> PREPARING)
    if (orderToUpdate.source === 'online' && newStatus === 'PREPARING' && orderToUpdate.status === 'PENDING') {
      try {
        console.log("=== ACCEPTING ORDER (ALREADY IN POS AS PENDING) ===");
        console.log("Order is already saved in POS. Just need to:");
        console.log("1. Update POS status to 'processing'");
        console.log("2. Update OOS status to 'PREPARING'");
        console.log("3. Deduct inventory");

        const referenceNumber = orderToUpdate.reference_number;
        if (!referenceNumber) {
          toast.error("Cannot accept: Missing reference number for the order.");
          return;
        }

        // Separate items by category for inventory deduction
        const productItems = [];
        const merchandiseItems = [];
        
        console.log("=== SEPARATING ITEMS BY CATEGORY ===");
        orderToUpdate.orderItems.forEach(item => {
          const normalizedCategory = (item.category || '').trim().toLowerCase();
          
          console.log(`Processing: ${item.name}`);
          console.log(`  Category: "${normalizedCategory}"`);
          
          if (normalizedCategory === 'merchandise' || 
              normalizedCategory === 'all items' || 
              normalizedCategory === 'allitems') {
            merchandiseItems.push({
              name: item.name,
              quantity: item.quantity
            });
            console.log(`  ✓ Added to MERCHANDISE deduction`);
          } else {
            productItems.push({
              product_name: item.name,
              quantity: item.quantity,
              category: item.category
            });
            console.log(`  ✓ Added to PRODUCT deduction`);
          }
        });

        // Prepare deduction payloads
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

        const merchandiseDeductionPayload = {
          cartItems: merchandiseItems
        };

        console.log("=== PRODUCT DEDUCTION PAYLOAD ===");
        console.log(JSON.stringify(productDeductionPayload, null, 2));
        console.log("=== MERCHANDISE DEDUCTION PAYLOAD ===");
        console.log(JSON.stringify(merchandiseDeductionPayload, null, 2));

        // API calls array
        const apiCalls = [];
        const apiCallDescriptions = [];

        // 1. Update POS status to 'processing'
        apiCalls.push(
          fetch(`${SALES_API_BASE_URL}/auth/purchase_orders/online/${encodeURIComponent(referenceNumber)}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ newStatus: 'processing' })
          })
        );
        apiCallDescriptions.push("Update POS status");

        // 2. Deduct product inventory (ingredients + materials)
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
          apiCallDescriptions.push("Deduct ingredients", "Deduct materials");
        }

        // 3. Deduct merchandise inventory
        if (merchandiseItems.length > 0) {
          apiCalls.push(
            fetch(`${INVENTORY_API_BASE_URL}/merchandise/deduct-from-sale`, {
              method: 'POST',
              headers,
              body: JSON.stringify(merchandiseDeductionPayload)
            })
          );
          apiCallDescriptions.push("Deduct merchandise");
        }

        console.log(`=== MAKING ${apiCalls.length} API CALLS ===`);

        const results = await Promise.allSettled(apiCalls);

        // Check results
        let hasErrors = false;
        results.forEach((result, index) => {
          const description = apiCallDescriptions[index];
          if (result.status === 'rejected' || !result.value.ok) {
            hasErrors = true;
            const errorText = result.status === 'fulfilled' ? result.value.statusText : result.reason;
            console.error(`❌ ${description} failed:`, errorText);
            if (index === 0) { // POS update is critical
              throw new Error(`Critical Error: Could not update POS status. ${errorText}`);
            }
          } else {
            console.log(`✅ ${description} succeeded`);
          }
        });

        if (hasErrors) {
          toast.warning("Order accepted but some inventory deductions may have failed. Please check inventory.");
        }

        // 4. Update OOS status to PREPARING
        const oosUrl = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
        const oosBody = JSON.stringify({ new_status: newStatus });
        const oosResponse = await fetch(oosUrl, { method: 'PATCH', headers, body: oosBody });
        
        if (!oosResponse.ok) {
          throw new Error((await oosResponse.json()).detail || 'Failed to update online order status.');
        }
        
        console.log("✅ Successfully updated OOS status to PREPARING");
        toast.success("Order accepted and is now being prepared!");

      } catch (err) {
        console.error("Error accepting order:", err);
        toast.error(`Error: ${err.message}`);
      }
    } else {
      // OTHER STATUS UPDATES (not accept/cancel)
      try {
        const updatePromises = [];

        if (orderToUpdate.source === 'store') {
          const url = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/status`;
          const body = JSON.stringify({ newStatus: newStatus.toLowerCase() });
          updatePromises.push(fetch(url, { method: 'PATCH', headers, body }));

        } else if (orderToUpdate.source === 'online') {
          // Update OOS (Online Order Service)
          const oosUrl = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
          const oosBody = JSON.stringify({ new_status: newStatus });
          updatePromises.push(fetch(oosUrl, { method: 'PATCH', headers, body: oosBody }));
          
          // Statuses that should sync to POS
          const statusesToSyncToPOS = [
            'COMPLETED', 
            'WAITING FOR PICK UP', 
            'DELIVERING',
            'PICKED UP' 
          ];

          if (statusesToSyncToPOS.includes(newStatus)) {
            const referenceNumber = orderToUpdate.reference_number;
            if (!referenceNumber) {
              console.error(`No reference number found for online order ${orderToUpdate.id}`);
              toast.error("Cannot update POS: Missing reference number for the order.");
              return;
            }
            
            const posStatus = convertStatusForBackend(newStatus);

            const posUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/online/${encodeURIComponent(referenceNumber)}/status`;
            const posBody = JSON.stringify({ newStatus: posStatus });
            
            console.log(`=== POS UPDATE DETAILS ===`);
            console.log(`Reference Number: ${referenceNumber}`);
            console.log(`New Status: ${posStatus}`);
            
            updatePromises.push(fetch(posUrl, { method: 'PATCH', headers, body: posBody }));
          }
        } else {
          toast.error("Cannot update order: Unknown source.");
          return;
        }

        const results = await Promise.allSettled(updatePromises);
        
        let hasErrors = false;
        let errorMessages = [];
        
        results.forEach((result, index) => {
          if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)) {
            hasErrors = true;
            const errorMsg = result.reason || result.value?.statusText || 'Unknown error';
            errorMessages.push(`Update ${index + 1} failed: ${errorMsg}`);
            console.error(`Update ${index + 1} failed:`, result.reason || result.value?.statusText);
          } else {
            console.log(`Update ${index + 1} succeeded:`, result.value?.status);
          }
        });

        if (hasErrors) {
          console.error('=== UPDATE ERRORS ===', errorMessages);
          throw new Error(errorMessages.join('; '));
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
  
  const filteredData = ordersData.filter(order => {
    const text = searchText.toLowerCase();
    const matchesSearch = String(order.id).toLowerCase().includes(text) || 
                         (order.dateDisplay && order.dateDisplay.toLowerCase().includes(text)) || 
                         (order.customerName && order.customerName.toLowerCase().includes(text)) || 
                         order.status.toLowerCase().includes(text);
    const matchesDate = filterDate ? order.localDateString === filterDate : true;
    const matchesStatus = filterStatus ? order.status.toUpperCase() === filterStatus.toUpperCase() : true;
    
    const isPending = order.status === 'PENDING';
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