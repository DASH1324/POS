import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import "./orders.css";
import Navbar from "../navbar";
import DataTable from "react-data-table-component";
import OrderPanel from "./orderPanel";
import { toast } from 'react-toastify';
import Loading from "../home/shared/loading";
import { FaFilter, FaSearch } from "react-icons/fa";

const SALES_API_BASE_URL = 'http://127.0.0.1:9000';
const ONLINE_API_BASE_URL = 'http://127.0.0.1:7004';
const AUTH_API_BASE_URL = 'http://127.0.0.1:4000';
const INVENTORY_API_BASE_URL = 'http://127.0.0.1:8002';
const NOTIFICATION_API_BASE_URL = 'http://127.0.0.1:9004';

// Helper function to send order emails
const sendOrderEmail = async (order, emailType, token) => {
  try {
    console.log(`📧 Preparing to send ${emailType} email for order ${order.id}`);

    const emailPayload = {
      customer_name: order.customerName,
      order_id: String(order.id),
      order_type: order.orderType,
      status: order.status,
      items: order.orderItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        addons: (item.addons || []).map(addon => ({
          addon_id: addon.addon_id || addon.AddonID || 0,
          addon_name: addon.addon_name || addon.AddonName || addon.name || '',
          price: addon.price || addon.Price || 0
        }))
      })),
      total: order.total,
      payment_method: order.paymentMethod,
      delivery_address: order.deliveryAddress || null,
      phone_number: order.phoneNumber || null,
      reference_number: order.reference_number || null
    };

    console.log('📧 Email Payload:', JSON.stringify(emailPayload, null, 2));

    const endpoint = emailType === 'accepted' 
      ? '/email/send-order-accepted' 
      : '/email/send-order-update';

    const response = await fetch(`${NOTIFICATION_API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(emailPayload)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log(`✅ Email sent successfully:`, result);
        return { success: true };
      } else {
        console.warn(`⚠️ Email not sent: ${result.message}`);
        return { success: false, reason: result.message };
      }
    } else {
      const errorData = await response.json();
      console.error(`❌ Failed to send email (${response.status}):`, errorData);
      return { success: false, reason: errorData.detail || 'Unknown error' };
    }
  } catch (error) {
    console.error(`❌ Error sending email:`, error);
    return { success: false, reason: error.message };
  }
};

function Orders() {
  const [activeTab, setActiveTab] = useState("store");
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState('');
  const [storeOrders, setStoreOrders] = useState([]);
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
    if (isUpdatingStatus) {
      console.log('Skipping fetch - status update in progress');
      return;
    }

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
                saleItemId: item.saleItemId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                category: item.category,
                size: item.size || 'Standard', 
                addons: item.addons || [],
                itemDiscounts: item.itemDiscounts || [],
                itemPromotions: item.itemPromotions || []

              })) : [],
              source: 'store',
              subtotal: order.subtotal || 0,
              promotionalDiscount: order.promotionalDiscount || 0,
              manualDiscount: order.manualDiscount || 0,
              appliedDiscounts: order.appliedDiscounts || [],
              addOns: order.addOns || order.appliedAddOns || order.addons || 0,
              cashierName: order.cashierName || 'Unknown',
              reference_number: order.gcashReference || order.GCashReferenceNumber || null,
              updatedAt: order.updatedAt || order.date,
              email: order.email || order.customer_email || null
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
            addons: item.addons || [],
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

          const itemsSubtotal = parsedItems.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
          }, 0);

          return {
            id: order.order_id,
            customerName: order.customer_name,
            date: new Date(order.order_date),
            orderType: order.order_type,
            paymentMethod: order.payment_method,
            total: itemsSubtotal,
            status: order.order_status ? order.order_status.toUpperCase() : 'UNKNOWN',
            items: totalQuantity,
            orderItems: parsedItems,
            source: 'online',
            discount: order.discount || order.applied_discount || 0,
            addOns: totalAddOnsCost,
            cashierName: order.cashier_name || 'Unknown',
            reference_number: order.reference_number || order.gcash_reference_number || null,
            email: order.emailAddress || order.email || null,
            phoneNumber: order.phoneNumber || null,
            deliveryAddress: order.deliveryAddress || null
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
  }, [getLocalDateString, storeOrders.length, onlineOrders.length, isUpdatingStatus]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
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

  const convertStatusForBackend = (status) => {
    return status.toLowerCase();
  };

  const handleUpdateStatus = async (orderToUpdate, newStatus, details) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    setIsUpdatingStatus(true);

    if (newStatus === 'CANCELLED') {
      if (details && details.pin) {
        try {
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
            if (orderToUpdate.status === 'PENDING') {
              const referenceNumber = orderToUpdate.reference_number;
              if (!referenceNumber) {
                toast.error("Cannot cancel: Missing reference number for the order.");
                setIsUpdatingStatus(false);
                return;
              }

              const posUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/online/${encodeURIComponent(referenceNumber)}/status`;
              const posBody = JSON.stringify({ newStatus: 'cancelled' });
              const posUpdateResponse = await fetch(posUrl, { method: 'PATCH', headers, body: posBody });
              
              if (!posUpdateResponse.ok) {
                const errorText = await posUpdateResponse.text();
                console.error('Failed to update POS status to cancelled:', errorText);
                throw new Error(`Failed to cancel order in POS: ${errorText}`);
              }
            }

            const url = `${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`;
            const body = JSON.stringify({ 
              new_status: newStatus,
              cashier_name: username
            });          
            const response = await fetch(url, { method: 'PATCH', headers, body });
            if (!response.ok) throw new Error((await response.json()).detail || 'Failed to cancel online order.');
            
            toast.success("Online order successfully cancelled!");
          }

          setSelectedOrder(prev => 
            prev && prev.id === orderToUpdate.id 
              ? { ...prev, status: 'CANCELLED' } 
              : null
          );
          
          if (orderToUpdate.source === 'online') {
            setOnlineOrders(prevOrders => 
              prevOrders.map(order => 
                order.id === orderToUpdate.id 
                  ? { ...order, status: 'CANCELLED' }
                  : order
              )
            );
          } else {
            setStoreOrders(prevOrders => 
              prevOrders.map(order => 
                order.id === orderToUpdate.id 
                  ? { ...order, status: 'CANCELLED' }
                  : order
              )
            );
          }

        } catch (err) {
          console.error("Cancellation Error:", err);
          toast.error(`Error: ${err.message}`);
        } finally {
          setIsUpdatingStatus(false);
          setTimeout(() => fetchOrders(), 500);
        }
      } else {
        toast.error("Manager PIN is required to cancel orders.");
        setIsUpdatingStatus(false);
        return;
      }
    
    } else if (orderToUpdate.source === 'online' && newStatus === 'PREPARING' && orderToUpdate.status === 'PENDING') {
      try {
        const referenceNumber = orderToUpdate.reference_number;
        if (!referenceNumber) {
          toast.error("Cannot accept: Missing reference number for the order.");
          setIsUpdatingStatus(false);
          return;
        }

        const productItems = [];
        const merchandiseItems = [];
        
        orderToUpdate.orderItems.forEach(item => {
          const normalizedCategory = (item.category || '').trim().toLowerCase();
          const finalCategory = normalizedCategory === 'all items' || normalizedCategory === 'allitems' 
            ? 'merchandise' 
            : normalizedCategory;
          
          if (finalCategory === 'merchandise') {
            merchandiseItems.push({
              name: item.name,
              quantity: item.quantity,
              category: 'Merchandise'
            });
          } else {
            productItems.push({
              product_name: item.name,
              quantity: item.quantity,
              category: item.category || 'Product'
            });
          }
        });

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

        const criticalUpdates = [];

        criticalUpdates.push(
          fetch(`${SALES_API_BASE_URL}/auth/purchase_orders/online/${encodeURIComponent(referenceNumber)}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ newStatus: 'processing' })
          })
        );

        criticalUpdates.push(
          fetch(`${ONLINE_API_BASE_URL}/cart/admin/orders/${orderToUpdate.id}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ new_status: newStatus })
          })
        );

        const criticalResults = await Promise.allSettled(criticalUpdates);
        
        const posUpdateFailed = criticalResults[0].status === 'rejected' || !criticalResults[0].value?.ok;
        const oosUpdateFailed = criticalResults[1].status === 'rejected' || !criticalResults[1].value?.ok;

        if (posUpdateFailed || oosUpdateFailed) {
          throw new Error('Failed to update order status. Please try again.');
        }

        toast.success("Order accepted and is now being prepared!");
        
        const updatedOrder = { ...orderToUpdate, status: 'PREPARING' };
        
        setSelectedOrder(prev => 
          prev && prev.id === orderToUpdate.id 
            ? updatedOrder
            : null
        );
        
        setOnlineOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderToUpdate.id 
              ? updatedOrder
              : order
          )
        );

        sendOrderEmail(updatedOrder, 'accepted', token).then(result => {
          if (result.success) {
            console.log(`✅ Order acceptance email sent for order ${updatedOrder.id}`);
          } else {
            console.warn(`⚠️ Email not sent for order ${updatedOrder.id}: ${result.reason}`);
          }
        });

        const performInventoryDeductions = async () => {
          const inventoryUpdates = [];

          if (productItems.length > 0) {
            inventoryUpdates.push(
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

          if (merchandiseItems.length > 0) {
            inventoryUpdates.push(
              fetch(`${INVENTORY_API_BASE_URL}/merchandise/deduct-from-sale`, {
                method: 'POST',
                headers,
                body: JSON.stringify(merchandiseDeductionPayload)
              })
            );
          }

          if (inventoryUpdates.length > 0) {
            const inventoryResults = await Promise.allSettled(inventoryUpdates);
            
            const inventoryFailures = inventoryResults.filter(
              r => r.status === 'rejected' || !r.value?.ok
            );

            if (inventoryFailures.length > 0) {
              console.warn('Some inventory deductions failed:', inventoryFailures);
            }
          }
        };

        performInventoryDeductions().catch(err => {
          console.error('Background inventory deduction error:', err);
        });

      } catch (err) {
        console.error("Error accepting order:", err);
        toast.error(`Error: ${err.message}`);
      } finally {
        setIsUpdatingStatus(false);
        setTimeout(() => fetchOrders(), 1000);
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
              setIsUpdatingStatus(false);
              return;
            }
            
            const posStatus = convertStatusForBackend(newStatus);
            const posUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/online/${encodeURIComponent(referenceNumber)}/status`;
            const posBody = JSON.stringify({ newStatus: posStatus });
            
            updatePromises.push(fetch(posUrl, { method: 'PATCH', headers, body: posBody }));
          }
        } else {
          toast.error("Cannot update order: Unknown source.");
          setIsUpdatingStatus(false);
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
          }
        });

        if (hasErrors) {
          console.error('=== UPDATE ERRORS ===', errorMessages);
          throw new Error(errorMessages.join('; '));
        }
        
        toast.success("Order status updated successfully!");

        const updatedOrder = { 
          ...orderToUpdate, 
          status: newStatus.toUpperCase() 
        };
        
        setSelectedOrder(prev => 
          prev && prev.id === orderToUpdate.id 
            ? updatedOrder
            : null
        );
        
        if (orderToUpdate.source === 'online') {
          setOnlineOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === orderToUpdate.id 
                ? updatedOrder
                : order
            )
          );
          
          const emailStatuses = [
            'WAITING FOR PICK UP', 
            'READY FOR PICK UP',
            'DELIVERING', 
            'COMPLETED', 
            'DELIVERED',
            'PICKED UP'
          ];
          
          if (emailStatuses.includes(newStatus.toUpperCase())) {
            console.log(`📧 Triggering email for status update: ${newStatus.toUpperCase()}`);
            sendOrderEmail(updatedOrder, 'update', token).then(result => {
              if (result.success) {
                console.log(`✅ Status update email sent for order ${updatedOrder.id}`);
              } else {
                console.warn(`⚠️ Email not sent for order ${updatedOrder.id}: ${result.reason}`);
              }
            });
          } else {
            console.log(`ℹ️ No email sent for status: ${newStatus.toUpperCase()}`);
          }
        } else {
          setStoreOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === orderToUpdate.id 
                ? updatedOrder
                : order
            )
          );
        }

      } catch (err) {
        console.error("Error updating status:", err);
        toast.error(`Error: ${err.message}`);
      } finally {
        setIsUpdatingStatus(false);
        setTimeout(() => fetchOrders(), 500);
      }
    }
  };

  const handleFullRefund = async (orderToUpdate, pin) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      const pinResponse = await fetch(`${AUTH_API_BASE_URL}/users/verify-pin`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ pin: pin })
      });

      if (!pinResponse.ok) {
        const pinData = await pinResponse.json();
        throw new Error(pinData.detail || "Invalid Manager PIN.");
      }

      const pinData = await pinResponse.json();
      const managerUsername = pinData.managerUsername;

      const refundUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/refund`;
      const refundBody = JSON.stringify({
        managerUsername: managerUsername,
        refundReason: "Cashier requested full refund"
      });

      const refundResponse = await fetch(refundUrl, {
        method: 'POST',
        headers: headers,
        body: refundBody
      });

      if (!refundResponse.ok) {
        const errorData = await refundResponse.json();
        throw new Error(errorData.detail || "Failed to process refund.");
      }

      const result = await refundResponse.json();
      
      toast.success(`Order refunded successfully by ${managerUsername}!`);

      setSelectedOrder(prev => 
        prev && prev.id === orderToUpdate.id 
          ? { ...prev, status: 'REFUNDED' } 
          : null
      );

      if (orderToUpdate.source === 'store') {
        setStoreOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderToUpdate.id 
              ? { ...order, status: 'REFUNDED' }
              : order
          )
        );
      }

    } catch (err) {
      console.error("Full refund error:", err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
      setTimeout(() => fetchOrders(), 500);
    }
  };

  const handlePartialRefund = async (orderToUpdate, itemsToRefund, pin) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error("Authentication error. Please log in again.");
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      const pinResponse = await fetch(`${AUTH_API_BASE_URL}/users/verify-pin`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ pin: pin })
      });

      if (!pinResponse.ok) {
        const pinData = await pinResponse.json();
        throw new Error(pinData.detail || "Invalid Manager PIN.");
      }

      const pinData = await pinResponse.json();
      const managerUsername = pinData.managerUsername;

      const refundItems = itemsToRefund.map(item => ({
        saleItemId: parseInt(item.saleItemId),
        refundQuantity: parseInt(item.refundQuantity),
        itemName: String(item.name),
        originalQuantity: parseInt(item.quantity),
        unitPrice: parseFloat(item.price)
      }));

      const refundUrl = `${SALES_API_BASE_URL}/auth/purchase_orders/${orderToUpdate.id}/partial-refund`;
      const refundBody = JSON.stringify({
        managerUsername: managerUsername,
        refundReason: "Cashier requested partial refund",
        items: refundItems
      });

      const refundResponse = await fetch(refundUrl, {
        method: 'POST',
        headers: headers,
        body: refundBody
      });

      if (!refundResponse.ok) {
        const errorData = await refundResponse.json();
        throw new Error(errorData.detail || "Failed to process partial refund.");
      }

      const result = await refundResponse.json();

      toast.success(
        `Partial refund processed successfully!\n` +
        `Refund Amount: ₱${result.total_refund_amount.toFixed(2)}`
      );

    } catch (err) {
      console.error("Partial refund error:", err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
      setTimeout(() => fetchOrders(), 500);
    }
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
    // Handle navigation from notifications
    if (location.state?.selectedOrderId && location.state?.openPanel) {
      console.log('📍 Navigation state detected:', location.state);
      
      // Remove the 'SO-' prefix if it exists
      const orderIdToFind = String(location.state.selectedOrderId).replace(/^SO-/, '');
      console.log('🔍 Looking for order ID:', orderIdToFind);
      
      // Search in both store and online orders
      const allOrders = [...storeOrders, ...onlineOrders];
      console.log('📦 Total orders available:', allOrders.length);
      
      const orderToSelect = allOrders.find(order => String(order.id) === orderIdToFind);
      
      if (orderToSelect) {
        console.log('✅ Order found:', orderToSelect);
        
        // Set the correct tab based on order source
        if (orderToSelect.source === 'store') {
          setActiveTab('store');
        } else if (orderToSelect.source === 'online') {
          setActiveTab('online');
        }
        
        // Set the selected order to open the panel
        setSelectedOrder(orderToSelect);
        
        // Clear the navigation state to prevent re-triggering
        window.history.replaceState({}, document.title);
      } else {
        console.warn('⚠️ Order not found with ID:', orderIdToFind);
        console.log('Available order IDs:', allOrders.map(o => o.id));
      }
      
      return; // Exit early to prevent the normal selection logic
    }

    // Normal selection logic for filtered data
    if (filteredData.length > 0) { 
      if (!selectedOrder || !filteredData.find(o => o.id === selectedOrder.id)) { 
        setSelectedOrder(filteredData[0]); 
      } 
    } else { 
      setSelectedOrder(null); 
    } 
  }, [location.state, storeOrders, onlineOrders, filteredData, selectedOrder]);

  useEffect(() => { 
    setFilterDate(getTodayLocalDate()); 
  }, [activeTab, getTodayLocalDate]);

  return (
    <div className="orders-main-container">
      <Navbar isOrderPanelOpen={!!selectedOrder} username={username} />
      <div className={`orders-content-container ${selectedOrder ? 'orders-panel-open' : ''}`}>
        <div className="orders-header-row">
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
        
        {!loading && (
          <div className={`orders-filterBar ${isFilterOpen ? "open" : "collapsed"}`}>
            <button
              className="orders-filter-toggle-btn"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter />
            </button>

            <div className="orders-filter-item">
              <div className="orders-search-wrapper">
                <FaSearch className="orders-search-icon" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="orders-search-input"
                />
              </div>
            </div>

            <div className="orders-filter-item">
              <span>Date:</span>
              <input 
                type="date" 
                value={filterDate || ''} 
                onChange={(e) => setFilterDate(e.target.value)} 
                className="orders-date-input"
                max={getTodayLocalDate()} 
              />
            </div>

            <div className="orders-filter-item">
              <span>Status:</span>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className="orders-select"
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
                      <option value="DELIVERED">Completed</option> 
                      <option value="CANCELLED">Cancelled</option> 
                    </>
                  )}
              </select>
            </div>

            <button 
              className="orders-clearBtn" 
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}
        </div>
        
        {loading ? (
          <Loading/>
        ) : error && ordersData.length === 0 ? (
          <div className="orders-message-container orders-error">{error}</div>
        ) : (
          <div className="orders-table-container">
            <DataTable
              columns={activeTab === 'store' ? storeColumns : onlineColumns}
              data={filteredData}
              pagination 
              highlightOnHover 
              responsive 
              fixedHeader 
              fixedHeaderScrollHeight="60vh"
              paginationPerPage={5} 
              paginationRowsPerPageOptions={[5]}
              conditionalRowStyles={[
                { 
                  when: row => row.id === selectedOrder?.id, 
                  style: { 
                    backgroundColor: "#e9f9ff", 
                    boxShadow: "inset 0 0 0 1px #2a9fbf" 
                  } 
                }
              ]}
              onRowClicked={(row) => {
                console.log('=== ROW CLICKED ===');
                console.log('Order ID:', row.id);
                console.log('Customer Name:', row.customerName);
                console.log('Email:', row.email);
                console.log('Status:', row.status);
                console.log('Source:', row.source);
                console.log('Full Order Object:', row);
                console.log('==================');
                setSelectedOrder(row);
              }}
              noDataComponent={
                <div className="orders-message-container">
                  {error ? (
                    <span style={{ color: "red" }}>Error: {error}</span>
                  ) : (
                    `No ${activeTab} orders found for the selected filters.`
                  )}
                </div>
              }
              customStyles={{ 
                headCells: { 
                  style: { 
                    backgroundColor: "#4B929D", 
                    color: "#fff", 
                    fontWeight: "600", 
                    fontSize: "14px", 
                    padding: "12px", 
                    textTransform: "uppercase", 
                    textAlign: "center",
                    letterSpacing: "1px" 
                  } 
                }, 
                rows: { 
                  style: { 
                    minHeight: "55px", 
                    padding: "5px",
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
          </div>
        )}
        
        {selectedOrder && ( 
          <OrderPanel 
            order={selectedOrder} 
            isOpen={true} 
            onClose={() => setSelectedOrder(null)} 
            isStore={selectedOrder.source === 'store'} 
            onUpdateStatus={handleUpdateStatus}
            onFullRefund={handleFullRefund}
            onPartialRefund={handlePartialRefund}
          /> 
        )}
      </div>
    </div>
  );
}

export default Orders;