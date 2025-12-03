import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./transactionHistory.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import CustomDateModal from "../shared/customDateModal";
import DataTable from "react-data-table-component";
import TransHisModal from "./modals/transactionDetailsModal";
import { 
  startOfToday, 
  startOfMonth, 
  startOfYear, 
  endOfToday,
  endOfMonth, 
  endOfYear, 
  startOfWeek 
} from "date-fns";
import { FaFileExport, FaFilter, FaSearch, FaCashRegister, FaCheckCircle } from "react-icons/fa";
import { RiSmartphoneFill } from "react-icons/ri";
import { HiReceiptRefund } from "react-icons/hi2";
import { MdPayments } from "react-icons/md";
import { generatePDFReport, generateCSVReport } from "./transactionHistoryExport";
import { ExportModal, NoDataModal, UnableToLoadData, NoData, RefundReasonModal } from "../shared/exportModal";
import Loading from "../shared/loading";
import '../../confirmAlertCustom.css';

const getAuthToken = () => {
  return localStorage.getItem("authToken");
};

const API_URL = "http://127.0.0.1:9000/auth/transaction_history/all";
const STATISTICS_API_URL = "http://127.0.0.1:9000/auth/transaction_history/statistics";
const CASHIERS_API_URL = "http://127.0.0.1:4000/users/cashiers";
const PARTIAL_REFUND_API_URL = "http://127.0.0.1:9000/auth/purchase_orders";

// Helper function for displaying date ranges
const getPeriodText = (dateRange, customStart, customEnd) => {
  const today = new Date();

  switch (dateRange) {
    case "today": {
      const options = { year: "numeric", month: "short", day: "numeric" };
      return today.toLocaleDateString("en-US", options);
    }
    case "week": {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      const start = sevenDaysAgo.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const end = today.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return `${start} - ${end}`;
    }
    case "month": {
      return today.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    case "year": {
      return today.toLocaleDateString("en-US", { year: "numeric" });
    }
    case "custom": {
      if (customStart && customEnd) {
        const start = new Date(customStart).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const end = new Date(customEnd).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return `${start} - ${end}`;
      }
      return "Custom Range";
    }
    default:
      return "";
  }
};

// Helper function to determine display status
const getDisplayStatus = (transaction) => {
  const hasRefundedItems = transaction.items?.some(item => 
    item.refundedQuantity && item.refundedQuantity > 0
  );
  
  if (hasRefundedItems && transaction.status.toLowerCase() !== 'refunded') {
    return 'Part-Refund';
  }
  
  return transaction.status;
};

// Transform API data to normalize payment methods and include promotional discount
const transformApiData = (apiTransaction) => {
  let transactionType = apiTransaction.type;
  
  if (apiTransaction.orderType === "Dine in" || apiTransaction.orderType === "Take out") {
    transactionType = "Store";
  } else if (apiTransaction.orderType === "Pick Up" || apiTransaction.orderType === "Delivery") {
    transactionType = "Online";
  }
  
  let paymentMethod = apiTransaction.paymentMethod;
  if (paymentMethod && (paymentMethod.toLowerCase() === 'e-wallet')) {
    paymentMethod = 'GCASH';
  } else if (paymentMethod && (paymentMethod.toLowerCase() === 'gcash')) {
    paymentMethod = 'GCASH';
  }

  return {
    id: apiTransaction.id,
    date: new Date(apiTransaction.date).toISOString(),
    orderType: apiTransaction.orderType,
    items: apiTransaction.items || [],
    total: apiTransaction.total,
    subtotal: apiTransaction.subtotal,
    discount: apiTransaction.discount || 0,
    promotionalDiscount: apiTransaction.promotionalDiscount || 0,
    discountName: apiTransaction.discountName,
    promotionNames: apiTransaction.promotionNames,
    status: apiTransaction.status,
    paymentMethod: paymentMethod,
    type: transactionType,
    discountsAndPromotions: apiTransaction.discountsAndPromotions,
    cashierName: apiTransaction.cashierName,
    GCashReferenceNumber: apiTransaction.GCashReferenceNumber,
    refundInfo: apiTransaction.refundInfo,
  };
};

function TransactionHistory() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Store");
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cashierFilter, setCashierFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState("today");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [cashiersMap, setCashiersMap] = useState({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText('today', '', ''));
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isNoDataModalOpen, setIsNoDataModalOpen] = useState(false);
  const [isRefundReasonModalOpen, setIsRefundReasonModalOpen] = useState(false);
  const [refundType, setRefundType] = useState(null); // 'full' or 'partial'
  const [pendingRefundData, setPendingRefundData] = useState(null);
  
  // New state for statistics from backend
  const [statistics, setStatistics] = useState({
    total_transactions: 0,
    completed_transactions: 0,
    cancelled_transactions: 0,
    refunded_transactions: 0,
    transactions_with_discount: 0,
    total_sales: 0,
    total_items_sold: 0,
    refund_summary: {
      totalRefundAmount: 0,
      totalRefundedItems: 0,
      fullRefunds: 0,
      partialRefunds: 0
    }
  });

  const handleAuthError = () => {
    localStorage.removeItem("authToken");
    setAuthError(true);
    navigate("/");
  };

  const fetchCashiers = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(CASHIERS_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const cashiers = await response.json();
        const map = {};
        cashiers.forEach(c => {
          map[c.Username] = c.FullName;
        });
        setCashiersMap(map);
      }
    } catch (error) {
      console.error("Error fetching cashiers:", error);
    }
  };

  const fetchStatistics = useCallback(async (token, startDate, endDate, orderType) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (orderType) params.append('order_type_filter', orderType);

      const response = await fetch(`${STATISTICS_API_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.status}`);
      }

      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      console.error("Failed to fetch statistics:", err);
    }
  }, [navigate]);

  const fetchTransactions = useCallback(async (token) => {
    if (!token) {
      handleAuthError();
      return;
    }
    setLoading(true);
    setError(null);
    setAuthError(false);
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid data format received from API");
      }
      const transformedData = data.map(transformApiData);
      setTransactions(transformedData);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        // Use local date, not UTC
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return [todayStart, todayEnd];
      case "thisWeek":
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return [sevenDaysAgo, now];
      case "thisMonth":
        return [startOfMonth(now), endOfMonth(now)];
      case "thisYear":
        return [startOfYear(now), endOfYear(now)];
      case "custom":
        if (customStart && customEnd) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          return [start, end];
        }
        return [null, null];
      default:
        return [null, null];
    }
  }, [dateRange, customStart, customEnd]);

  // Helper to format dates in local timezone
  const formatLocalDate = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    fetchCashiers();
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate("/");
      return;
    }
    fetchTransactions(token);
  }, [navigate, fetchTransactions]);

  // Fetch statistics whenever filters change
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const [start, end] = getDateRange();
    
    // Format dates in local timezone
    const startDate = formatLocalDate(start);
    const endDate = formatLocalDate(end);

    fetchStatistics(token, startDate, endDate, activeTab);
  }, [dateRange, customStart, customEnd, activeTab, fetchStatistics, getDateRange]);


  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setCashierFilter("");
    setPaymentMethodFilter("");
    setDateRange("today");
    setCustomStart("");
    setCustomEnd("");
  };

  const handleRefresh = () => {
    const token = getAuthToken();
    if (token) {
      fetchTransactions(token);
      const [start, end] = getDateRange();
      
      const startDate = formatLocalDate(start);
      const endDate = formatLocalDate(end);
      
      fetchStatistics(token, startDate, endDate, activeTab);
    } else {
      navigate("/");
    }
  };

  // Handle full refund
  // Handle full refund
  const handleFullRefund = async (transaction) => {
    setRefundType('full');
    setPendingRefundData({ transaction });
    setIsRefundReasonModalOpen(true);
  };

  // Process full refund with reason
  const processFullRefund = async (refundReason) => {
    try {
      const token = localStorage.getItem("authToken");
      const managerUsername = localStorage.getItem("username");
      
      if (!managerUsername) {
        alert("Authorization failed. Username not found. Please log in again.");
        return;
      }
      
      const { transaction } = pendingRefundData;
      const orderId = transaction.id;
      
      const response = await fetch(
        `${PARTIAL_REFUND_API_URL}/${orderId}/refund-today`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            managerUsername,
            refundReason
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process full refund");
      }
      
      const result = await response.json();
      
      alert(
        `${result.message}\n\n` +
        `Order ID: ${result.order_id}\n` +
        `Refunded By: ${result.refunded_by}\n` +
        `Reason: ${result.refund_reason}`
      );
      
      handleRefresh();
      closeModal();
      
    } catch (error) {
      console.error("Full refund error:", error);
      alert(`Error processing full refund: ${error.message}`);
    }
  };

  // Handle partial refund
  const handlePartialRefund = async (transaction, itemsToRefund) => {
    setRefundType('partial');
    setPendingRefundData({ transaction, itemsToRefund });
    setIsRefundReasonModalOpen(true);
  };

  // Process partial refund with reason
  const processPartialRefund = async (refundReason) => {
    try {
      const token = localStorage.getItem("authToken");
      const managerUsername = localStorage.getItem("username");
      
      if (!managerUsername) {
        alert("Authorization failed. Username not found. Please log in again.");
        return;
      }
      
      const { transaction, itemsToRefund } = pendingRefundData;
      
      const refundItems = itemsToRefund.map(item => ({
        saleItemId: parseInt(item.saleItemId),
        refundQuantity: parseInt(item.refundQuantity),
        itemName: String(item.name),
        originalQuantity: parseInt(item.quantity),
        unitPrice: parseFloat(item.price)
      }));
      
      const requestBody = {
        managerUsername: String(managerUsername),
        refundReason: String(refundReason),
        items: refundItems
      };
      
      const response = await fetch(
        `${PARTIAL_REFUND_API_URL}/${transaction.id}/partial-refund-today`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process partial refund");
      }
      
      const result = await response.json();
      
      if (result.total_refund_amount !== undefined && result.refunded_items) {
        alert(
          `${result.message}\n\n` +
          `Refund Type: ${result.refund_type}\n` +
          `Total Refund Amount: ₱${result.total_refund_amount.toFixed(2)}\n\n` +
          `Refunded Items:\n${result.refunded_items.map(item => 
            `- ${item.item_name} (x${item.quantity}): ₱${item.amount.toFixed(2)}`
          ).join('\n')}`
        );
      } else {
        const totalRefundAmount = refundItems.reduce((sum, item) => 
          sum + (item.unitPrice * item.refundQuantity), 0
        );
        
        alert(
          `${result.message}\n\n` +
          `Order ID: ${result.order_id}\n` +
          `Total Refund Amount: ₱${totalRefundAmount.toFixed(2)}\n\n` +
          `Refunded Items:\n${refundItems.map(item => 
            `- ${item.itemName} (x${item.refundQuantity}): ₱${(item.unitPrice * item.refundQuantity).toFixed(2)}`
          ).join('\n')}`
        );
      }
      
      handleRefresh();
      closeModal();
      
    } catch (error) {
      console.error("Partial refund error:", error);
      alert(`Error processing partial refund: ${error.message}`);
    }
  };

  const filteredTransactions = useMemo(() => {
    const [start, end] = getDateRange();
    return transactions.filter((transaction) => {
      const matchesTab = transaction.type === activeTab;
      
      const searchLower = searchTerm.toLowerCase();
      const cashierFullName = cashiersMap[transaction.cashierName] || transaction.cashierName || "";
      const itemNames = (transaction.items || []).map(item => item.name || "").join(" ");
      const date = new Date(transaction.date);
      const formattedDate = date.toLocaleDateString('en-CA');
      const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      
      const matchesSearch = searchTerm === "" || 
        (transaction.id || "").toString().toLowerCase().includes(searchLower) ||
        formattedDate.toLowerCase().includes(searchLower) ||
        formattedTime.toLowerCase().includes(searchLower) ||
        cashierFullName.toLowerCase().includes(searchLower) ||
        (transaction.cashierName || "").toLowerCase().includes(searchLower) ||
        (transaction.orderType || "").toLowerCase().includes(searchLower) ||
        itemNames.toLowerCase().includes(searchLower) ||
        (transaction.subtotal || "").toString().toLowerCase().includes(searchLower) ||
        (transaction.discount || "").toString().toLowerCase().includes(searchLower) ||
        (transaction.total || "").toString().toLowerCase().includes(searchLower) ||
        (transaction.paymentMethod || "").toLowerCase().includes(searchLower) ||
        (transaction.status || "").toLowerCase().includes(searchLower) ||
        (transaction.GCashReferenceNumber || "").toLowerCase().includes(searchLower);
      
      const matchesStatus = statusFilter === "" || transaction.status === statusFilter;
      const matchesCashier = cashierFilter === "" || cashierFullName === cashierFilter;
      const matchesPaymentMethod = paymentMethodFilter === "" || transaction.paymentMethod === paymentMethodFilter;
      const tDate = new Date(transaction.date);
      const matchesDate = !start || !end || (tDate >= start && tDate <= end);
      
      return matchesTab && matchesSearch && matchesStatus && matchesCashier && matchesPaymentMethod && matchesDate;
    });
  }, [activeTab, transactions, searchTerm, statusFilter, cashierFilter, paymentMethodFilter, cashiersMap, getDateRange]);

  useEffect(() => {
    setStatusFilter("");
    setCashierFilter("");
    setSearchTerm("");
  }, [activeTab]);

  const uniqueStatuses = useMemo(() => {
    const currentTabTransactions = transactions.filter(t => t.type === activeTab);
    return [...new Set(currentTabTransactions.map((item) => item.status).filter(Boolean))];
  }, [transactions, activeTab]);

  const uniqueCashiers = useMemo(() => {
    const allCashierNames = Object.values(cashiersMap).filter(Boolean);
    return [...new Set(allCashierNames)].sort();
  }, [cashiersMap]);

  const uniquePaymentMethods = useMemo(() => {
    const currentTabTransactions = transactions.filter((t) => t.type === activeTab);
    return [...new Set(currentTabTransactions.map((t) => t.paymentMethod).filter(Boolean))];
  }, [transactions, activeTab]);

  const summary = useMemo(() => {
    const totalSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    
    const totalTransactions = filteredTransactions.length;
    
    const cashSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed' && t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    
    const digitalSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed' && t.paymentMethod === 'GCASH')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    
    const totalRefunds = statistics.refund_summary?.totalRefundAmount || 0;
    
    return { totalSales, totalTransactions, totalRefunds, cashSales, digitalSales };
  }, [filteredTransactions, statistics]);

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  const handleRowClick = async (row) => {
    setLoadingOrderDetails(true);
    try {
      const token = getAuthToken();
      const orderId = row.id;
      
      const response = await fetch(
        `${PARTIAL_REFUND_API_URL}/all`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      if (response.ok) {
        const allOrders = await response.json();
        const detailedOrder = allOrders.find(order => order.id === orderId);
        
        if (detailedOrder && detailedOrder.orderItems) {
          const enhancedTransaction = {
            ...row,
            items: detailedOrder.orderItems.map(orderItem => ({
              id: orderItem.id,
              saleItemId: orderItem.id,
              name: orderItem.name,
              quantity: orderItem.quantity,
              price: orderItem.price,
              category: orderItem.category,
              addons: orderItem.addons || [],
              refundedQuantity: row.items.find(i => i.name === orderItem.name)?.refundedQuantity || 0,
              refundAmount: row.items.find(i => i.name === orderItem.name)?.refundAmount || 0,
              isFullyRefunded: row.items.find(i => i.name === orderItem.name)?.isFullyRefunded || false,
              itemDiscounts: row.items.find(i => i.name === orderItem.name)?.itemDiscounts || [],
              itemPromotions: row.items.find(i => i.name === orderItem.name)?.itemPromotions || []
            }))
          };
          
          setSelectedTransaction(enhancedTransaction);
        } else {
          setSelectedTransaction(row);
        }
      } else {
        setSelectedTransaction(row);
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
      setSelectedTransaction(row);
    } finally {
      setLoadingOrderDetails(false);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const handleCustomDateApply = (startDate, endDate) => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;
    setCustomStart(startDate);
    setCustomEnd(endDate);
    setDateRange("custom");
    setIsCustomModalOpen(false);
  };

  const dotStyle = {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#ffffff",
    animation: "bounce 0.6s infinite",
  };

  const columns = [
    { name: "ORDER", selector: (row) => row.id, cell: (row) => <div style={{ fontWeight: "600" }}>{row.id}</div>, sortable: true, width: "7%", left: true },
    {
      name: "DATE & TIME", selector: (row) => new Date(row.date),
      cell: (row) => {
        const date = new Date(row.date);
        return (
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: "500" }}>{date.toLocaleDateString('en-CA')}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
          </div>
        );
      }, sortable: true, width: "10%",
    },
    { name: "CASHIER", selector: (row) => cashiersMap[row.cashierName] || row.cashierName || "—", width: "10%", center: true },
    { name: "ORDER TYPE", selector: (row) => row.orderType || "—", width: "10%", center: true },
    { name: "ITEMS", selector: (row) => row.items?.map(item => item.name).join(', ') || "—", width: "13%", center: true },
    { name: "QTY", selector: (row) => row.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0, sortable: true, width: "5%", center: true },
    { name: "SUBTOTAL", selector: (row) => row.subtotal, cell: (row) => <div style={{ fontWeight: "600" }}>₱{parseFloat(row.subtotal).toFixed(2)}</div>, sortable: true, width: "10%", center: true },
    { name: "REFUND", selector: (row) => row.refundInfo?.totalRefundAmount || 0, cell: (row) => <div style={{ color: row.refundInfo?.totalRefundAmount > 0 ? "#dc3545" : "#666" }}>₱{parseFloat(row.refundInfo?.totalRefundAmount || 0).toFixed(2)}</div>, sortable: true, width: "7%", center: true },
    { name: "DISCOUNT", selector: (row) => (row.discount || 0) + (row.promotionalDiscount || 0), cell: (row) => <div>₱{(parseFloat(row.discount || 0) + parseFloat(row.promotionalDiscount || 0)).toFixed(2)}</div>, sortable: true, width: "8%", center: true },
    {
      name: "PAYMENT",
      selector: (row) => row.total,
      cell: (row) => {
        const totalAmount =
          row.status.toLowerCase() === "refunded"
            ? "0.00"
            : parseFloat(row.total).toFixed(2);

        return (
          <div style={{ textAlign: "left", lineHeight: "1.3" }}>
            <div style={{ fontWeight: "700" }}>₱{totalAmount}</div>
            <div style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>
              {row.paymentMethod || "N/A"}
            </div>
          </div>
        );
      },
      sortable: true,
      width: "10%",
      center: false,
    },
    {
      name: "STATUS", 
      selector: (row) => row.status,
      cell: (row) => {
        const displayStatus = getDisplayStatus(row);
        const statusClass = displayStatus === 'Part-Refund' ? 'partially-refunded' : row.status.toLowerCase();
        return <span className={`transHis-status-badge ${statusClass}`}>{displayStatus.toUpperCase()}</span>;
      },
      sortable: true, 
      width: "10%", 
      center: true,
    },
  ];

  const handleExportClick = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      setIsNoDataModalOpen(true);
      return;
    } 
    setIsExportModalOpen(true);
  };

  const handleExportPDF = () => {
    setIsExportModalOpen(false);

    const exportedBy = "Admin";
    const dateFilterLabel = dateRange === "custom"
      ? `${new Date(customStart).toLocaleDateString()} - ${new Date(customEnd).toLocaleDateString()}`
      : dateRange.charAt(0).toUpperCase() + dateRange.slice(1);

    generatePDFReport(
      filteredTransactions,
      activeTab,
      statusFilter || "All",
      exportedBy,
      dateFilterLabel,
      cashiersMap
    );
  };

  const handleExportCSV = () => {
    setIsExportModalOpen(false);
    generateCSVReport(filteredTransactions, cashiersMap);
  };

  return (
    <div className="transHis-page">
      <Sidebar />
      <div className="transHis">
        <Header pageTitle="Transaction History" />
        <div className="transHis-content">
          <div className="transHis-tabs-filter-wrapper">
            <div className="transHis-tabs">
              <button className={`transHis-tab ${activeTab === "Store" ? "transHis-tab-active" : ""}`} onClick={() => setActiveTab("Store")}>Store</button>
              <button className={`transHis-tab ${activeTab === "Online" ? "transHis-tab-active" : ""}`} onClick={() => setActiveTab("Online")}>Online</button>
            </div>
            {!loading && (
              <div className={`transHis-filter-bar ${isFilterOpen ? "open" : "collapsed"}`}>
                <button className="transHis-filter-toggle-btn" onClick={() => setIsFilterOpen(!isFilterOpen)}><FaFilter /><span className="transHis-period-text">Date {currentPeriodText}</span></button>
                <div className="transHis-filter-item"><div className="transHis-search-wrapper"><FaSearch className="transHis-search-icon" /><input type="text" placeholder="Search Transaction..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="transHis-search-input"/></div></div>
                <div className="transHis-filter-item"><span>Period:</span><select value={dateRange}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDateRange(v);
                      if (v === "custom") {
                        if (!customStart || !customEnd) {
                          const today = new Date().toISOString().split('T')[0];
                          const weekAgo = startOfWeek(new Date()).toISOString().split('T')[0];
                          setCustomStart(weekAgo);
                          setCustomEnd(today);
                        }
                        setIsCustomModalOpen(true);
                      }
                    }} className="transHis-select transHis-select-date">
                    <option value="today">Today</option><option value="thisWeek">This Week</option><option value="thisMonth">This Month</option><option value="thisYear">This Year</option><option value="custom">Custom</option>
                  </select>
                </div>
                <div className="transHis-filter-item"><span>Cashier:</span><select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)} className="transHis-select transHis-select-cashier">
                    <option value="">All Cashiers</option>{uniqueCashiers.map((cashier) => (<option key={cashier} value={cashier}>{cashier}</option>))}
                  </select>
                </div>
                <div className="transHis-filter-item"><span>Payment:</span><select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)} className="transHis-select transHis-select-payment">
                    <option value="">All Methods</option>{uniquePaymentMethods.map((method) => (<option key={method} value={method}>{method}</option>))}
                  </select>
                </div>
                <div className="transHis-filter-item"><span>Status:</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="transHis-select transHis-select-status">
                    <option value="">All Status</option>{uniqueStatuses.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <button className="transHis-clear-btn" onClick={handleClearFilters}>Clear Filters</button>
                <button 
                  className="transHis-export-btn" 
                  onClick={handleExportClick}
                  disabled={!filteredTransactions || filteredTransactions.length === 0}
                >
                  <FaFileExport /> Export
                </button>
              </div>
            )}
          </div>
          {loading ? (
            <Loading />
          ) : error || authError ? (
            <UnableToLoadData />
          ) : filteredTransactions.length === 0 ? (
            <NoData />
          ) : (
            <>
              <div className="transHis-cards-container">
                <div className="transHis-stat-card"><div className="transHis-card-icon transHis-icon-teal"><FaCashRegister /></div><div className="transHis-card-content"><div className="transHis-card-label">TOTAL SALES</div><div className="transHis-card-value">{formatCurrency(summary.totalSales)}</div></div></div>
                <div className="transHis-stat-card"><div className="transHis-card-icon transHis-icon-blue"><FaCheckCircle /></div><div className="transHis-card-content"><div className="transHis-card-label">TOTAL TRANSACTIONS</div><div className="transHis-card-value">{summary.totalTransactions}</div></div></div>
                <div className="transHis-stat-card"><div className="transHis-card-icon transHis-icon-red"><HiReceiptRefund /></div><div className="transHis-card-content"><div className="transHis-card-label">TOTAL REFUNDS</div><div className="transHis-card-value">{formatCurrency(summary.totalRefunds)}</div></div></div>
                <div className="transHis-stat-card"><div className="transHis-card-icon transHis-icon-green"><MdPayments /></div><div className="transHis-card-content"><div className="transHis-card-label">CASH SALES</div><div className="transHis-card-value">{formatCurrency(summary.cashSales)}</div></div></div>
                <div className="transHis-stat-card"><div className="transHis-card-icon transHis-icon-cyan"><RiSmartphoneFill /></div><div className="transHis-card-content"><div className="transHis-card-label">GCASH</div><div className="transHis-card-value">{formatCurrency(summary.digitalSales)}</div></div></div>
              </div>
              <div className="transHis-table-container">
                {loadingOrderDetails && (
                  <div
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      width: "100vw",
                      height: "100vh",
                      background: "rgba(0,0,0,0.25)",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      zIndex: 9999
                    }}
                  >
                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={dotStyle}></div>
                      <div style={{ ...dotStyle, animationDelay: "0.2s" }}></div>
                      <div style={{ ...dotStyle, animationDelay: "0.4s" }}></div>
                    </div>

                    <style>
                      {`
                        @keyframes bounce {
                          0% { transform: translateY(0); opacity: 0.4; }
                          50% { transform: translateY(-8px); opacity: 1; }
                          100% { transform: translateY(0); opacity: 0.4; }
                        }
                      `}
                    </style>
                  </div>
                )}
                <DataTable
                  columns={columns} 
                  data={filteredTransactions} 
                  striped 
                  highlightOnHover 
                  responsive 
                  pagination 
                  paginationPerPage={7} 
                  paginationRowsPerPageOptions={[7]}
                  fixedHeader 
                  fixedHeaderScrollHeight="60vh" 
                  onRowClicked={handleRowClick} 
                  pointerOnHover 
                  customStyles={{
                    headCells: { style: { backgroundColor: "#4B929D", color: "#fff", fontWeight: "600", fontSize: "14px", padding: "12px", textTransform: "uppercase", textAlign: "center", letterSpacing: "1px"}},
                    rows: { style: { minHeight: "55px", padding: "5px"}},
                  }}
                />
                {selectedTransaction && (
                  <TransHisModal 
                    show={isModalOpen} 
                    onClose={closeModal} 
                    transaction={selectedTransaction}
                    onRefundOrder={handleFullRefund}
                    onPartialRefund={handlePartialRefund}
                    cashiersMap={cashiersMap}
                  />
                )}
              </div>
              <CustomDateModal show={isCustomModalOpen} onClose={() => setIsCustomModalOpen(false)} onApply={handleCustomDateApply} initialStart={customStart} initialEnd={customEnd} />
            </>
          )}
        </div>
      </div>
      {isExportModalOpen && (
        <ExportModal
          onClose={() => setIsExportModalOpen(false)}
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
        />
      )}

      {isNoDataModalOpen && (
        <NoDataModal onClose={() => setIsNoDataModalOpen(false)} />
      )}

      {isRefundReasonModalOpen && (
        <RefundReasonModal
          onClose={() => {
            setIsRefundReasonModalOpen(false);
            setPendingRefundData(null);
            setRefundType(null);
          }}
          onSubmit={(reason) => {
            setIsRefundReasonModalOpen(false);
            if (refundType === 'full') {
              processFullRefund(reason);
            } else if (refundType === 'partial') {
              processPartialRefund(reason);
            }
            setPendingRefundData(null);
            setRefundType(null);
          }}
        />
      )}
    </div>
  );
}

export default TransactionHistory;