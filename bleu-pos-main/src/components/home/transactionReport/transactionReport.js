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

  // Update period text whenever tab changes
  useEffect(() => {
    const today = new Date();
    const options = { month: "long", day: "numeric", year: "numeric" };

    switch (activeTab) {
      case "daily":
        setPeriodText(`Date: ${today.toLocaleDateString("en-US", options)}`);
        break;
      case "weekly": {
        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6);

        const start = firstDay.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const end = lastDay.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        setPeriodText(`Date Period: ${start} - ${end}`);
        break;
      }
      case "monthly":
        setPeriodText(`Month: ${today.toLocaleDateString("en-US", { month: "long" })}`);
        break;
      case "yearly":
        setPeriodText(`Year: ${today.getFullYear()}`);
        break;
      default:
        setPeriodText("");
    }
  }, [activeTab]);

  const totalTransactionsData = [
    { date: "Sep 1", transactions: 120 },
    { date: "Sep 5", transactions: 80 },
    { date: "Sep 10", transactions: 180 },
    { date: "Sep 15", transactions: 100 },
    { date: "Sep 20", transactions: 50 },
  ];

  const statusData = [
    { name: "Processing", transactions: 20 },
    { name: "Completed", transactions: 120 },
    { name: "Cancelled", transactions: 40 },
    { name: "Return", transactions: 50 },
    { name: "Refund", transactions: 40 },
  ];

  const storeVsOnline = [
    { date: "Sep 1", store: 30, online: 20 },
    { date: "Sep 5", store: 20, online: 40 },
    { date: "Sep 10", store: 60, online: 20 },
    { date: "Sep 15", store: 20, online: 50 },
    { date: "Sep 20", store: 40, online: 20 },
  ];

  const discountPromoData = [
    { name: "With Discount", value: 180 },
    { name: "With Promotion", value: 120 },
    { name: "No Discount/Promo", value: 400 },
  ];

  const COLORS = ["#4B929D", "#2490a0ff", "#237481ff", "#dc3545", "#AA336A"];

  const handleApplyCustomDate = (start, end) => {
    setPeriodText(`Date Period: ${start} - ${end}`);
    setActiveTab("custom");
  };

  return (
    <div className="transaction-reports">
      <Sidebar />
      <div className="transRep">
        <Header pageTitle="Transaction Reports" />

        <div className="transRep-header-row">
          <div className="transRep-tabs">
            <button
              className={activeTab === "daily" ? "active" : ""}
              onClick={() => setActiveTab("daily")}
            >
              Today
            </button>
            <button
              className={activeTab === "weekly" ? "active" : ""}
              onClick={() => setActiveTab("weekly")}
            >
              This Week
            </button>
            <button
              className={activeTab === "monthly" ? "active" : ""}
              onClick={() => setActiveTab("monthly")}
            >
              This Month
            </button>
            <button
              className={activeTab === "yearly" ? "active" : ""}
              onClick={() => setActiveTab("yearly")}
            >
              This Year
            </button>
            <button
              className={activeTab === "custom" ? "active" : ""}
              onClick={() => setIsCustomModalOpen(true)}
            >
              Custom
            </button>
          </div>

          <div className="period-text-label">
            {periodText}
          </div>
        </div>

        <div className="charts-container">
          <div className="chart-card">
            <h2>Total Transactions</h2>
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
          </div>

          <div className="chart-card">
            <h2>Transaction Status</h2>
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
          </div>

          <div className="chart-card">
            <h2>Transactions: Store vs Online</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={storeVsOnline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="store" stroke="#237481ff" strokeWidth={2} />
                <Line type="monotone" dataKey="online" stroke="#08bfdbff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h2>Transactions: Discounts & Promotions</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={discountPromoData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label
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
          </div>
        </div>

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
