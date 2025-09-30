import React, { useState, useEffect } from "react";
import "./transactionReport.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import CustomDateModal from "../shared/customDateModal.js";
import {
  BarChart, Bar, LineChart, Line, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

function TransactionReports() {
  const [activeTab, setActiveTab] = useState("daily");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [periodText, setPeriodText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Chart data states
  const [totalTransactionsData, setTotalTransactionsData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [storeVsOnline, setStoreVsOnline] = useState([]);
  const [discountPromoData, setDiscountPromoData] = useState([]);
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    completedTransactions: 0,
    totalRevenue: 0,
    averageTransactionValue: 0
  });

  const COLORS = ["#4B929D", "#2490a0ff", "#237481ff", "#dc3545", "#AA336A"];

  // Fetch transaction report data from backend
  const fetchReportData = async (period, customStartDate = null, customEndDate = null) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      
      console.log("Token from localStorage:", token ? "Token exists" : "No token found");
      
      if (!token) {
        throw new Error("No authentication token found. Please login again.");
      }

      let url = `http://localhost:9000/auth/transaction_history/report?period=${period}`;
      
      if (period === "custom" && customStartDate && customEndDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }

      console.log("Fetching from URL:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have permission to view transaction reports");
        } else if (response.status === 401) {
          throw new Error("Session expired. Please login again");
        }
        throw new Error(`Failed to fetch report data: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update chart data
      setTotalTransactionsData(data.totalTransactions || []);
      setStatusData(data.statusData || []);
      setStoreVsOnline(data.storeVsOnline || []);
      setDiscountPromoData(data.discountPromoData || []);
      setSummary(data.summary || {
        totalTransactions: 0,
        completedTransactions: 0,
        totalRevenue: 0,
        averageTransactionValue: 0
      });

    } catch (err) {
      console.error("Error fetching report data:", err);
      setError(err.message);
      
      // Set empty data on error
      setTotalTransactionsData([]);
      setStatusData([]);
      setStoreVsOnline([]);
      setDiscountPromoData([]);
    } finally {
      setLoading(false);
    }
  };

  // Update period text and fetch data whenever tab changes
  useEffect(() => {
    const today = new Date();
    const options = { month: "long", day: "numeric", year: "numeric" };

    switch (activeTab) {
      case "daily":
        setPeriodText(`Date: ${today.toLocaleDateString("en-US", options)}`);
        fetchReportData("daily");
        break;
      case "weekly": {
        // Last 7 days: today back to 6 days ago
        const lastDay = new Date(today);
        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - 6);

        const start = firstDay.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const end = lastDay.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        setPeriodText(`Date Period: ${start} - ${end}`);
        fetchReportData("weekly");
        break;
      }
      
      case "monthly":
        setPeriodText(`Month: ${today.toLocaleDateString("en-US", { month: "long" })}`);
        fetchReportData("monthly");
        break;
      case "yearly":
        setPeriodText(`Year: ${today.getFullYear()}`);
        fetchReportData("yearly");
        break;
      default:
        // Don't fetch for custom until user applies date range
        if (activeTab !== "custom") {
          setPeriodText("");
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleApplyCustomDate = (start, end) => {
    setPeriodText(`Date Period: ${start} - ${end}`);
    setActiveTab("custom");
    fetchReportData("custom", start, end);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(value);
  };

  return (
    <div className="transaction-reports">
      <Sidebar />
      <div className="transRep">
        <Header pageTitle="Transaction Reports" />
        
        <div className="transRep-header-row">
          <div className="period-text-label">
            {periodText}
          </div>
          <div className="transRep-dropdown">
            <select
              value={activeTab}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setIsCustomModalOpen(true);
                } else {
                  setActiveTab(e.target.value);
                }
              }}
            >
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="yearly">This Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <h3>Total Transactions</h3>
            <p className="summary-value">{summary.totalTransactions || 0}</p>
          </div>
          <div className="summary-card">
            <h3>Completed</h3>
            <p className="summary-value">{summary.completedTransactions || 0}</p>
          </div>
          <div className="summary-card">
            <h3>Total Revenue</h3>
            <p className="summary-value">{formatCurrency(summary.totalRevenue || 0)}</p>
          </div>
          <div className="summary-card">
            <h3>Avg Transaction</h3>
            <p className="summary-value">{formatCurrency(summary.averageTransactionValue || 0)}</p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-container">
            <p>Loading report data...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="error-container">
            <p className="error-message">Error: {error}</p>
            <button onClick={() => fetchReportData(activeTab)}>Retry</button>
          </div>
        )}

        {/* Charts Container */}
        {!loading && !error && (
          <div className="charts-container">
            <div className="chart-card">
              <h2>Total Transactions</h2>
              {totalTransactionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={totalTransactionsData}>
                    <defs>
                      <linearGradient id="colorTransactions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4B929D" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#4B929D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <CartesianGrid strokeDasharray="3 3" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="transactions"
                      stroke="#4B929D"
                      fillOpacity={1}
                      fill="url(#colorTransactions)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No transaction data available for this period</div>
              )}
            </div>

            <div className="chart-card">
              <h2>Transaction Status</h2>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="transactions" fill="#4B929D" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No status data available for this period</div>
              )}
            </div>

            <div className="chart-card">
              <h2>Transactions: Store vs Online</h2>
              {storeVsOnline.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={storeVsOnline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="store" 
                      stroke="#237481ff" 
                      strokeWidth={2}
                      name="Store"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="online" 
                      stroke="#08bfdbff" 
                      strokeWidth={2}
                      name="Online"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No store vs online data available for this period</div>
              )}
            </div>

            <div className="chart-card">
              <h2>Transactions: Discounts & Promotions</h2>
              {discountPromoData.length > 0 && discountPromoData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={discountPromoData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {discountPromoData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No discount data available for this period</div>
              )}
            </div>
          </div>
        )}

        <CustomDateModal
          show={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          onApply={handleApplyCustomDate}
        />
      </div>
    </div>
  );
}

export default TransactionReports;