import React, { useState, useMemo, useEffect } from "react";
import "./salesReport.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import DataTable from "react-data-table-component";
import { FaFileExport } from "react-icons/fa";
import CustomDateModal from "../shared/customDateModal"; 


// --- HIII PATANGAL NA LANG PO NG COMMENTS AFTER THAT WILL BE OUR GUIDE MUNA ---

// --- MOCK DATA FOR CUSTOM TAB ---
const mockCustomData = [
  { date: "2024-05-01", transactions: 15, itemsSold: 30, storeSale: 1500, onlineSale: 800, totalSale: 2300, bestItem: "Latte" },
  { date: "2024-05-02", transactions: 18, itemsSold: 35, storeSale: 1800, onlineSale: 1000, totalSale: 2800, bestItem: "Burger" },
  { date: "2024-05-03", transactions: 20, itemsSold: 45, storeSale: 2200, onlineSale: 1200, totalSale: 3400, bestItem: "Fries" },
];

// --- MOCK API CALL FUNCTION ---
const fetchCustomData = (startDate, endDate) => {
  console.log(`Fetching data from ${startDate} to ${endDate}...`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockCustomData); 
    }, 500);
  });
};

// --- HELPER FUNCTION FOR DATE RANGES (Assumes current date is today) ---
const getPeriodText = (tab, customStart = null, customEnd = null) => {
  const today = new Date("2025-09-26"); 
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

  switch (tab) {
    case "daily": {
      // Halimbawa: Date: September 26, 2025 Friday
      return `Date: ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${today.getFullYear()} ${today.toLocaleDateString('en-US', { weekday: 'long' })}`;
    }
    case "weekly": {
      // Halimbawa: Date Period: Sep 22 - Sep 28, 2025
      const firstDayOfWeek = new Date(today);
      // Logic para mahanap  Monday hahahah
      firstDayOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1)); 
      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);

      const start = firstDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = lastDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `Date Period: ${start} - ${end}`;
    }
    case "monthly": {
      // Halimbawa: Month: September
      return `Month: ${today.toLocaleDateString('en-US', { month: 'long' })}`;
    }
    case "yearly": {
      // Halimbawa: Year: 2025
      return `Year: ${today.getFullYear()}`;
    }
    case "custom": {
      if (customStart && customEnd) {
        // Halimbawa: Date Period: May 1, 2024 - May 3, 2024
        const start = new Date(customStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const end = new Date(customEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const [customData, setCustomData] = useState([]);
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText("daily")); 
  const [customRange, setCustomRange] = useState({ start: null, end: null }); 

  // --- Date Range Effect ---
  // Update the period text whenever the activeTab or customRange changes
  useEffect(() => {
    if (activeTab === 'custom') {
        setCurrentPeriodText(getPeriodText(activeTab, customRange.start, customRange.end));
    } else {
        setCurrentPeriodText(getPeriodText(activeTab));
        // Clear custom-related states when switching to a fixed tab
        setCustomData([]); 
        setCustomRange({ start: null, end: null }); 
    }
  }, [activeTab, customRange]);

  // DAILY
  const dailyData = [
    { productName: "Cappuccino", category: "Drinks", itemsSold: 30, storeSale: 1500, onlineSale: 1000, totalSale: 2500 },
    { productName: "Cheeseburger", category: "Food", itemsSold: 20, storeSale: 1200, onlineSale: 800, totalSale: 2000 },
  ];

  // WEEKLY
  const weeklyData = [
    { day: "Monday", transactions: 25, itemsSold: 40, storeSale: 3000, onlineSale: 2000, totalSale: 5000, bestItem: "Latte" },
    { day: "Tuesday", transactions: 30, itemsSold: 55, storeSale: 3500, onlineSale: 2500, totalSale: 6000, bestItem: "Pizza" },
    { day: "Wednesday", transactions: 28, itemsSold: 48, storeSale: 3200, onlineSale: 2200, totalSale: 5400, bestItem: "Americano" },
    { day: "Thursday", transactions: 35, itemsSold: 60, storeSale: 4000, onlineSale: 2800, totalSale: 6800, bestItem: "Fries" },
    { day: "Friday", transactions: 40, itemsSold: 70, storeSale: 4500, onlineSale: 3500, totalSale: 8000, bestItem: "Mocha" },
    { day: "Saturday", transactions: 50, itemsSold: 90, storeSale: 6000, onlineSale: 4000, totalSale: 10000, bestItem: "Frappe" },
    { day: "Sunday", transactions: 20, itemsSold: 35, storeSale: 2500, onlineSale: 1500, totalSale: 4000, bestItem: "Sandwich" },
  ];

  // MONTHLY
  const monthlyData = [
    { week: "Week 1", period: "Sep 1 - Sep 7", transactions: 150, itemsSold: 250, storeSale: 18000, onlineSale: 12000, totalSale: 30000, bestItem: "Latte" },
    { week: "Week 2", period: "Sep 8 - Sep 14", transactions: 170, itemsSold: 280, storeSale: 20000, onlineSale: 14000, totalSale: 34000, bestItem: "Burger" },
    { week: "Week 3", period: "Sep 15 - Sep 21", transactions: 160, itemsSold: 270, storeSale: 19000, onlineSale: 13000, totalSale: 32000, bestItem: "Pizza" },
    { week: "Week 4", period: "Sep 22 - Sep 30", transactions: 180, itemsSold: 300, storeSale: 22000, onlineSale: 15000, totalSale: 37000, bestItem: "Cappuccino" },
  ];

  // YEARLY
  const yearlyData = [
    { month: "January", transactions: 400, itemsSold: 600, storeSale: 20000, onlineSale: 15000, totalSale: 35000, bestItem: "Latte" },
    { month: "February", transactions: 380, itemsSold: 550, storeSale: 19000, onlineSale: 16000, totalSale: 35000, bestItem: "Burger" },
    { month: "March", transactions: 420, itemsSold: 620, storeSale: 21000, onlineSale: 17000, totalSale: 38000, bestItem: "Fries" },
    { month: "April", transactions: 390, itemsSold: 580, storeSale: 18500, onlineSale: 16500, totalSale: 35000, bestItem: "Iced Coffee" },
    { month: "May", transactions: 410, itemsSold: 600, storeSale: 19500, onlineSale: 16800, totalSale: 36300, bestItem: "Donut" },
    { month: "June", transactions: 430, itemsSold: 640, storeSale: 22000, onlineSale: 17500, totalSale: 39500, bestItem: "Tea" },
    { month: "July", transactions: 400, itemsSold: 610, storeSale: 20500, onlineSale: 16200, totalSale: 36700, bestItem: "Burger" },
    { month: "August", transactions: 420, itemsSold: 630, storeSale: 21500, onlineSale: 17200, totalSale: 38700, bestItem: "Latte" },
    { month: "September", transactions: 390, itemsSold: 590, storeSale: 20000, onlineSale: 16000, totalSale: 36000, bestItem: "Fries" },
    { month: "October", transactions: 410, itemsSold: 620, storeSale: 21000, onlineSale: 17000, totalSale: 38000, bestItem: "Donut" },
    { month: "November", transactions: 405, itemsSold: 600, storeSale: 20800, onlineSale: 16800, totalSale: 37600, bestItem: "Burger" },
    { month: "December", transactions: 450, itemsSold: 680, storeSale: 23000, onlineSale: 18000, totalSale: 41000, bestItem: "Iced Coffee" },
  ];

  // COLUMNS
  const dailyColumns = [
    { name: "PRODUCT NAME", selector: (row) => row.productName },
    { name: "CATEGORY", selector: (row) => row.category, center: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true },
    { name: "STORE SALE", selector: (row) => `₱${row.storeSale}`, center: true },
    { name: "ONLINE SALE", selector: (row) => `₱${row.onlineSale}`, center: true },
    { name: "TOTAL SALE", selector: (row) => `₱${row.totalSale}`, center: true },
  ];

  const weeklyColumns = [
    { name: "DAY", selector: (row) => row.day },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true },
    { name: "STORE SALE", selector: (row) => `₱${row.storeSale}`, center: true },
    { name: "ONLINE SALE", selector: (row) => `₱${row.onlineSale}`, center: true },
    { name: "TOTAL SALE", selector: (row) => `₱${row.totalSale}`, center: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem },
  ];

  const monthlyColumns = [
    { name: "WEEK", selector: (row) => row.week },
    { name: "DATE PERIOD", selector: (row) => row.period },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true },
    { name: "STORE SALE", selector: (row) => `₱${row.storeSale}`, center: true },
    { name: "ONLINE SALE", selector: (row) => `₱${row.onlineSale}`, center: true },
    { name: "TOTAL SALE", selector: (row) => `₱${row.totalSale}`, center: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem },
  ];

  const yearlyColumns = [
    { name: "MONTH", selector: (row) => row.month },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true },
    { name: "STORE SALE", selector: (row) => `₱${row.storeSale}`, center: true },
    { name: "ONLINE SALE", selector: (row) => `₱${row.onlineSale}`, center: true },
    { name: "TOTAL SALE", selector: (row) => `₱${row.totalSale}`, center: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem },
  ];

  const customColumns = [
    { name: "DATE", selector: (row) => row.date },
    { name: "TRANSACTIONS", selector: (row) => row.transactions, center: true },
    { name: "ITEMS SOLD", selector: (row) => row.itemsSold, center: true },
    { name: "STORE SALE", selector: (row) => `₱${row.storeSale}`, center: true },
    { name: "ONLINE SALE", selector: (row) => `₱${row.onlineSale}`, center: true },
    { name: "TOTAL SALE", selector: (row) => `₱${row.totalSale}`, center: true },
    { name: "BEST SELLING", selector: (row) => row.bestItem },
  ];

  // TABS
  let columns = dailyColumns;
  let data = dailyData;

  if (activeTab === "weekly") {
    columns = weeklyColumns;
    data = weeklyData;
  } else if (activeTab === "monthly") {
    columns = monthlyColumns;
    data = monthlyData;
  } else if (activeTab === "yearly") {
    columns = yearlyColumns;
    data = yearlyData;
  } else if (activeTab === "custom") {
    columns = customColumns;
    data = customData;
  }

  // TOTALS
  const totals = useMemo(() => {
    if (data.length === 0) return { transactions: 0, itemsSold: 0, storeSale: 0, onlineSale: 0, totalSale: 0 };
    
    // Check if the current data array has aggregated sales properties (transactions, storeSale, onlineSale)
    const hasAggregatedData = data.some(r => r.transactions !== undefined);

    return {
      transactions: hasAggregatedData ? data.reduce((sum, r) => sum + (r.transactions || 0), 0) : 0,
      itemsSold: data.reduce((sum, r) => sum + (r.itemsSold || 0), 0),
      storeSale: data.reduce((sum, r) => sum + (r.storeSale || 0), 0),
      onlineSale: data.reduce((sum, r) => sum + (r.onlineSale || 0), 0),
      totalSale: data.reduce((sum, r) => sum + (r.totalSale || 0), 0), 
    };
  }, [data]);
  
  // Adjusted totals display logic
  const renderTotals = () => (
    <>
      {/* Transaction total is only relevant for (weekly, monthly, yearly, custom) */}
      {activeTab !== "daily" && (
        <span className="total-cell">TOTAL TRANSACTIONS: {totals.transactions}</span>
      )}
      <span className="total-cell">ITEMS SOLD: {totals.itemsSold}</span>
      
      {/* Store and Online sales are present in all mock data, so we display them unless we decide to hide them for 'daily' product-level view */}
      {/* Since Daily Data also includes storeSale/onlineSale, we'll display them */}
      <span className="total-cell">STORE SALE: ₱{totals.storeSale}</span>
      <span className="total-cell">ONLINE SALE: ₱{totals.onlineSale}</span>
      <span className="total-cell">TOTAL SALE: ₱{totals.totalSale}</span>
    </>
  );
  
  const handleCustomApply = async (startDate, endDate) => {
    // Fetch data
    const rows = await fetchCustomData(startDate, endDate); 
    
    // Set custom data and range
    setCustomData(rows);
    setCustomRange({ start: startDate, end: endDate });

    // Switch to custom tab (this will trigger the useEffect to update currentPeriodText)
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
            noDataComponent={<div style={{ padding: "24px" }}>No sales data available.</div>}
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

          {/* UPDATED sales-total-row structure */}
          <div className="sales-total-row">
            {/* Display date/period on the left */}
            <span className="period-text">{currentPeriodText}</span> 

            {/* Display totals on the right */}
            <div className="totals-right">
              {renderTotals()}
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOM DATE MODAL */}
      <CustomDateModal
        show={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onApply={handleCustomApply}
      />
    </div>
  );
}

export default SalesReport;