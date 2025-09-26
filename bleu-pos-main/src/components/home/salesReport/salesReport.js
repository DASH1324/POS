import React, { useState, useMemo, useEffect } from "react";
import "./salesReport.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import DataTable from "react-data-table-component";
import { FaFileExport } from "react-icons/fa";
import CustomDateModal from "../shared/customDateModal";

// --- HELPER: Formats a date object to 'YYYY-MM-DD' string RESPECTING LOCAL TIMEZONE ---
const formatDate = (date) => {
  const year = date.getFullYear();
  // getMonth() is 0-indexed (0 for January), so we add 1
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
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
      
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
        // Adding timezone offset handling for custom dates to prevent off-by-one day issues
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
  const [activeTab, setActiveTab] = useState("daily");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  
  // --- STATE FOR API DATA ---
  const [reportData, setReportData] = useState([]);
  const [reportTotals, setReportTotals] = useState({ transactions: 0, itemsSold: 0, storeSale: 0, onlineSale: 0, totalSale: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText("daily"));
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  // --- API CALL FUNCTION ---
  const fetchSalesReport = async (tab, startDate, endDate) => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken'); 

    if (!token) {
      setError("Authentication token not found. Please log in.");
      setIsLoading(false);
      return;
    }

    const body = {
      reportType: tab,
      startDate: startDate,
      endDate: endDate,
    };

    try {
      const response = await fetch('http://127.0.0.1:9000/auth/sales_metrics/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error: ${response.status}`);
      }

      const result = await response.json();
      setReportData(result.data);
      setReportTotals(result.totals);

    } catch (err) {
      setError(err.message);
      setReportData([]); 
      setReportTotals({ transactions: 0, itemsSold: 0, storeSale: 0, onlineSale: 0, totalSale: 0 });
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- EFFECT TO FETCH DATA WHEN TAB CHANGES ---
  useEffect(() => {
    if (activeTab === 'custom') {
      setReportData([]);
      setReportTotals({ transactions: 0, itemsSold: 0, storeSale: 0, onlineSale: 0, totalSale: 0 });
      setCurrentPeriodText(getPeriodText('custom', customRange.start, customRange.end));
      return;
    }
    
    const todayStr = formatDate(new Date());
    fetchSalesReport(activeTab, todayStr, todayStr);
    setCurrentPeriodText(getPeriodText(activeTab));

  }, [activeTab]);


  // --- COLUMNS (Structure remains the same) ---
  const dailyColumns = [
    { name: "PRODUCT NAME", selector: (row) => row.productName, sortable: true },
    { name: "CATEGORY", selector: (row) => row.category, center: true, sortable: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true, sortable: true },
    { name: "STORE SALE", selector: (row) => `₱${Number(row.storeSale).toFixed(2)}`, center: true, sortable: true },
    { name: "ONLINE SALE", selector: (row) => `₱${Number(row.onlineSale).toFixed(2)}`, center: true, sortable: true },
    { name: "TOTAL SALE", selector: (row) => `₱${Number(row.totalSale).toFixed(2)}`, center: true, sortable: true },
  ];

  const weeklyColumns = [
    { name: "DAY", selector: (row) => row.day, sortable: true },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true, sortable: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true, sortable: true },
    { name: "STORE SALE", selector: (row) => `₱${Number(row.storeSale).toFixed(2)}`, center: true, sortable: true },
    { name: "ONLINE SALE", selector: (row) => `₱${Number(row.onlineSale).toFixed(2)}`, center: true, sortable: true },
    { name: "TOTAL SALE", selector: (row) => `₱${Number(row.totalSale).toFixed(2)}`, center: true, sortable: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem, sortable: true },
  ];

  const monthlyColumns = [
    { name: "WEEK", selector: (row) => row.week, sortable: true },
    { name: "DATE PERIOD", selector: (row) => row.period, sortable: true },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true, sortable: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true, sortable: true },
    { name: "STORE SALE", selector: (row) => `₱${Number(row.storeSale).toFixed(2)}`, center: true, sortable: true },
    { name: "ONLINE SALE", selector: (row) => `₱${Number(row.onlineSale).toFixed(2)}`, center: true, sortable: true },
    { name: "TOTAL SALE", selector: (row) => `₱${Number(row.totalSale).toFixed(2)}`, center: true, sortable: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem, sortable: true },
  ];

  const yearlyColumns = [
    { name: "MONTH", selector: (row) => row.month, sortable: true },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true, sortable: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true, sortable: true },
    { name: "STORE SALE", selector: (row) => `₱${Number(row.storeSale).toFixed(2)}`, center: true, sortable: true },
    { name: "ONLINE SALE", selector: (row) => `₱${Number(row.onlineSale).toFixed(2)}`, center: true, sortable: true },
    { name: "TOTAL SALE", selector: (row) => `₱${Number(row.totalSale).toFixed(2)}`, center: true, sortable: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem, sortable: true },
  ];

  const customColumns = [
    { name: "DATE", selector: (row) => row.date, sortable: true },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true, sortable: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true, sortable: true },
    { name: "STORE SALE", selector: (row) => `₱${Number(row.storeSale).toFixed(2)}`, center: true, sortable: true },
    { name: "ONLINE SALE", selector: (row) => `₱${Number(row.onlineSale).toFixed(2)}`, center: true, sortable: true },
    { name: "TOTAL SALE", selector: (row) => `₱${Number(row.totalSale).toFixed(2)}`, center: true, sortable: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem, sortable: true },
  ];

  const { columns, data } = useMemo(() => {
    switch (activeTab) {
      case "weekly": return { columns: weeklyColumns, data: reportData };
      case "monthly": return { columns: monthlyColumns, data: reportData };
      case "yearly": return { columns: yearlyColumns, data: reportData };
      case "custom": return { columns: customColumns, data: reportData };
      default: return { columns: dailyColumns, data: reportData };
    }
  }, [activeTab, reportData]);


  // --- RENDER TOTALS FROM STATE ---
  const renderTotals = () => (
    <>
      {activeTab !== "daily" && (
        <span className="total-cell">TOTAL TRANSACTIONS: {reportTotals.transactions}</span>
      )}
      <span className="total-cell">ITEMS SOLD: {reportTotals.itemsSold}</span>
      <span className="total-cell">STORE SALE: ₱{reportTotals.storeSale.toFixed(2)}</span>
      <span className="total-cell">ONLINE SALE: ₱{reportTotals.onlineSale.toFixed(2)}</span>
      <span className="total-cell">TOTAL SALE: ₱{reportTotals.totalSale.toFixed(2)}</span>
    </>
  );

  // --- HANDLE CUSTOM DATE SUBMISSION ---
  const handleCustomApply = (startDate, endDate) => {
    const startStr = formatDate(new Date(startDate));
    const endStr = formatDate(new Date(endDate));

    fetchSalesReport('custom', startStr, endStr);
    setCustomRange({ start: startStr, end: endStr });
    setCurrentPeriodText(getPeriodText('custom', startStr, endStr));
    setActiveTab("custom");
    setIsCustomModalOpen(false);
  }

  return (
    <div className="sales-report-page">
      <Sidebar />
      <div className="report">
        <Header pageTitle="Sales Report" />

        {/* Tabs */}
        <div className="sales-tabs">
          <button className={activeTab === "daily" ? "active" : ""} onClick={() => setActiveTab("daily")}>
            Today
          </button>
          <button className={activeTab === "weekly" ? "active" : ""} onClick={() => setActiveTab("weekly")}>
            This Week
          </button>
          <button className={activeTab === "monthly" ? "active" : ""} onClick={() => setActiveTab("monthly")}>
            This Month
          </button>
          <button className={activeTab === "yearly" ? "active" : ""} onClick={() => setActiveTab("yearly")}>
            This Year
          </button>
          <button className={activeTab === "custom" ? "active" : ""} onClick={() => setIsCustomModalOpen(true)}>
            Custom
          </button>

          <button className="export-btn">
            <FaFileExport /> Export
          </button>
        </div>

        <div className="salesRep-table-container">
          <DataTable
            columns={columns}
            data={data}
            striped
            highlightOnHover
            responsive
            pagination
            fixedHeader
            fixedHeaderScrollHeight="60vh"
            progressPending={isLoading}
            noDataComponent={
              <div style={{ padding: "24px" }}>
                {error ? `Error: ${error}` : "No sales data available for this period."}
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
                style: { minHeight: "55px", padding: "5px" },
              },
            }}
          />

          <div className="sales-total-row">
            <span className="period-text">{currentPeriodText}</span>
            <div className="totals-right">
              {!isLoading && data.length > 0 && renderTotals()}
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