import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, Legend } from 'recharts';
import { FaFileExport, FaCashRegister, FaChartLine, FaBoxOpen, FaPercentage, FaUserFriends, FaExclamationTriangle } from 'react-icons/fa';
import { FaFilter } from "react-icons/fa";
import DataTable from 'react-data-table-component';
import { generatePDFReport, generateCSVReport } from './salesMonitoringExport';
import "./salesMonitoring.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import loadingAnimation from "../../../assets/animation/loading.json";
import Lottie from "lottie-react";
import '../../confirmAlertCustom.css';

const SAMPLE_SALES_DATA = [
  { id: 1, product: 'Espresso', category: 'Coffee', quantity: 45, revenue: 4500, date: '2025-10-26', cashier: 'John Doe' },
  { id: 2, product: 'Cappuccino', category: 'Coffee', quantity: 38, revenue: 5320, date: '2025-10-26', cashier: 'Jane Smith' },
  { id: 3, product: 'Latte', category: 'Coffee', quantity: 52, revenue: 6760, date: '2025-10-26', cashier: 'John Doe' },
  { id: 4, product: 'Americano', category: 'Coffee', quantity: 29, revenue: 3190, date: '2025-10-26', cashier: 'Mike Johnson' },
  { id: 5, product: 'Croissant', category: 'Pastry', quantity: 22, revenue: 1980, date: '2025-10-26', cashier: 'Jane Smith' },
  { id: 6, product: 'Blueberry Muffin', category: 'Pastry', quantity: 18, revenue: 1440, date: '2025-10-26', cashier: 'John Doe' },
  { id: 7, product: 'Chocolate Cake', category: 'Dessert', quantity: 12, revenue: 1800, date: '2025-10-26', cashier: 'Mike Johnson' },
  { id: 8, product: 'Iced Tea', category: 'Beverage', quantity: 35, revenue: 2450, date: '2025-10-26', cashier: 'Jane Smith' },
  { id: 9, product: 'Green Tea', category: 'Tea', quantity: 24, revenue: 2160, date: '2025-10-25', cashier: 'John Doe' },
  { id: 10, product: 'Milk Tea', category: 'Tea', quantity: 24, revenue: 2160, date: '2025-10-25', cashier: 'John Doe' },
];

// --- HELPER FUNCTION FOR DISPLAYING DATE RANGES ---
const getPeriodText = (dateRange) => {
  const today = new Date();

  switch (dateRange) {
    case "today": {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return today.toLocaleDateString('en-US', options);
    }
    case "week": {
      // Last 7 days including today
      const lastDayOfWeek = new Date(today);
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay());

      const start = firstDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = lastDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} - ${end}`;
    }
    case "month": {
      return today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    default:
      return "";
  }
};

// Export Format Modal Component
const ExportModal = ({ onClose, onExportPDF, onExportCSV }) => {
  return (
    <div className="salesMon-export-overlay" onClick={onClose}>
      <div className="salesMon-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="salesMon-export-close" onClick={onClose}>
          &times;
        </div>
        <div className="salesMon-export-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1>Choose Export Format</h1>
        <p>Select the file type you'd like to export.</p>

        <div className="salesMon-export-button-group">
          <button onClick={onExportPDF} className="salesMon-export-modal-btn salesMon-export-pdf">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </button>

          <button onClick={onExportCSV} className="salesMon-export-modal-btn salesMon-export-csv">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            CSV
          </button>
        </div>
      </div>
    </div>
  );
};

// No Data Modal Component
const NoDataModal = ({ onClose }) => {
  return (
    <div className="salesMon-export-overlay" onClick={onClose}>
      <div className="salesMon-export-modal salesMon-export-nodata" onClick={(e) => e.stopPropagation()}>
        <div className="salesMon-export-close" onClick={onClose}>
          &times;
        </div>
        <div className="salesMon-export-icon salesMon-export-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1>No Sales Data</h1>
        <p>There is no sales data available to export.</p>
      </div>
    </div>
  );
};

function SalesMonitoring() {
  const [dateRange, setDateRange] = useState('today');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCashier, setSelectedCashier] = useState('all');
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText('today'));

  // Fetch sales data from backend
  const fetchSalesData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const authToken = localStorage.getItem('authToken');
      
      if (!authToken) {
        throw new Error('No authentication token found. Please log in.');
      }
      
      const response = await fetch('http://localhost:9000/auth/sales_metrics/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          dateRange: dateRange,
          selectedCategory: selectedCategory === 'all' ? null : selectedCategory,
          selectedCashier: selectedCashier === 'all' ? null : selectedCashier
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sales data: ${response.statusText}`);
      }

      const data = await response.json();
      setSalesData(SAMPLE_SALES_DATA);
      
    } catch (err) {
      console.error('Error fetching sales data:', err);
      setError(err.message);
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change
  useEffect(() => {
    fetchSalesData();
    setCurrentPeriodText(getPeriodText(dateRange));
  }, [dateRange, selectedCategory, selectedCashier]);

  // Calculate metrics from fetched data
  const metrics = useMemo(() => {
    const totalSales = salesData.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = salesData.length;
    const totalItemsSold = salesData.reduce((sum, item) => sum + item.quantity, 0);
    const averageSaleValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Find top cashier
    const cashierSales = {};
    salesData.forEach(item => {
      if (item.cashier) {
        cashierSales[item.cashier] = (cashierSales[item.cashier] || 0) + item.revenue;
      }
    });
    
    const topCashierEntry = Object.entries(cashierSales).sort((a, b) => b[1] - a[1])[0];
    const topCashier = topCashierEntry ? { name: topCashierEntry[0], sales: topCashierEntry[1] } : null;

    return {
      totalSales,
      totalTransactions,
      totalItemsSold,
      averageSaleValue,
      topCashier,
      filtered: salesData
    };
  }, [salesData]);

  // Sales breakdown by product
  const salesBreakdown = useMemo(() => {
    const breakdown = {};
    const totalSales = metrics.totalSales;
    
    metrics.filtered.forEach(item => {
      if (!breakdown[item.product]) {
        breakdown[item.product] = { 
          product: item.product, 
          category: item.category,
          unitsSold: 0, 
          totalSales: 0,
          percentage: 0
        };
      }
      breakdown[item.product].unitsSold += item.quantity;
      breakdown[item.product].totalSales += item.revenue;
    });
    
    // Calculate percentages and sort by total sales
    return Object.values(breakdown)
      .map(item => ({
        ...item,
        percentage: totalSales > 0 ? ((item.totalSales / totalSales) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [metrics.filtered, metrics.totalSales]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    metrics.filtered.forEach(item => {
      if (!breakdown[item.category]) {
        breakdown[item.category] = { name: item.category, value: 0 };
      }
      breakdown[item.category].value += item.revenue;
    });
    return Object.values(breakdown);
  }, [metrics.filtered]);

  // Sales trend data (grouped by date for bar/line chart)
  const salesTrend = useMemo(() => {
    const trend = {};
    metrics.filtered.forEach(item => {
      const date = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trend[date] = (trend[date] || 0) + item.revenue;
    });
    return Object.entries(trend).map(([name, sales]) => ({ name, sales }));
  }, [metrics.filtered]);

  // Top selling products (top 10)
  const topProducts = useMemo(() => {
    return salesBreakdown.slice(0, 10).map(item => ({
      name: item.product,
      value: item.unitsSold
    }));
  }, [salesBreakdown]);

  const COLORS = ['#00b4d8', '#0096c7', '#0077b6', '#023e8a', '#03045e'];

  const uniqueCategories = [...new Set(salesData.map(item => item.category))];
  const uniqueCashiers = [...new Set(salesData.map(item => item.cashier).filter(Boolean))];

  const salesBreakdownColumns = [
    {
      name: 'Product',
      sortable: true,
      width: '33%',
      cell: row => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', color: '#111827' }}>{row.product}</span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{row.category}</span>
        </div>
      ),
    },
    {
      name: 'Units Sold',
      selector: row => row.unitsSold,
      sortable: true,
      center: true,
      width: '33%',
    },
    {
      name: 'Total Sales',
      sortable: true,
      right: true,
      width: '33%',
        cell: row => (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontWeight: '600', color: '#111827' }}>
              ₱{row.totalSales.toFixed(2)}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{row.percentage}%</span>
          </div>
        ),
    },
  ];

  // Custom styles for DataTable
  const customStyles = {
    headRow: {
      style: {
        backgroundColor: '#4B929D',
        color: '#fff',
        fontWeight: 600,
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
      },
    },
    headCells: {
      style: {
        paddingLeft: '12px',
        paddingRight: '12px',
        color: '#fff',
      },
    },
    rows: {
      style: {
        fontSize: '13px',
        minHeight: '64px',
        color: '#374151',
        '&:hover': {
          backgroundColor: '#f9fafb',
        },
      },
      stripedStyle: {
        backgroundColor: '#f9fafb',
      },
    },
    cells: {
      style: {
        paddingLeft: '12px',
        paddingRight: '12px',
      },
    },
  };

  // Handle export button click
  const handleExportClick = () => {
    if (!metrics.filtered.length) {
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
    <div className='sales-monitoring'>
      <Sidebar />
      <div className='monitoring'>
        <Header pageTitle="Sales Monitoring" />

        <div className='salesMonFilterWrapper'>
          {/* Filter Bar with Toggle */}
          <div className={`salesMonFilterBar ${isFilterOpen ? "open" : "collapsed"}`}>
            <button
              className="salesMonFilterToggleBtn"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter />
              <span className="salesMonPeriodText">Date {currentPeriodText}</span>
            </button>

            <div className='salesMonFilterItem'>
              <span>Period:</span>  
              <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
                className='salesMonSelect'
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            <div className='salesMonFilterItem'>
              <span>Category:</span>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className='salesMonSelect salesMonSelectCategory'
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className='salesMonFilterItem'>
              <span>Cashier:</span>
              <select 
                value={selectedCashier} 
                onChange={(e) => setSelectedCashier(e.target.value)}
                className='salesMonSelect salesMonSelectCashier'
              >
                <option value="all">All Cashiers</option>
                {uniqueCashiers.map(cashier => (
                  <option key={cashier} value={cashier}>{cashier}</option>
                ))}
              </select>
            </div>

            <button 
              className="salesMonClearBtn"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>

            <button 
              onClick={handleExportClick}
              className='salesMonBtn salesMonBtnExport'
            >
              <FaFileExport /> Export
            </button>
          </div>
        </div>

        <div className="salesMonMetrics-content">
          {/* Loading State */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-bg">
                <Lottie animationData={loadingAnimation} loop={true} className="loading-animation" />
              </div>
            </div>
          ) : (
            <>
              {/* No Data Warning - Show when there's no data and no error */}
              {salesData.length === 0 && !error && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '8px',
                  padding: '20px',
                  margin: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  <FaExclamationTriangle style={{ color: '#856404', fontSize: '24px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#856404', fontSize: '16px', fontWeight: '600' }}>
                      No Sales Data Available
                    </h4>
                    <p style={{ margin: 0, color: '#856404', fontSize: '14px' }}>
                      There are no sales records for the selected filters. Try adjusting your date range, category, or cashier selection.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Warning - Show when there's an error */}
              {error && (
                <div style={{
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c2c7',
                  borderRadius: '8px',
                  padding: '20px',
                  margin: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  <FaExclamationTriangle style={{ color: '#842029', fontSize: '24px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#842029', fontSize: '16px', fontWeight: '600' }}>
                      Unable to Load Sales Data
                    </h4>
                    <p style={{ margin: 0, color: '#842029', fontSize: '14px' }}>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Key Metrics Cards - Only show when there's data */}
              {salesData.length > 0 && (
                <div className="salesMonMetrics">
                  <div className="salesMonCard">
                    <div className="salesMonCardIcon salesMonIconRevenue">
                      <FaCashRegister />
                    </div>
                    <div className="salesMonCardContent">
                      <div className="salesMonCardLabel">Total Sales</div>
                      <div className="salesMonCardValue">
                        ₱{metrics.totalSales.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="salesMonCard">
                    <div className="salesMonCardIcon salesMonIconProfit">
                      <FaChartLine />
                    </div>
                    <div className="salesMonCardContent">
                      <div className="salesMonCardLabel">Total Transactions</div>
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
                        <div className="salesMonCardValue">{metrics.totalItemsSold}</div>
                        <div className="salesMonCardUnit">items</div>
                      </div>
                    </div>
                  </div>

                  <div className="salesMonCard">
                    <div className="salesMonCardIcon salesMonIconMargin">
                      <FaPercentage />
                    </div>
                    <div className="salesMonCardContent">
                      <div className="salesMonCardLabel">Average Sale Value</div>
                      <div className="salesMonCardValue salesMonValueMargin">
                        ₱{metrics.averageSaleValue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
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
                        <div className="salesMonCardValue" style={{ fontSize: '18px' }}>
                          {metrics.topCashier.name}
                        </div>
                        <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: '600' }}>
                          ₱{metrics.topCashier.sales.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Charts and Table Section - Only show when there's data */}
              {salesData.length > 0 && (
                <div className='salesMonChartsAndTable'>
                  {/* Left side: Charts */}
                  <div className='salesMonCharts'>
                    {/* Sales Trend */}
                    <div className='salesMonChartCard'>
                      <h3 className='salesMonChartTitle'>Sales Trend</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={salesTrend}>
                          <defs>
                            <linearGradient id="colorSalesTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} contentStyle={{ borderRadius: '4px', border: '1px solid #ccc' }} />
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

                    {/* Sales by Category */}
                    <div className='salesMonChartCard'>
                      <h3 className='salesMonChartTitle'>Sales by Category</h3>
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
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} contentStyle={{ borderRadius: '4px', border: '1px solid #ccc' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Top Selling Products */}
                    <div className='salesMonChartCard salesMonChartCardWide'>
                      <h3 className='salesMonChartTitle'>Top-Selling Products</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topProducts} layout="horizontal">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #ccc' }} />
                          <Bar dataKey="value" fill="#00b4d8" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right side: Sales Breakdown Table */}
                  <div className='salesMonTableCard'>
                    <h3 className='salesMonTableTitle'>Sales Breakdown</h3>
                    <DataTable
                      columns={salesBreakdownColumns}
                      data={salesBreakdown}
                      pagination
                      paginationPerPage={10}
                      paginationRowsPerPageOptions={[10]}
                      striped
                      highlightOnHover
                      customStyles={customStyles}
                      noDataComponent={
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          No sales data available
                        </div>
                      }
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SalesMonitoring;