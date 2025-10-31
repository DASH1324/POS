import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./transactionHistory.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import CustomDateModal from "../shared/customDateModal";
import DataTable from "react-data-table-component";
import TransHisModal from "./modals/transactionDetailsModal";
import { startOfToday, startOfMonth, startOfYear, endOfToday,
endOfMonth, endOfYear, subDays
} from "date-fns";
import { FaFileExport, FaFilter, FaSearch, FaDollarSign, FaCashRegister, FaChartLine, FaCheckCircle } from "react-icons/fa";
import { RiSmartphoneFill } from "react-icons/ri";
import { HiReceiptRefund } from "react-icons/hi2";
import { MdPayments } from "react-icons/md";
import handleExport from "./transactionHistoryExport";
import loadingAnimation from "../../../assets/animation/loading.json";
import Lottie from "lottie-react";
import '../../confirmAlertCustom.css';

const getAuthToken = () => {
  return localStorage.getItem("authToken");
};

const API_URL = "http://127.0.0.1:9000/auth/transaction_history/all";
const CASHIERS_API_URL = "http://127.0.0.1:4000/users/cashiers";

// Helper function for displaying date ranges (short month format)
const getPeriodText = (dateRange, customStart, customEnd) => {
  const today = new Date();

  switch (dateRange) {
    case "today": {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return today.toLocaleDateString('en-US', options);
    }
    case "thisWeek": {
      const lastDayOfWeek = new Date(today);
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - 7);

      const start = firstDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = lastDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} - ${end}`;
    }
    case "thisMonth": {
      return today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    case "thisYear": {
      return today.toLocaleDateString('en-US', { year: 'numeric' });
    }
    case "custom": {
      if (customStart && customEnd) {
        const start = new Date(customStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const end = new Date(customEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${start} - ${end}`;
      }
      return "Custom Range";
    }
    default:
      return "";
  }
};

// Transform API data
const transformApiData = (apiTransaction) => {
  let transactionType = apiTransaction.type;
  
  if (apiTransaction.orderType === "Dine in" || apiTransaction.orderType === "Take out") {
    transactionType = "Store";
  } else if (apiTransaction.orderType === "Pick Up" || apiTransaction.orderType === "Delivery") {
    transactionType = "Online";
  }
  
  return {
    id: apiTransaction.id,
    date: new Date(apiTransaction.date).toISOString(),
    orderType: apiTransaction.orderType,
    items: apiTransaction.items || [],
    total: apiTransaction.total,
    subtotal: apiTransaction.subtotal,
    discount: apiTransaction.discount,
    status: apiTransaction.status,
    paymentMethod: apiTransaction.paymentMethod,
    type: transactionType,
    discountsAndPromotions: apiTransaction.discountsAndPromotions,
    cashierName: apiTransaction.cashierName,
    GCashReferenceNumber: apiTransaction.GCashReferenceNumber,
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
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText('thisWeek', '', ''));

  const handleAuthError = () => {
    localStorage.removeItem("authToken");
    setAuthError(true);
    navigate("/");
  };

  // Fetch cashiers for mapping usernames to full names
  const fetchCashiers = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://127.0.0.1:4000/users/cashiers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  const fetchTransactions = useCallback(
    async (token) => {
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
          throw new Error(
            `HTTP error! Status: ${response.status} - ${errorText}`
          );
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
    },
    [navigate]
  );

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

  useEffect(() => {
    setCurrentPeriodText(getPeriodText(dateRange, customStart, customEnd));
  }, [dateRange, customStart, customEnd]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setCashierFilter("");
    setDateRange("thisWeek");
    setCustomStart("");
    setCustomEnd("");
  };

  const handleRefresh = () => {
    const token = getAuthToken();
    if (token) {
      fetchTransactions(token);
    } else {
      navigate("/");
    }
  };

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return [startOfToday(), endOfToday()];
      case "thisWeek":
        const weekAgo = subDays(now, 7);
        return [weekAgo, now];
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
      
      const matchesStatus =
        statusFilter === "" || transaction.status === statusFilter;
      
      const matchesCashier = 
        cashierFilter === "" || cashierFullName === cashierFilter;

      const matchesPaymentMethod =
      paymentMethodFilter === "" || transaction.paymentMethod === paymentMethodFilter;
      
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
    const currentTabTransactions = transactions.filter(
      (t) => t.type === activeTab
    );
    return [
      ...new Set(
        currentTabTransactions.map((item) => item.status).filter(Boolean)
      ),
    ];
  }, [transactions, activeTab]);

  const uniqueCashiers = useMemo(() => {
    const allCashierNames = Object.values(cashiersMap).filter(Boolean);
    return [...new Set(allCashierNames)].sort();
  }, [cashiersMap]);

  const uniquePaymentMethods = useMemo(() => {
    const currentTabTransactions = transactions.filter((t) => t.type === activeTab);
    return [
      ...new Set(currentTabTransactions.map((t) => t.paymentMethod).filter(Boolean)),
    ];
  }, [transactions, activeTab]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    
    const totalTransactions = filteredTransactions.length;
    
    const totalRefunds = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'refund' || t.status.toLowerCase() === 'return')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    
    const cashSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed' && t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    
    const digitalSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed' && t.paymentMethod === 'GCash')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    
    return {
      totalSales,
      totalTransactions,
      totalRefunds,
      cashSales,
      digitalSales
    };
  }, [filteredTransactions]);

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  const handleRowClick = (row) => {
    setSelectedTransaction(row);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const handleCustomDateApply = (startDate, endDate) => {
    if (!startDate || !endDate) {
      console.error("Invalid dates:", startDate, endDate);
      return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error("Invalid date format");
      return;
    }
    
    if (start > end) {
      console.error("Start date cannot be after end date");
      return;
    }
    
    setCustomStart(startDate);
    setCustomEnd(endDate);
    setDateRange("custom");
    setIsCustomModalOpen(false);
  };

  const columns = [
    {
      name: "ORDER",
      selector: (row) => row.id,
      cell: (row) => <div style={{ fontWeight: "600" }}>{row.id}</div>,
      sortable: true,
      width: "9%",
      left: true,
    },
    {
      name: "DATE & TIME",
      selector: (row) => new Date(row.date),
      cell: (row) => {
        const date = new Date(row.date);
        return (
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: "500" }}>{date.toLocaleDateString('en-CA')}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
        );
      },
      sortable: true,
      width: "11%",
    },
    {
      name: "CASHIER",
      selector: (row) => cashiersMap[row.cashierName] || row.cashierName || "—",
      width: "9%",
      center: true,
    },
    {
      name: "ORDER TYPE",
      selector: (row) => row.orderType || "—",
      width: "8%",
      center: true,
    },
    {
      name: "ITEMS",
      selector: (row) => row.items?.map(item => item.name).join(', ') || "—",
      width: "15%",
      center: true,
    },
    {
      name: "QTY",
      selector: (row) => row.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0,
      sortable: true,
      width: "6%",
      center: true,
    },
    {
      name: "SUBTOTAL",
      selector: (row) => row.subtotal,
      cell: (row) => <div style={{ fontWeight: "600" }}>₱{parseFloat(row.subtotal).toFixed(2)}</div>,
      sortable: true,
      width: "8%",
      center: true,
    },
    {
      name: "DISCOUNT",
      selector: (row) => row.discount,
      cell: (row) => <div>₱{parseFloat(row.discount || 0).toFixed(2)}</div>,
      sortable: true,
      width: "8%",
      center: true,
    },
    {
      name: "PAYMENT",
      selector: (row) => row.paymentMethod || "N/A",
      width: "8%",
      center: true,
    },
    {
      name: "TOTAL",
      selector: (row) => row.total,
      cell: (row) => <div style={{ fontWeight: "600" }}>₱{parseFloat(row.total).toFixed(2)}</div>,
      sortable: true,
      width: "8%",
      center: true,
    },
    {
      name: "STATUS",
      selector: (row) => row.status,
      cell: (row) => (
        <span className={`transHis-status-badge ${row.status.toLowerCase()}`}>
          {row.status.toUpperCase()}
        </span>
      ),
      sortable: true,
      width: "10%",
      center: true,
    },
  ];

  if (authError) {
    return (
      <div className="transHis-page">
        <Sidebar />
        <div className="transHis">
          <Header pageTitle="Transaction History" />
          <div className="transHis-content">
            <div style={{ padding: "20px", textAlign: "center", color: "red" }}>
              Authentication failed. Please login again.
              <br />
              <button onClick={() => navigate("/")}>Go to Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transHis-page">
        <Sidebar />
        <div className="transHis">
          <Header pageTitle="Transaction History" />
          <div className="transHis-content">
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ color: "red", marginBottom: "10px" }}>
                Error loading transactions: {error}
              </div>
              <button onClick={handleRefresh} style={{ marginRight: "10px" }}>
                Retry
              </button>
              <button onClick={() => navigate("/")}>Back to Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="transHis-page">
      <Sidebar />
      <div className="transHis">
        <Header pageTitle="Transaction History" />
        <div className="transHis-content">
          {/* Tabs and Filter Bar Wrapper */}
          <div className="transHis-tabs-filter-wrapper">
            {/* Tabs - Left Side */}
            <div className="transHis-tabs">
              <button
                className={`transHis-tab ${activeTab === "Store" ? "transHis-tab-active" : ""}`}
                onClick={() => setActiveTab("Store")}
              >
                Store
              </button>
              <button
                className={`transHis-tab ${activeTab === "Online" ? "transHis-tab-active" : ""}`}
                onClick={() => setActiveTab("Online")}
              >
                Online
              </button>
            </div>

            {!loading && (
              <div className={`transHis-filter-bar ${isFilterOpen ? "open" : "collapsed"}`}>
                <button
                  className="transHis-filter-toggle-btn"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                  <FaFilter />
                  <span className="transHis-period-text">Date {currentPeriodText}</span>
                </button>

                <div className="transHis-filter-item">
                  <div className="transHis-search-wrapper">
                  <FaSearch className="transHis-search-icon" />
                  <input
                    type="text"
                    placeholder="Search Transaction..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="transHis-search-input"
                  />
                </div>
                </div>


                <div className="transHis-filter-item">
                  <span>Period:</span>
                  <select
                    value={dateRange}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDateRange(v);
                      if (v === "custom") {
                        if (!customStart || !customEnd) {
                          const today = new Date().toISOString().split('T')[0];
                          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                          setCustomStart(weekAgo);
                          setCustomEnd(today);
                        }
                        setIsCustomModalOpen(true);
                      }
                    }}
                    className="transHis-select transHis-select-date"
                  >
                    <option value="today">Today</option>
                    <option value="thisWeek">This Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="thisYear">This Year</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="transHis-filter-item">
                  <span>Cashier:</span>
                  <select
                    value={cashierFilter}
                    onChange={(e) => setCashierFilter(e.target.value)}
                    className="transHis-select transHis-select-cashier"
                  >
                    <option value="">All Cashiers</option>
                    {uniqueCashiers.map((cashier) => (
                      <option key={cashier} value={cashier}>
                        {cashier}
                      </option>
                    ))}
                  </select>
                </div>

              <div className="transHis-filter-item">
                <span>Payment:</span>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="transHis-select transHis-select-payment"
                >
                  <option value="">All Methods</option>
                  {uniquePaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

                <div className="transHis-filter-item">
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="transHis-select transHis-select-status"
                  >
                    <option value="">All Status</option>
                    {uniqueStatuses.map((s) => (
                      <option key={s} value={s}>  
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <button className="transHis-clear-btn" onClick={handleClearFilters}>
                  Clear Filters
                </button>

                <button
                  className="transHis-export-btn"
                  onClick={() => {
                    const exportedBy = "Admin";
                    const dateFilterLabel = dateRange === "custom" 
                      ? `${new Date(customStart).toLocaleDateString()} - ${new Date(customEnd).toLocaleDateString()}`
                      : dateRange.charAt(0).toUpperCase() + dateRange.slice(1);
                    
                    handleExport(
                      filteredTransactions, 
                      activeTab, 
                      statusFilter || "All",
                      exportedBy,
                      dateFilterLabel
                    );
                  }}
                >
                  <FaFileExport /> Export
                </button>
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-bg">
                <Lottie animationData={loadingAnimation} loop={true} className="loading-animation" />
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {filteredTransactions.length > 0 && (
                <div className="transHis-cards-container">
                  <div className="transHis-stat-card">
                    <div className="transHis-card-icon transHis-icon-teal">
                      <FaCashRegister />
                    </div>
                    <div className="transHis-card-content">
                      <div className="transHis-card-label">TOTAL SALES</div>
                      <div className="transHis-card-value">{formatCurrency(summary.totalSales)}</div>
                    </div>
                  </div>

                  <div className="transHis-stat-card">
                    <div className="transHis-card-icon transHis-icon-blue">
                      <FaCheckCircle />
                    </div>
                    <div className="transHis-card-content">
                      <div className="transHis-card-label">TOTAL TRANSACTIONS</div>
                      <div className="transHis-card-value">{summary.totalTransactions}</div>
                    </div>
                  </div>

                  <div className="transHis-stat-card">
                    <div className="transHis-card-icon transHis-icon-red">
                      <HiReceiptRefund />
                    </div>
                    <div className="transHis-card-content">
                      <div className="transHis-card-label">TOTAL REFUNDS</div>
                      <div className="transHis-card-value">{formatCurrency(summary.totalRefunds)}</div>
                    </div>
                  </div>

                  <div className="transHis-stat-card">
                    <div className="transHis-card-icon transHis-icon-green">
                      <MdPayments />
                    </div>
                    <div className="transHis-card-content">
                      <div className="transHis-card-label">CASH SALES</div>
                      <div className="transHis-card-value">{formatCurrency(summary.cashSales)}</div>
                    </div>
                  </div>

                  <div className="transHis-stat-card">
                    <div className="transHis-card-icon transHis-icon-cyan">
                      <RiSmartphoneFill />
                    </div>
                    <div className="transHis-card-content">
                      <div className="transHis-card-label">GCASH</div>
                      <div className="transHis-card-value">{formatCurrency(summary.digitalSales)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="transHis-table-container">
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
                  noDataComponent={
                    <div style={{ padding: "24px" }}>
                      No {activeTab.toLowerCase()} transactions found.
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
                        letterSpacing: "1px",
                      },
                    },
                    rows: {
                      style: {
                        minHeight: "55px",
                        padding: "5px",
                      },
                    },
                  }}
                />

                {selectedTransaction && (
                  <TransHisModal
                    show={isModalOpen}
                    onClose={closeModal}
                    transaction={selectedTransaction}
                  />
                )}
              </div>

              <CustomDateModal
                show={isCustomModalOpen}
                onClose={() => setIsCustomModalOpen(false)}
                onApply={handleCustomDateApply}
                initialStart={customStart}
                initialEnd={customEnd}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionHistory;