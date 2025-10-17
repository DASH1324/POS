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
import { FaFileExport } from "react-icons/fa";
import handleExport from "./transactionHistoryExport";

const getAuthToken = () => {
  return localStorage.getItem("authToken");
};

const API_URL = "http://127.0.0.1:9000/auth/transaction_history/all";

// Transform API data
const transformApiData = (apiTransaction) => {
  // Determine the type based on orderType
  let transactionType = apiTransaction.type;
  
  // Override type based on orderType
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
    type: transactionType, // Use the determined type
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
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState("thisWeek");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(false);

  const handleAuthError = () => {
    localStorage.removeItem("authToken");
    setAuthError(true);
    navigate("/");
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

  // Initial load
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate("/");
      return;
    }
    fetchTransactions(token);
  }, [navigate, fetchTransactions]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
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
        // This week = last 7 days from today
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
      
      // Enhanced search - search across multiple fields
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === "" || 
        (transaction.id || "").toString().toLowerCase().includes(searchLower) ||
        new Date(transaction.date).toLocaleDateString().toLowerCase().includes(searchLower) ||
        (transaction.cashierName || "").toLowerCase().includes(searchLower) ||
        (transaction.orderType || "").toLowerCase().includes(searchLower) ||
        (transaction.paymentMethod || "").toLowerCase().includes(searchLower);
      
      const matchesStatus =
        statusFilter === "" || transaction.status === statusFilter;
      const tDate = new Date(transaction.date);
      const matchesDate = !start || !end || (tDate >= start && tDate <= end);
      return matchesTab && matchesSearch && matchesStatus && matchesDate;
    });
  }, [activeTab, transactions, searchTerm, statusFilter, getDateRange]);

  useEffect(() => {
    setStatusFilter("");
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

  const handleRowClick = (row) => {
    setSelectedTransaction(row);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const handleCustomDateApply = (startDate, endDate) => {
    // Validate that both dates are complete and valid
    if (!startDate || !endDate) {
      console.error("Invalid dates:", startDate, endDate);
      return;
    }
    
    // Check if dates are valid
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
      name: "NUMBER",
      selector: (row, index) => index + 1,
      cell: (row, index) => `${index + 1}`,
      sortable: false,
      width: "10%",
      center: true,
    },
    {
      name: "DATE",
      selector: (row) => new Date(row.date).toLocaleDateString(),
      sortable: true,
      width: "10%",
      center: true,
    },
    {
      name: "CASHIER",
      selector: (row) => row.cashierName || "—",
      width: "15%",
      center: true,
    },
    {
      name: "ORDER TYPE",
      selector: (row) => row.orderType || "—",
      width: "10%",
      center: true,
    },
    {
      name: "ITEM",
      selector: (row) => row.items?.length || 0,
      sortable: true,
      width: "10%",
      center: true,
    },
    {
      name: "DISCOUNTS OR PROMO",
      selector: (row) => row.discountsAndPromotions || "—",
      width: "15%",
      center: true,
    },
    {
      name: "TOTAL",
      selector: (row) => `₱${parseFloat(row.total).toFixed(2)}`,
      sortable: true,
      width: "10%",
      center: true,
    },
    {
      name: "PAYMENT",
      selector: (row) => row.paymentMethod || "N/A",
      width: "10%",
      center: true,
    },
    {
      name: "STATUS",
      selector: (row) => row.status,
      cell: (row) => (
        <span className={`transHis-status-badge ${row.status.toLowerCase()}`}>
          {row.status}
        </span>
      ),
      sortable: true,
      width: "10%",
      center: true,
    },
  ];

  // Auth error state
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

  // Error state
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

          <div className="transHis-filter-bar">
            <input
              type="text"
              placeholder="Search Transaction..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={dateRange}
              onChange={(e) => {
                const v = e.target.value;
                setDateRange(v);
                if (v === "custom") {
                  // Set default custom dates if not already set
                  if (!customStart || !customEnd) {
                    const today = new Date().toISOString().split('T')[0];
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    setCustomStart(weekAgo);
                    setCustomEnd(today);
                  }
                  setIsCustomModalOpen(true);
                }
              }}
            >
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="thisMonth">This Month</option>
              <option value="thisYear">This Year</option>
              <option value="custom">Custom</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>  
                  {s}
                </option>
              ))}
            </select>
            <button className="transHis-clear-btn" onClick={handleClearFilters}>
              Clear Filters
            </button>
            <button
              className="transHis-export-btn"
              onClick={() => {
                const exportedBy = "Admin"; // Or get from your auth context/user data
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

          <div className="transHis-table-container">
            <DataTable
              columns={columns}
              data={filteredTransactions}
              striped
              highlightOnHover
              responsive
              pagination
              fixedHeader
              fixedHeaderScrollHeight="60vh"
              onRowClicked={handleRowClick}
              pointerOnHover
              progressPending={loading}
              progressComponent={
                <div style={{ padding: "24px", textAlign: "center" }}>
                  Loading transactions...
                </div>
              }
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
        </div>
      </div>
    </div>
  );
}

export default TransactionHistory;