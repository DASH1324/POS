import React, { useState, useEffect } from "react";
import "./transactionReport.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import CustomDateModal from "../shared/customDateModal.js";
import {
  BarChart, Bar, LineChart, Line, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { FaReceipt, FaCheckCircle, FaDollarSign, FaChartLine } from "react-icons/fa";

// --- HELPER: Formats a date object to 'YYYY-MM-DD' string ---
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- HELPER FUNCTION FOR DISPLAYING DATE RANGES ---
const getPeriodText = (tab, customStart = null, customEnd = null) => {
  const today = new Date();

  switch (tab) {
    case "daily": {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return `Date: ${today.toLocaleDateString('en-US', options)}`;
    }
    case "weekly": {
      const lastDayOfWeek = new Date(today);
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - 6);

      const start = firstDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = lastDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `Date Period: ${start} - ${end}`;
    }
    case "monthly": {
      return `Month: ${today.toLocaleDateString('en-US', { month: 'long' })}`;
    }
    case "yearly": {
      return `Year: ${today.getFullYear()}`;
    }
    case "custom": {
      if (customStart && customEnd) {
        const startDate = new Date(customStart);
        const endDate = new Date(customEnd);
        const timeZoneOffset = startDate.getTimezoneOffset() * 60000;

        const start = new Date(startDate.getTime() + timeZoneOffset).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const end = new Date(endDate.getTime() + timeZoneOffset).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return `Date Period: ${start} - ${end}`;
      }
      return "Date Period: None Selected";
    }
    default:
      return "";
  }
};

function TransactionReports() {
  const [activeTab, setActiveTab] = useState("daily");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText("daily"));
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [isLoading, setIsLoading] = useState(false);
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
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("Authentication token not found. Please log in.");
      }

      let url = `http://localhost:9000/auth/transaction_history/report?period=${period}`;
      
      if (period === "custom" && customStartDate && customEndDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error: ${response.status}`);
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
      setError(err.message);
      
      // Set empty data on error
      setTotalTransactionsData([]);
      setStatusData([]);
      setStoreVsOnline([]);
      setDiscountPromoData([]);
      setSummary({
        totalTransactions: 0,
        completedTransactions: 0,
        totalRevenue: 0,
        averageTransactionValue: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update period text and fetch data whenever tab changes
  useEffect(() => {
    if (activeTab === 'custom') {
      setTotalTransactionsData([]);
      setStatusData([]);
      setStoreVsOnline([]);
      setDiscountPromoData([]);
      setSummary({
        totalTransactions: 0,
        completedTransactions: 0,
        totalRevenue: 0,
        averageTransactionValue: 0
      });
      setCurrentPeriodText(getPeriodText('custom', customRange.start, customRange.end));
      return;
    }

    const todayStr = formatDate(new Date());
    fetchReportData(activeTab, todayStr, todayStr);
    setCurrentPeriodText(getPeriodText(activeTab));

  }, [activeTab]);

  const handleCustomApply = (startDate, endDate) => {
    const startStr = formatDate(new Date(startDate));
    const endStr = formatDate(new Date(endDate));

    fetchReportData('custom', startStr, endStr);
    setCustomRange({ start: startStr, end: endStr });
    setCurrentPeriodText(getPeriodText('custom', startStr, endStr));
    setActiveTab("custom");
    setIsCustomModalOpen(false);
  };

  const formatCurrency = (value) => {
    return `₱${Number(value).toFixed(2)}`;
  };

  const renderSummaryCards = () => (
    <div className="transRep-cards-container">
      <div className="transRep-stat-card">
        <div className="transRep-card-icon transRep-icon-blue">
          <FaReceipt />
        </div>
        <div className="transRep-card-content">
          <div className="transRep-card-label">TOTAL TRANSACTIONS</div>
          <div className="transRep-card-value">{summary.totalTransactions}</div>
        </div>
      </div>

      <div className="transRep-stat-card">
        <div className="transRep-card-icon transRep-icon-green">
          <FaCheckCircle />
        </div>
        <div className="transRep-card-content">
          <div className="transRep-card-label">COMPLETED</div>
          <div className="transRep-card-value">{summary.completedTransactions}</div>
        </div>
      </div>

      <div className="transRep-stat-card">
        <div className="transRep-card-icon transRep-icon-teal">
          <FaDollarSign />
        </div>
        <div className="transRep-card-content">
          <div className="transRep-card-label">TOTAL REVENUE</div>
          <div className="transRep-card-value">{formatCurrency(summary.totalRevenue)}</div>
        </div>
      </div>

      <div className="transRep-stat-card">
        <div className="transRep-card-icon transRep-icon-orange">
          <FaChartLine />
        </div>
        <div className="transRep-card-content">
          <div className="transRep-card-label">AVG TRANSACTION</div>
          <div className="transRep-card-value">{formatCurrency(summary.averageTransactionValue)}</div>
        </div>
      </div>
    </div>
  );

  const hasData = totalTransactionsData.length > 0 || statusData.length > 0 || 
                  storeVsOnline.length > 0 || discountPromoData.length > 0;

  return (
    <div className="transRep-page">
      <Sidebar />
      <div className="transRep-report">
        <Header pageTitle="Transaction Reports" />
        
        <div className="transRep-tabs-wrapper">
          <div className="transRep-tabs">
            <div className="transRep-filter-item">
              <span className="transRep-period-text">{currentPeriodText}</span>
            </div>
            <div className="transRep-filter-item">
              <span>Period:</span>
              <select
                className="transRep-tab-dropdown"
                value={activeTab}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "custom") {
                    setIsCustomModalOpen(true);
                  } else {
                    setActiveTab(value);
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
        </div>

        <div className="transRep-report-content">
          {/* Summary Cards - Only show when there's data */}
          {!isLoading && hasData && (
            <div className="transRep-total-row">
              {renderSummaryCards()}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="transRep-loading-container">
              <p>Loading Transaction Report...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="transRep-error-container">
              <span className="transRep-error-message">
                Unable to load transaction report. {error}
              </span>
            </div>
          )}

          {/* Charts Container */}
          {!isLoading && !error && hasData && (
            <div className="transRep-charts-container">
              <div className="transRep-chart-card">
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
                  <div className="transRep-no-data">No transaction data available for this period</div>
                )}
              </div>

              <div className="transRep-chart-card">
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
                  <div className="transRep-no-data">No status data available for this period</div>
                )}
              </div>

              <div className="transRep-chart-card">
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
                  <div className="transRep-no-data">No store vs online data available for this period</div>
                )}
              </div>

              <div className="transRep-chart-card">
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
                  <div className="transRep-no-data">No discount data available for this period</div>
                )}
              </div>
            </div>
          )}

          {/* No Data State */}
          {!isLoading && !error && !hasData && (
            <div className="transRep-no-data-container">
              <p>No transaction data available for this period.</p>
            </div>
          )}
        </div>

        <CustomDateModal
          show={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          onApply={handleCustomApply}
        />
      </div>
    </div>
  );
}

export default TransactionReports;