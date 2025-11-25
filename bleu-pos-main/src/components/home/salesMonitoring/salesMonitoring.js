import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  FaFileExport,
  FaCashRegister,
  FaChartLine,
  FaBoxOpen,
  FaPercentage,
  FaUserFriends,
} from "react-icons/fa";
import { FaFilter } from "react-icons/fa";
import DataTable from "react-data-table-component";
import { generatePDFReport, generateCSVReport } from "./salesMonitoringExport";
import { ExportModal, NoDataModal, UnableToLoadData, NoData } from "../shared/exportModal";
import "./salesMonitoring.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import Loading from "../shared/loading";
import "../../confirmAlertCustom.css";

// --- HELPER FUNCTION FOR DISPLAYING DATE RANGES ---
const getPeriodText = (dateRange) => {
  const today = new Date();
  const options = { month: "short", day: "numeric", year: "numeric" };

  switch (dateRange) {
    case "today": {
      return today.toLocaleDateString("en-US", options);
    }
    case "week": {
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay());
      const start = firstDayOfWeek.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const end = today.toLocaleDateString("en-US", options);
      return `${start} - ${end}`;
    }
    case "month": {
      const firstDayOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );
      const start = firstDayOfMonth.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const end = today.toLocaleDateString("en-US", options);
      return `${start} - ${end}`;
    }
    default:
      return "";
  }
};

function SalesMonitoring() {
  const [dateRange, setDateRange] = useState("today");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCashier, setSelectedCashier] = useState("all");
  const [salesData, setSalesData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPeriodText, setCurrentPeriodText] = useState(
    getPeriodText("today")
  );
  // State for cashier list and top cashier's full name
  const [allCashiers, setAllCashiers] = useState([]);
  const [topCashierFullName, setTopCashierFullName] = useState(null);

  // Fetch all cashiers for the dropdown
  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        const authToken = localStorage.getItem("authToken");
        if (!authToken) return;

        const response = await fetch("http://127.0.0.1:4000/users/cashiers", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch cashiers");
        }
        const data = await response.json();
        setAllCashiers(data);
      } catch (err) {
        console.error("Error fetching cashiers:", err);
      }
    };
    fetchCashiers();
  }, []);

  // Fetch sales data from backend
  const fetchSalesData = async () => {
    setLoading(true);
    setError(null);
    setSalesData([]);
    setTotals(null);

    try {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        throw new Error("No authentication token found. Please log in.");
      }

      const categoryToFetch =
        selectedCategory === "Merchandise"
          ? null
          : selectedCategory === "all"
          ? null
          : selectedCategory;

      const response = await fetch(
        "http://localhost:9000/auth/sales_metrics/monitoring",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            dateRange: dateRange,
            selectedCategory: categoryToFetch,
            selectedCashier: selectedCashier === "all" ? null : selectedCashier,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          `Failed to fetch sales data: ${errData.detail || response.statusText}`
        );
      }

      const data = await response.json();
      setSalesData(data.salesData);

      if (selectedCategory === "Merchandise") {
        const filteredForTotals = data.salesData.filter(
          (item) =>
            item.category === "Merchandise" || item.category === "All Items"
        );

        const newTotalSales = filteredForTotals.reduce(
          (acc, item) => acc + item.revenue,
          0
        );
        const newTotalItemsSold = filteredForTotals.reduce(
          (acc, item) => acc + item.quantity,
          0
        );
        const newTransactionCount = newTotalItemsSold;

        setTotals({
          totalSales: newTotalSales,
          totalTransactions: newTransactionCount,
          totalItemsSold: newTotalItemsSold,
          profitMargin: data.profitMargin,
        });
      } else {
        setTotals({
          totalSales: data.totalRevenue,
          totalTransactions: data.transactionCount,
          totalItemsSold: data.totalQuantity,
          profitMargin: data.profitMargin,
        });
      }
    } catch (err) {
      console.error("Error fetching sales data:", err);
      setError(err.message);
      setSalesData([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
    setCurrentPeriodText(getPeriodText(dateRange));
  }, [dateRange, selectedCategory, selectedCashier]);

  const processedData = useMemo(() => {
    let dataToProcess = salesData;

    if (selectedCategory === "Merchandise") {
      dataToProcess = salesData.filter(
        (item) =>
          item.category === "Merchandise" || item.category === "All Items"
      );
    }

    return dataToProcess.map((item) => {
      if (item.category === "All Items") {
        return { ...item, category: "Merchandise" };
      }
      return item;
    });
  }, [salesData, selectedCategory]);

  const metrics = useMemo(() => {
    const {
      totalSales = 0,
      totalTransactions = 0,
      totalItemsSold = 0,
    } = totals || {};
    const averageSaleValue =
      totalTransactions > 0 ? totalSales / totalTransactions : 0;

    const cashierSales = {};
    processedData.forEach((item) => {
      if (item.cashier) {
        cashierSales[item.cashier] =
          (cashierSales[item.cashier] || 0) + item.revenue;
      }
    });

    const topCashierEntry = Object.entries(cashierSales).sort(
      (a, b) => b[1] - a[1]
    )[0];
    const topCashier = topCashierEntry
      ? { name: topCashierEntry[0], sales: topCashierEntry[1] } // name is username
      : null;

    return {
      totalSales,
      totalTransactions,
      totalItemsSold,
      averageSaleValue,
      topCashier,
      filtered: processedData,
    };
  }, [processedData, totals]);

  // Fetch top cashier's full name when metrics change
  useEffect(() => {
    const fetchTopCashierName = async () => {
      if (!metrics.topCashier || !metrics.topCashier.name) {
        setTopCashierFullName(null);
        return;
      }

      try {
        const authToken = localStorage.getItem("authToken");
        if (!authToken) return;

        const response = await fetch(
          `http://127.0.0.1:4000/users/employee_name?username=${metrics.topCashier.name}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setTopCashierFullName(data.employee_name);
        } else {
          setTopCashierFullName(metrics.topCashier.name); // Fallback to username
        }
      } catch (err) {
        console.error("Error fetching top cashier's name:", err);
        setTopCashierFullName(metrics.topCashier.name); // Fallback on error
      }
    };

    fetchTopCashierName();
  }, [metrics.topCashier]);

  const salesBreakdown = useMemo(() => {
    const breakdown = {};
    const totalSales = metrics.totalSales;

    processedData.forEach((item) => {
      if (!breakdown[item.product]) {
        breakdown[item.product] = {
          product: item.product,
          category: item.category,
          unitsSold: 0,
          totalSales: 0,
          percentage: 0,
        };
      }
      breakdown[item.product].unitsSold += item.quantity;
      breakdown[item.product].totalSales += item.revenue;
    });

    return Object.values(breakdown)
      .map((item) => ({
        ...item,
        percentage:
          totalSales > 0
            ? ((item.totalSales / totalSales) * 100).toFixed(1)
            : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [processedData, metrics.totalSales]);

  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    processedData.forEach((item) => {
      if (!breakdown[item.category]) {
        breakdown[item.category] = { name: item.category, value: 0 };
      }
      breakdown[item.category].value += item.revenue;
    });
    return Object.values(breakdown);
  }, [processedData]);

  const salesTrend = useMemo(() => {
    const trend = {};
    processedData.forEach((item) => {
      const date = new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      trend[date] = (trend[date] || 0) + item.revenue;
    });
    return Object.entries(trend)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => new Date(a.name) - new Date(b.name));
  }, [processedData]);

  const topProducts = useMemo(() => {
    return salesBreakdown.slice(0, 10).map((item) => ({
      name: item.product,
      value: item.unitsSold,
    }));
  }, [salesBreakdown]);

  const COLORS = ["#00b4d8", "#0096c7", "#0077b6", "#023e8a", "#03045e"];

  const salesBreakdownColumns = [
    {
      name: "Product",
      sortable: true,
      width: "33%",
      cell: (row) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: "600", color: "#111827" }}>
            {row.product}
          </span>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            {row.category}
          </span>
        </div>
      ),
    },
    {
      name: "Units Sold",
      selector: (row) => row.unitsSold,
      sortable: true,
      center: true,
      width: "33%",
    },
    {
      name: "Total Sales",
      sortable: true,
      right: true,
      width: "33%",
      cell: (row) => (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <span style={{ fontWeight: "600", color: "#111827" }}>
            ₱{row.totalSales.toFixed(2)}
          </span>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            {row.percentage}%
          </span>
        </div>
      ),
    },
  ];

  const customStyles = {
    headRow: {
      style: {
        backgroundColor: "#4B929D",
        color: "#fff",
        fontWeight: 600,
        fontSize: "14px",
        textTransform: "uppercase",
        letterSpacing: "1px",
      },
    },
    headCells: {
      style: {
        paddingLeft: "12px",
        paddingRight: "12px",
        color: "#fff",
      },
    },
    rows: {
      style: {
        fontSize: "13px",
        minHeight: "64px",
        color: "#374151",
      },
      stripedStyle: {
        backgroundColor: "#f9fafb",
      },
    },
    cells: {
      style: {
        paddingLeft: "12px",
        paddingRight: "12px",
      },
    },
  };

  const handleExportClick = () => {
    if (!processedData.length) {
      showNoDataModal();
      return;
    }

    const modalContainer = document.createElement("div");
    document.body.appendChild(modalContainer);
    const root = ReactDOM.createRoot(modalContainer);

    const cleanup = () => {
      root.unmount();
      document.body.removeChild(modalContainer);
    };

    const handleExportPDF = () => {
      cleanup();
      generatePDFReport(metrics, selectedCategory, selectedCashier);
    };

    const handleExportCSV = () => {
      cleanup();
      generateCSVReport(metrics);
    };

    root.render(
      <ExportModal
        onClose={cleanup}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
      />
    );
  };

  const handleClearFilters = () => {
    setDateRange("today");
    setSelectedCategory("all");
    setSelectedCashier("all");
  };

  const showNoDataModal = () => {
    const noDataContainer = document.createElement("div");
    document.body.appendChild(noDataContainer);
    const noDataRoot = ReactDOM.createRoot(noDataContainer);
    const cleanupNoData = () => {
      noDataRoot.unmount();
      document.body.removeChild(noDataContainer);
    };
    noDataRoot.render(<NoDataModal onClose={cleanupNoData} />);
  };

  return (
    <div className="sales-monitoring">
      <Sidebar />
      <div className="monitoring">
        <Header pageTitle="Sales Monitoring" />
        <div className="salesMonFilterWrapper">
          <div
            className={`salesMonFilterBar ${
              isFilterOpen ? "open" : "collapsed"
            }`}
          >
            <button
              className="salesMonFilterToggleBtn"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter />
              <span className="salesMonPeriodText">
                Date {currentPeriodText}
              </span>
            </button>
            <div className="salesMonFilterItem">
              <span>Period:</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="salesMonSelect"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div className="salesMonFilterItem">
              <span>Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="salesMonSelect salesMonSelectCategory"
              >
                <option value="all">All Categories</option>
                {[
                  ...new Set(
                    salesData.map((item) =>
                      item.category === "All Items"
                        ? "Merchandise"
                        : item.category
                    )
                  ),
                ]
                  .sort()
                  .map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
              </select>
            </div>
            <div className="salesMonFilterItem">
              <span>Cashier:</span>
              <select
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
                className="salesMonSelect salesMonSelectCashier"
              >
                <option value="all">All Cashiers</option>
                {allCashiers.map((cashier) => (
                  <option key={cashier.UserID} value={cashier.Username}>
                    {cashier.FullName}
                  </option>
                ))}
              </select>
            </div>
            <button className="salesMonClearBtn" onClick={handleClearFilters}>
              Clear Filters
            </button>
            <button
              onClick={handleExportClick}
              className="salesMonBtn salesMonBtnExport"
            >
              <FaFileExport /> Export
            </button>
          </div>
        </div>
        <div className="salesMonMetrics-content">
          {loading ? (
            <Loading />
          ) : error ? (
            <UnableToLoadData />
          ) : processedData.length === 0 ? (
            <NoData />
          ) : (
            <>
              <div className="salesMonMetrics">
                <div className="salesMonCard">
                  <div className="salesMonCardIcon salesMonIconRevenue">
                    <FaCashRegister />
                  </div>
                  <div className="salesMonCardContent">
                    <div className="salesMonCardLabel">Total Sales</div>
                    <div className="salesMonCardValue">
                      ₱
                      {metrics.totalSales.toLocaleString("en-PH", {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
                <div className="salesMonCard">
                  <div className="salesMonCardIcon salesMonIconProfit">
                    <FaChartLine />
                  </div>
                  <div className="salesMonCardContent">
                    <div className="salesMonCardLabel">
                      Total Transactions
                    </div>
                    <div className="salesMonCardValue salesMonValueProfit">
                      {metrics.totalTransactions}
                    </div>
                  </div>
                </div>
                <div className="salesMonCard">
                  <div className="salesMonCardIcon salesMonIconQuantity">
                    <FaBoxOpen />
                  </div>
                  <div className="salesMonCardContent">
                    <div className="salesMonCardLabel">Items Sold</div>
                    <div className="salesMonCardValueRow">
                      <div className="salesMonCardValue">
                        {metrics.totalItemsSold}
                      </div>
                      <div className="salesMonCardUnit">items</div>
                    </div>
                  </div>
                </div>
                <div className="salesMonCard">
                  <div className="salesMonCardIcon salesMonIconMargin">
                    <FaPercentage />
                  </div>
                  <div className="salesMonCardContent">
                    <div className="salesMonCardLabel">
                      Average Sale Value
                    </div>
                    <div className="salesMonCardValue salesMonValueMargin">
                      ₱
                      {metrics.averageSaleValue.toLocaleString("en-PH", {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
                {metrics.topCashier && (
                  <div className="salesMonCard salesMonCardWide">
                    <div className="salesMonCardIcon salesMonIconCashier">
                      <FaUserFriends />
                    </div>
                    <div className="salesMonCardContent">
                      <div className="salesMonCardLabel">Top Cashier</div>
                      <div
                        className="salesMonCardValue"
                        style={{ fontSize: "18px" }}
                      >
                        {topCashierFullName || metrics.topCashier.name}
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#22c55e",
                          fontWeight: "600",
                        }}
                      >
                        ₱
                        {metrics.topCashier.sales.toLocaleString("en-PH", {
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="salesMonChartsAndTable">
                <div className="salesMonCharts">
                  <div className="salesMonChartCard">
                    <h3 className="salesMonChartTitle">Sales Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={salesTrend}>
                        <defs>
                          <linearGradient
                            id="colorSalesTrend"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#00b4d8"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#00b4d8"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => `₱${value.toFixed(2)}`}
                          contentStyle={{
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="#00b4d8"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorSalesTrend)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="salesMonChartCard">
                    <h3 className="salesMonChartTitle">Sales by Category</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={{ fontSize: 12 }}
                        >
                          {categoryBreakdown.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => `₱${value.toFixed(2)}`}
                          contentStyle={{
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="salesMonChartCard salesMonChartCardWide">
                    <h3 className="salesMonChartTitle">
                      Top-Selling Products
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topProducts} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={120}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                          }}
                        />
                        <Bar
                          dataKey="value"
                          fill="#00b4d8"
                          radius={[0, 8, 8, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="salesMonTableCard">
                  <h3 className="salesMonTableTitle">
                    Sales Breakdown
                    <Link
                      to="/home/salesReport"
                      className="salesMon-view-all-btn"
                    >
                      View All Report
                    </Link>
                  </h3>
                  <DataTable
                    columns={salesBreakdownColumns}
                    data={salesBreakdown}
                    striped
                    customStyles={customStyles}
                    noDataComponent={
                      <div style={{ padding: "20px", textAlign: "center" }}>
                        No sales data available
                      </div>
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SalesMonitoring;