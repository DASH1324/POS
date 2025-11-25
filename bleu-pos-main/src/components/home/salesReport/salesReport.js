import React, { useState, useEffect } from "react";
import "./salesReport.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import DataTable from "react-data-table-component";
import { 
  FaFileExport, FaDollarSign, 
  FaReceipt, FaFilter,
  FaCashRegister, FaUndo, FaBalanceScale 
} from "react-icons/fa";
import CustomDateModal from "../shared/customDateModal";
import { generatePDFReport, generateCSVReport } from "./salesReportExport";
import { ExportModal, NoDataModal, UnableToLoadData, NoData } from "../shared/exportModal";
import SalesReportModal from "./salesReportModal";
import Loading from "../shared/loading";
import '../../confirmAlertCustom.css';

const CASHIERS_API_URL = "http://127.0.0.1:4000/users/cashiers";
const EMPLOYEE_NAME_API_URL = "http://127.0.0.1:4000/users/employee_name";

// Helper function to format dates for the API (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get the display text for the selected period
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
        const startDate = new Date(customStart + 'T00:00:00');
        const endDate = new Date(customEnd + 'T00:00:00');
        const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `Date Period: ${start} - ${end}`;
      }
      return "Date Period: None Selected";
    }
    default:
      return "";
  }
};

function SalesReport() {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState("today");
  const [selectedCashier, setSelectedCashier] = useState("all");
  const [cashiersList, setCashiersList] = useState([]);
  const [isCashiersLoading, setIsCashiersLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText("today"));
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [reportData, setReportData] = useState(null);
  const [processedRefundsList, setProcessedRefundsList] = useState([]);
  const [salesBreakdownTab, setSalesBreakdownTab] = useState('category');
  const [financialTab, setFinancialTab] = useState('cashDrawer');
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  
  // Export modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isNoDataModalOpen, setIsNoDataModalOpen] = useState(false);

  // --- FETCH CASHIERS LIST ---
  useEffect(() => {
    const fetchCashiers = async () => {
      setIsCashiersLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error("Authentication token not found. Please log in.");
        }

        const response = await fetch(CASHIERS_API_URL, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch cashiers: ${response.status}`);
        }

        const data = await response.json();
        setCashiersList(data);
      } catch (err) {
        console.error("Error fetching cashiers:", err);
        setError("Could not load cashier list.");
      } finally {
        setIsCashiersLoading(false);
      }
    };

    fetchCashiers();
  }, []);

  // --- API DATA FETCHING ---
  useEffect(() => {
    const fetchSalesReport = async () => {
      setIsLoading(true);
      setError(null);
      setReportData(null);
      setProcessedRefundsList([]); // Clear previous refunds

      const requestBody = { reportType: activeTab };
      
      if (selectedCashier && selectedCashier !== "all") {
        requestBody.cashierName = selectedCashier;
      }
      
      if (activeTab === 'custom') {
        if (!customRange.start || !customRange.end) {
          setIsLoading(false);
          setError("Please select a valid custom date range.");
          return;
        }
        requestBody.startDate = customRange.start;
        requestBody.endDate = customRange.end;
      }
      
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error("Authentication token not found. Please log in.");
        }

        const response = await fetch('http://127.0.0.1:9000/auth/sales_metrics/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.detail || `Error: ${response.status}`);
        }

        const data = await response.json();
        setReportData(data);
      } catch (err) {
        console.error("Error fetching sales report:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesReport();
  }, [activeTab, customRange, selectedCashier]);
  
  // --- PROCESS REFUNDS TO GET FULL CASHIER NAMES ---
  useEffect(() => {
    const processRefundCashierNames = async () => {
      if (!reportData?.refundsList?.length) {
        setProcessedRefundsList([]);
        return;
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        setProcessedRefundsList(reportData.refundsList); // Fallback to usernames if no token
        return;
      }
      
      const uniqueUsernames = [...new Set(reportData.refundsList.map(item => item.cashier))];
      
      const namePromises = uniqueUsernames.map(async (username) => {
        try {
          const response = await fetch(`${EMPLOYEE_NAME_API_URL}?username=${username}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) return { username, fullName: username }; // Fallback to username
          const data = await response.json();
          return { username, fullName: data.employee_name || username };
        } catch (error) {
          console.error(`Failed to fetch name for ${username}`, error);
          return { username, fullName: username }; // Fallback on error
        }
      });
      
      const nameMappings = await Promise.all(namePromises);
      const usernameToFullNameMap = nameMappings.reduce((acc, { username, fullName }) => {
        acc[username] = fullName;
        return acc;
      }, {});
      
      const updatedRefundsList = reportData.refundsList.map(refund => ({
        ...refund,
        cashier: usernameToFullNameMap[refund.cashier] || refund.cashier
      }));
      
      setProcessedRefundsList(updatedRefundsList);
    };

    processRefundCashierNames();
  }, [reportData]);


  // Update the period display text when the active tab or custom range changes
  useEffect(() => {
    setCurrentPeriodText(getPeriodText(activeTab, customRange.start, customRange.end));
  }, [activeTab, customRange]);

  // Handler for applying a custom date range from the modal
  const handleCustomApply = (startDate, endDate) => {
    const startStr = formatDateForAPI(new Date(startDate));
    const endStr = formatDateForAPI(new Date(endDate));
    setCustomRange({ start: startStr, end: endStr });
    setActiveTab("custom");
    setIsCustomModalOpen(false);
  };

  // --- EXPORT HANDLERS ---
  const handleExportClick = () => {
    if (!reportData || !reportData.productBreakdown || reportData.productBreakdown.length === 0) {
      setIsNoDataModalOpen(true);
      return;
    }
    setIsExportModalOpen(true);
  };

  const handleExportPDF = () => {
    setIsExportModalOpen(false);
    
    const enhancedTotals = {
      totalSales: reportData.summary?.totalSales || 0,
      cashInDrawer: reportData.summary?.cashInDrawer || 0,
      discrepancy: reportData.summary?.discrepancy || 0,
      transactions: reportData.summary?.transactions || 0,
      refunds: reportData.summary?.refunds || 0,
      cashAmount: reportData.paymentSummary?.cashAmount || 0,
      gcashAmount: reportData.paymentSummary?.gcashAmount || 0,
      cashDrawerOpening: reportData.cashDrawer?.opening || 0,
      cashDrawerSales: reportData.cashDrawer?.cashSales || 0,
      cashDrawerRefunds: reportData.cashDrawer?.refunds || 0,
      cashDrawerExpected: reportData.cashDrawer?.expected || 0,
      cashDrawerActual: reportData.cashDrawer?.actual || 0,
      cashDrawerDiscrepancy: reportData.cashDrawer?.discrepancy || 0,
      reportedBy: reportData.cashDrawer?.reportedBy || 'N/A',
      verifiedBy: reportData.cashDrawer?.verifiedBy || 'N/A',
      refundsList: processedRefundsList, // Use processed list with full names
    };
    
    generatePDFReport(
      reportData.productBreakdown, 
      enhancedTotals, 
      activeTab, 
      currentPeriodText,
      selectedCashier
    );
  };

  const handleExportCSV = () => {
    setIsExportModalOpen(false);
    generateCSVReport(reportData.productBreakdown);
  };

  // --- DATA TABLE COLUMN DEFINITIONS ---
  const categoryColumns = [
    { name: "CATEGORY", selector: (row) => row.category, sortable: true },
    { name: "QUANTITY SOLD", selector: (row) => row.quantity || 0, center: true, sortable: true },
    { name: "SALES AMOUNT", selector: (row) => `₱${formatCurrency(row.sales)}`, center: true, sortable: true },
  ];

  const productColumns = [
    { name: "PRODUCT", selector: (row) => row.product, sortable: true },
    { name: "CATEGORY", selector: (row) => row.category, center: true, sortable: true },
    { name: "UNITS SOLD", selector: (row) => row.units || 0, center: true, sortable: true },
    { name: "TOTAL SALES", selector: (row) => `₱${formatCurrency(row.total)}`, center: true, sortable: true },
  ];
  
  const refundColumns = [
    { name: "#", selector: (row) => row.id, center: true, sortable: true, width: "10%" },
    { name: "DATE", selector: (row) => row.date, center: true, sortable: true, width: "15%" },
    { name: "PRODUCT", selector: (row) => row.product, sortable: true, width: "18%" },
    { name: "AMOUNT", selector: (row) => `₱${formatCurrency(row.amount)}`, center: true, sortable: true, width: "17%" },
    { name: "REASON", selector: (row) => row.reason || "N/A", sortable: true, width: "20%" },
    { name: "CASHIER", selector: (row) => row.cashier, center: true, sortable: true, width: "20%" },
  ];
  
  const commonTableStyles = {
    headCells: {
      style: {
        backgroundColor: "#4B929D", color: "#fff", fontWeight: "600",
        fontSize: "14px", padding: "12px", textTransform: "uppercase",
        textAlign: "center", letterSpacing: "1px",
      },
    },
    rows: { style: { minHeight: "55px", padding: "5px" } },
  };

  // Helper function to safely format currency
  const formatCurrency = (value) => {
    const num = parseFloat(value || 0);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="aSalesRep-page">
      <Sidebar />
      <div className="aSalesRep-report">
        <Header pageTitle="Sales Report" />

        {/* --- Filter Bar --- */}
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
                disabled={isCashiersLoading}
              >
                <option value="all">All Cashiers</option>
                {cashiersList.map((cashier) => (
                  <option key={cashier.UserID} value={cashier.Username}>
                    {cashier.FullName}
                  </option>
                ))}
              </select>
            </div>

            <button 
              className="aSalesRep-export-btn" 
              onClick={handleExportClick}
              disabled={!reportData || isLoading}
            >
              <FaFileExport /> Export
            </button>
          </div>
        </div>
        
        {/* --- Scrollable Content Area --- */}
        <div className="aSalesRep-scrollable-content">
          {isLoading ? (
            <Loading />
          ) : error ? (
            <UnableToLoadData />
          ) : !reportData || !reportData.productBreakdown || reportData.productBreakdown.length === 0 ? (
            <NoData />
          ) : (
            <>
              {/* --- Summary Cards --- */}
              <div className="aSalesRep-cards-container">
                <div className="aSalesRep-stat-card">
                  <div className="aSalesRep-card-icon aSalesRep-icon-green"><FaDollarSign /></div>
                  <div className="aSalesRep-card-content">
                    <div className="aSalesRep-card-label">TOTAL CASH SALES</div>
                    <div className="aSalesRep-card-value">₱{formatCurrency(reportData.summary?.totalSales)}</div>
                  </div>
                </div>

                <div className="aSalesRep-stat-card">
                  <div className="aSalesRep-card-icon aSalesRep-icon-blue"><FaCashRegister /></div>
                  <div className="aSalesRep-card-content">
                    <div className="aSalesRep-card-label">CASH IN DRAWER</div>
                    <div className="aSalesRep-card-value">₱{formatCurrency(reportData.summary?.cashInDrawer)}</div>
                  </div>
                </div>

                <div className="aSalesRep-stat-card">
                  <div className="aSalesRep-card-icon aSalesRep-icon-red"><FaBalanceScale /></div>
                  <div className="aSalesRep-card-content">
                    <div className="aSalesRep-card-label">CASH DISCREPANCY</div>
                    <div className={`aSalesRep-card-value ${(reportData.summary?.discrepancy || 0) < 0 ? 'aSalesRep-negative' : ''}`}>
                      ₱{formatCurrency(Math.abs(reportData.summary?.discrepancy || 0))} {(reportData.summary?.discrepancy || 0) < 0 ? 'Short' : 'Over'}
                    </div>
                  </div>
                </div>

                <div className="aSalesRep-stat-card">
                  <div className="aSalesRep-card-icon aSalesRep-icon-purple"><FaReceipt /></div>
                  <div className="aSalesRep-card-content">
                    <div className="aSalesRep-card-label">TOTAL TRANSACTIONS</div>
                    <div className="aSalesRep-card-value">{reportData.summary?.transactions ?? 0}</div>
                  </div>
                </div>

                <div className="aSalesRep-stat-card">
                  <div className="aSalesRep-card-icon aSalesRep-icon-orange"><FaUndo /></div>
                  <div className="aSalesRep-card-content">
                    <div className="aSalesRep-card-label">REFUNDS/RETURNS</div>
                    <div className="aSalesRep-card-value">₱{formatCurrency(reportData.summary?.refunds)}</div>
                  </div>
                </div>
              </div>

              {/* --- Side by Side Section --- */}
              <div className="aSalesRep-side-by-side-container">
                {/* Financial Details */}
                <div className="aSalesRep-table-section">
                  <h3 className="aSalesRep-section-title">Financial Details</h3>
                  
                  <div className="aSalesRep-payment-breakdown modern">
                      <div className="aSalesRep-payment-card">
                        <span className="aSalesRep-payment-label">Cash</span>
                        <div className="aSalesRep-payment-amount">₱{formatCurrency(reportData.paymentSummary?.cashAmount)}</div>
                      </div>
                      <div className="aSalesRep-payment-card">
                        <span className="aSalesRep-payment-label">GCash</span>
                        <div className="aSalesRep-payment-amount">₱{formatCurrency(reportData.paymentSummary?.gcashAmount)}</div>
                      </div>
                  </div>

                  <div className="aSalesRep-tabs-container" style={{ marginTop: '20px' }}>
                    <button className={`aSalesRep-content-tab ${financialTab === 'cashDrawer' ? 'active' : ''}`} onClick={() => setFinancialTab('cashDrawer')}><FaCashRegister /> Cash Drawer</button>
                    <button className={`aSalesRep-content-tab ${financialTab === 'refunds' ? 'active' : ''}`} onClick={() => setFinancialTab('refunds')}><FaUndo /> Refunds</button>
                  </div>

                  {financialTab === 'cashDrawer' ? (
                    <div className="aSalesRep-cash-drawer-grid">
                      <div className="aSalesRep-cash-item">
                        <span className="aSalesRep-cash-label">Opening Balance:</span>
                        <span className="aSalesRep-cash-value">₱{formatCurrency(reportData.cashDrawer?.opening)}</span>
                      </div>
                      <div className="aSalesRep-cash-item">
                        <span className="aSalesRep-cash-label">Total Cash Sales:</span>
                        <span className="aSalesRep-cash-value">₱{formatCurrency(reportData.cashDrawer?.cashSales)}</span>
                      </div>
                      <div className="aSalesRep-cash-item">
                        <span className="aSalesRep-cash-label">Total Refunds:</span>
                        <span className="aSalesRep-cash-value">₱{formatCurrency(reportData.cashDrawer?.refunds)}</span>
                      </div>
                      <div className="aSalesRep-cash-item">
                        <span className="aSalesRep-cash-label">Expected Cash:</span>
                        <span className="aSalesRep-cash-value">₱{formatCurrency(reportData.cashDrawer?.expected)}</span>
                      </div>
                      <div className="aSalesRep-cash-item">
                        <span className="aSalesRep-cash-label">Actual Cash Counted:</span>
                        <span className="aSalesRep-cash-value">₱{formatCurrency(reportData.cashDrawer?.actual)}</span>
                      </div>
                      <div className="aSalesRep-cash-item aSalesRep-cash-highlight">
                        <span className="aSalesRep-cash-label">Discrepancy:</span>
                        <span className={`aSalesRep-cash-value ${(reportData.cashDrawer?.discrepancy || 0) < 0 ? 'aSalesRep-negative' : ''}`}>
                          ₱{formatCurrency(Math.abs(reportData.cashDrawer?.discrepancy || 0))} {(reportData.cashDrawer?.discrepancy || 0) < 0 ? 'Short' : 'Over'}
                        </span>
                      </div>
                      <div className="aSalesRep-cash-item">
                        <span className="aSalesRep-cash-label">Reported By:</span>
                        <span className="aSalesRep-cash-value">{reportData.cashDrawer?.reportedBy ?? 'N/A'}</span>
                      </div>
                      <div className="aSalesRep-cash-item">
                        <span className="aSalesRep-cash-label">Verified By:</span>
                        <span className="aSalesRep-cash-value">{reportData.cashDrawer?.verifiedBy ?? 'N/A'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="aSalesRep-table-container">
                      <DataTable columns={refundColumns} data={processedRefundsList} responsive pagination customStyles={commonTableStyles} />
                    </div>
                  )}
                </div>

                {/* Sales Breakdown */}
                <div className="aSalesRep-table-section">
                  <div className="aSalesRep-section-title-row">
                    <h3 className="aSalesRep-section-title">Sales Breakdown</h3>
                    <button 
                      className="aSalesRep-view-all-btn"
                      onClick={() => setIsBreakdownModalOpen(true)}
                    >
                      View All
                    </button>
                  </div>
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
                        data={reportData.categoryBreakdown ?? []} 
                        striped 
                        responsive 
                        pagination
                        paginationPerPage={4}
                        paginationRowsPerPageOptions={[4]}
                        customStyles={commonTableStyles} 
                      />
                    ) : (
                      <DataTable 
                        columns={productColumns} 
                        data={reportData.productBreakdown ?? []} 
                        striped 
                        responsive 
                        pagination
                        paginationPerPage={4}
                        paginationRowsPerPageOptions={[4]}
                        customStyles={commonTableStyles} 
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <CustomDateModal 
        show={isCustomModalOpen} 
        onClose={() => setIsCustomModalOpen(false)} 
        onApply={handleCustomApply} 
      />

      <SalesReportModal
        show={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        data={salesBreakdownTab === 'category' ? reportData?.categoryBreakdown : reportData?.productBreakdown}
        type={salesBreakdownTab}
        periodText={currentPeriodText}
      />

      {/* Export Modal */}
      {isExportModalOpen && (
        <ExportModal
          onClose={() => setIsExportModalOpen(false)}
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
        />
      )}

      {/* No Data Modal */}
      {isNoDataModalOpen && (
        <NoDataModal onClose={() => setIsNoDataModalOpen(false)} />
      )}
    </div>
  );
}

export default SalesReport;