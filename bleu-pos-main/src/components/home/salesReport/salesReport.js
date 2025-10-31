import React, { useState, useMemo, useEffect } from "react";
import "./salesReport.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import DataTable from "react-data-table-component";
import { 
  FaFileExport, FaShoppingCart, FaStore, FaGlobe, FaDollarSign, 
  FaReceipt, FaFilter, FaExclamationTriangle, FaFilePdf, 
  FaFileDownload, FaPrint, FaCheckCircle, FaUser, 
  FaCashRegister, FaChartPie, FaUndo, FaBalanceScale 
} from "react-icons/fa"; 
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowTrendUp, faArrowTrendDown } from "@fortawesome/free-solid-svg-icons";
import CustomDateModal from "../shared/customDateModal";
import handleSalesReportExport from "./salesReportExport";
import Lottie from "lottie-react";
import loadingAnimation from "../../../assets/animation/loading.json";
import '../../confirmAlertCustom.css';

const USE_MOCK_DATA = true

// --- ENHANCED MOCK DATA ---
const mockSalesData = {
  summary: {
    totalSales: 25430,
    cashInDrawer: 25200,
    discrepancy: -230,
    transactions: 187,
    refunds: 500,
    paymentBreakdown: {
      cash: 60,
      gcash: 40,
    },
    paymentSummary: {
      cashAmount: 15200,
      cashPrevious: 14500,
      gcashAmount: 10230,
      gcashPrevious: 9800,
    }
  },
  categoryBreakdown: [
    { category: "Drinks", quantity: 421, sales: 12630, percentage: 50 },
    { category: "Food", quantity: 275, sales: 9240, percentage: 36 },
    { category: "Merchandise", quantity: 42, sales: 3560, percentage: 14 }
  ],
  productBreakdown: [
    { product: "Iced Latte", category: "Drinks", units: 80, total: 12000 },
    { product: "Carbonara", category: "Food", units: 50, total: 7500 },
    { product: "Mug (Merch)", category: "Merchandise", units: 20, total: 2000 },
    { product: "Blueberry Cheesecake", category: "Food", units: 35, total: 5250 },
    { product: "Cold Brew", category: "Drinks", units: 45, total: 6750 }
  ],
  cashDrawer: {
    opening: 2000,
    cashSales: 15000,
    refunds: 300,
    expected: 16700,
    actual: 16500,
    discrepancy: -200,
    reportedBy: "Maria Santos",
    verifiedBy: "Manager - Juan Dela Cruz"
  },
  paymentMethods: [
    { type: "Cash", transactions: 102, amount: 15200 },
    { type: "GCash", transactions: 58, amount: 8900 },
  ],
  refundsList: [
    { id: "102", product: "Iced Mocha", amount: 150, reason: "Customer Complaint", cashier: "Maria", date: "10/26/2025" },
    { id: "103", product: "Croissant", amount: 120, reason: "Wrong Order", cashier: "Juan", date: "10/26/2025" },
    { id: "104", product: "Latte", amount: 130, reason: "Temperature Issue", cashier: "Maria", date: "10/26/2025" }
  ]
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPeriodText = (tab, customStart = null, customEnd = null) => {
  const today = new Date();
  switch (tab) {
    case "today":
      return `Date: ${today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return `Date: ${yesterday.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
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

function SalesReport() {
  const [activeTab, setActiveTab] = useState("today");
  const [selectedCashier, setSelectedCashier] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText("today"));
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [remarks, setRemarks] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [salesBreakdownTab, setSalesBreakdownTab] = useState('category');
  const [financialTab, setFinancialTab] = useState('cashDrawer');

  const data = mockSalesData;

  useEffect(() => {
    setCurrentPeriodText(getPeriodText(activeTab, customRange.start, customRange.end));
  }, [activeTab, customRange]);

  const handleCustomApply = (startDate, endDate) => {
    const startStr = formatDate(new Date(startDate));
    const endStr = formatDate(new Date(endDate));
    setCustomRange({ start: startStr, end: endStr });
    setCurrentPeriodText(getPeriodText('custom', startStr, endStr));
    setActiveTab("custom");
    setIsCustomModalOpen(false);
  };

  const categoryColumns = [
    { name: "CATEGORY", selector: (row) => row.category, sortable: true },
    { name: "QUANTITY SOLD", selector: (row) => row.quantity, center: true, sortable: true },
    { name: "SALES AMOUNT", selector: (row) => `₱${row.sales.toLocaleString()}`, center: true, sortable: true },
    { name: "% OF TOTAL", selector: (row) => `${row.percentage}%`, center: true, sortable: true },
  ];

  const productColumns = [
    { name: "PRODUCT", selector: (row) => row.product, sortable: true },
    { name: "CATEGORY", selector: (row) => row.category, center: true, sortable: true },
    { name: "UNITS SOLD", selector: (row) => row.units, center: true, sortable: true },
    { name: "TOTAL SALES", selector: (row) => `₱${row.total.toLocaleString()}`, center: true, sortable: true },
  ];

  const paymentColumns = [
    { name: "PAYMENT TYPE", selector: (row) => row.type, sortable: true },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true, sortable: true },
    { name: "TOTAL AMOUNT", selector: (row) => `₱${row.amount.toLocaleString()}`, center: true, sortable: true },
  ];

  const refundColumns = [
    { name: "#", selector: (row) => row.id, center: true, sortable: true, width: "10%" },
    { name: "DATE", selector: (row) => row.date, center: true, sortable: true, width: "15%" },
    { name: "PRODUCT", selector: (row) => row.product, sortable: true, width: "18%" },
    { name: "AMOUNT", selector: (row) => `₱${row.amount}`, center: true, sortable: true, width: "17%" },
    { name: "REASON", selector: (row) => row.reason, sortable: true, width: "20%" },
    { name: "CASHIER", selector: (row) => row.cashier, center: true, sortable: true, width: "20%" },
  ];

  return (
    <div className="aSalesRep-page">
      <Sidebar />
      <div className="aSalesRep-report">
        <Header pageTitle="Sales Report" />

        {/* Filter Bar */}
        <div className="aSalesRep-tabs-wrapper">
          <div className={`aSalesRep-tabs ${isFilterOpen ? "open" : "collapsed"}`}>
            <button
              className="aSalesRep-filter-toggle-btn"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter />
              <span className="aSalesRep-period-text">{currentPeriodText}</span>
            </button>

            <div className="aSalesRep-filter-item">
              <span>Period:</span>
              <select
                className="aSalesRep-tab-dropdown"
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
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="aSalesRep-filter-item">
              <span>Cashier:</span>
              <select
                className="aSalesRep-tab-dropdown"
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
              >
                <option value="all">All Cashiers</option>
              </select>
            </div>

            <button className="aSalesRep-export-btn" onClick={() => handleSalesReportExport(data.productBreakdown, data.summary, activeTab, currentPeriodText)}>
              <FaFileExport /> Export
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="aSalesRep-scrollable-content">
          {/* Summary Cards */}
          <div className="aSalesRep-cards-container">
            <div className="aSalesRep-stat-card">
              <div className="aSalesRep-card-icon aSalesRep-icon-green">
                <FaDollarSign />
              </div>
              <div className="aSalesRep-card-content">
                <div className="aSalesRep-card-label">TOTAL CASH SALES</div>
                <div className="aSalesRep-card-value">₱{data.summary.totalSales.toLocaleString()}</div>
              </div>
            </div>

            <div className="aSalesRep-stat-card">
              <div className="aSalesRep-card-icon aSalesRep-icon-blue">
                <FaCashRegister />
              </div>
              <div className="aSalesRep-card-content">
                <div className="aSalesRep-card-label">CASH IN DRAWER</div>
                <div className="aSalesRep-card-value">₱{data.summary.cashInDrawer.toLocaleString()}</div>
              </div>
            </div>

            <div className="aSalesRep-stat-card">
              <div className="aSalesRep-card-icon aSalesRep-icon-red">
                <FaBalanceScale />
              </div>
              <div className="aSalesRep-card-content">
                <div className="aSalesRep-card-label">CASH DISCREPANCY</div>
                <div className="aSalesRep-card-value aSalesRep-negative">
                  ₱{Math.abs(data.summary.discrepancy).toLocaleString()} {data.summary.discrepancy < 0 ? 'Short' : 'Over'}
                </div>
              </div>
            </div>

            <div className="aSalesRep-stat-card">
              <div className="aSalesRep-card-icon aSalesRep-icon-purple">
                <FaReceipt />
              </div>
              <div className="aSalesRep-card-content">
                <div className="aSalesRep-card-label">TOTAL TRANSACTIONS</div>
                <div className="aSalesRep-card-value">{data.summary.transactions}</div>
              </div>
            </div>

            <div className="aSalesRep-stat-card">
              <div className="aSalesRep-card-icon aSalesRep-icon-orange">
                <FaUndo />
              </div>
              <div className="aSalesRep-card-content">
                <div className="aSalesRep-card-label">REFUNDS/RETURNS</div>
                <div className="aSalesRep-card-value">₱{data.summary.refunds.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Side by Side Section */}
          <div className="aSalesRep-side-by-side-container">
            {/* Financial Details */}
            <div className="aSalesRep-table-section">
              <h3 className="aSalesRep-section-title">Financial Details</h3>
              
              {/* Payment Methods - Always Visible */}
              <div className="aSalesRep-payment-breakdown modern">
                {[
                  { label: "Cash", key: "cash" },
                  { label: "GCash", key: "gcash" },
                ].map((method, index) => {
                  const current = data?.summary?.paymentSummary?.[`${method.key}Amount`] ?? 0;

                  return (
                    <div key={index} className="aSalesRep-payment-card">
                      <span className="aSalesRep-payment-label">{method.label}</span>
                      <div className="aSalesRep-payment-amount">
                        ₱{current.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabs for Cash Drawer and Refunds */}
              <div className="aSalesRep-tabs-container" style={{ marginTop: '20px' }}>
                <button
                  className={`aSalesRep-content-tab ${financialTab === 'cashDrawer' ? 'active' : ''}`}
                  onClick={() => setFinancialTab('cashDrawer')}
                >
                  <FaCashRegister /> Cash Drawer Summary
                </button>
                <button
                  className={`aSalesRep-content-tab ${financialTab === 'refunds' ? 'active' : ''}`}
                  onClick={() => setFinancialTab('refunds')}
                >
                  <FaUndo /> Refunds & Returns
                </button>
              </div>

              {financialTab === 'cashDrawer' ? (
                <div className="aSalesRep-cash-drawer-grid">
                  <div className="aSalesRep-cash-item">
                    <span className="aSalesRep-cash-label">Opening Balance:</span>
                    <span className="aSalesRep-cash-value">₱{data.cashDrawer.opening.toLocaleString()}</span>
                  </div>
                  <div className="aSalesRep-cash-item">
                    <span className="aSalesRep-cash-label">Total Cash Sales:</span>
                    <span className="aSalesRep-cash-value">₱{data.cashDrawer.cashSales.toLocaleString()}</span>
                  </div>
                  <div className="aSalesRep-cash-item">
                    <span className="aSalesRep-cash-label">Total Refunds:</span>
                    <span className="aSalesRep-cash-value">₱{data.cashDrawer.refunds.toLocaleString()}</span>
                  </div>
                  <div className="aSalesRep-cash-item">
                    <span className="aSalesRep-cash-label">Expected Cash:</span>
                    <span className="aSalesRep-cash-value">₱{data.cashDrawer.expected.toLocaleString()}</span>
                  </div>
                  <div className="aSalesRep-cash-item">
                    <span className="aSalesRep-cash-label">Actual Cash Counted:</span>
                    <span className="aSalesRep-cash-value">₱{data.cashDrawer.actual.toLocaleString()}</span>
                  </div>
                  <div className="aSalesRep-cash-item aSalesRep-cash-highlight">
                    <span className="aSalesRep-cash-label">Discrepancy:</span>
                    <span className="aSalesRep-cash-value aSalesRep-negative">
                      ₱{Math.abs(data.cashDrawer.discrepancy).toLocaleString()} {data.cashDrawer.discrepancy < 0 ? 'Short' : 'Over'}
                    </span>
                  </div>
                  <div className="aSalesRep-cash-item">
                    <span className="aSalesRep-cash-label">Reported By:</span>
                    <span className="aSalesRep-cash-value">{data.cashDrawer.reportedBy}</span>
                  </div>
                  <div className="aSalesRep-cash-item">
                    <span className="aSalesRep-cash-label">Verified By:</span>
                    <span className="aSalesRep-cash-value">{data.cashDrawer.verifiedBy}</span>
                  </div>
                </div>
              ) : (
                <div className="aSalesRep-table-container">
                  <DataTable
                    columns={refundColumns}
                    data={data.refundsList}
                    striped
                    highlightOnHover
                    responsive
                    pagination
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
                        style: { minHeight: "55px", padding: "5px" },
                      },
                    }}
                  />
                </div>
              )}
            </div>

            {/* Sales Breakdown */}
            <div className="aSalesRep-table-section">
              <h3 className="aSalesRep-section-title">Sales Breakdown</h3>
              
              <div className="aSalesRep-tabs-container">
                <button
                  className={`aSalesRep-content-tab ${salesBreakdownTab === 'category' ? 'active' : ''}`}
                  onClick={() => setSalesBreakdownTab('category')}
                >
                  By Category
                </button>
                <button
                  className={`aSalesRep-content-tab ${salesBreakdownTab === 'product' ? 'active' : ''}`}
                  onClick={() => setSalesBreakdownTab('product')}
                >
                  By Product
                </button>
              </div>

              <div className="aSalesRep-table-container">
                {salesBreakdownTab === 'category' ? (
                  <DataTable
                    columns={categoryColumns}
                    data={data.categoryBreakdown}
                    striped
                    highlightOnHover
                    responsive
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
                        style: { minHeight: "55px", padding: "5px" },
                      },
                    }}
                  />
                ) : (
                  <DataTable
                    columns={productColumns}
                    data={data.productBreakdown}
                    striped
                    highlightOnHover
                    responsive
                    pagination
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
                        style: { minHeight: "55px", padding: "5px" },
                      },
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CustomDateModal
        show={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onApply={handleCustomApply}
      />
    </div>
  );
}

export default SalesReport;