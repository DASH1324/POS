import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FaFileExport, FaCashRegister, FaChartLine, FaBoxOpen, FaPercentage } from 'react-icons/fa';
import { generatePDFReport, generateCSVReport } from './salesMonitoringExport';
import "./salesMonitoring.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";

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
        <button onClick={onClose} className="salesMon-export-btn-single">
          Okay
        </button>
      </div>
    </div>
  );
};

function SalesMonitoring() {
  const [dateRange, setDateRange] = useState('today');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch sales data from backend
  const fetchSalesData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const authToken = localStorage.getItem('authToken'); // Get authToken from localStorage
      
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
          selectedProduct: selectedProduct === 'all' ? null : selectedProduct,
          selectedCategory: selectedCategory === 'all' ? null : selectedCategory
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sales data: ${response.statusText}`);
      }

      const data = await response.json();
      setSalesData(data.salesData || []);
      
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
  }, [dateRange, selectedProduct, selectedCategory]);

  // Calculate metrics from fetched data
  const metrics = useMemo(() => {
    const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
    const totalProfit = salesData.reduce((sum, item) => sum + item.profit, 0);
    const totalQuantity = salesData.reduce((sum, item) => sum + item.quantity, 0);
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

    return {
      totalRevenue,
      totalProfit,
      totalQuantity,
      profitMargin,
      transactionCount: salesData.length,
      filtered: salesData
    };
  }, [salesData]);

  // Product breakdown for charts
  const productBreakdown = useMemo(() => {
    const breakdown = {};
    metrics.filtered.forEach(item => {
      if (!breakdown[item.product]) {
        breakdown[item.product] = { name: item.product, revenue: 0, profit: 0, quantity: 0 };
      }
      breakdown[item.product].revenue += item.revenue;
      breakdown[item.product].profit += item.profit;
      breakdown[item.product].quantity += item.quantity;
    });
    return Object.values(breakdown);
  }, [metrics.filtered]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    metrics.filtered.forEach(item => {
      if (!breakdown[item.category]) {
        breakdown[item.category] = { name: item.category, revenue: 0, quantity: 0 };
      }
      breakdown[item.category].revenue += item.revenue;
      breakdown[item.category].quantity += item.quantity;
    });
    return Object.values(breakdown);
  }, [metrics.filtered]);

  // Order type distribution
  const orderTypeData = useMemo(() => {
    const breakdown = {};
    metrics.filtered.forEach(item => {
      breakdown[item.orderType] = (breakdown[item.orderType] || 0) + 1;
    });
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  }, [metrics.filtered]);

  const COLORS = ['#4B929D', '#5BA3AE', '#6CB4BF', '#7DC5D0', '#8ED6E1'];

  const uniqueProducts = [...new Set(salesData.map(item => item.product))];
  const uniqueCategories = [...new Set(salesData.map(item => item.category))];

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
      generatePDFReport(metrics, selectedProduct, selectedCategory);
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
    setSelectedProduct("all");
    setSelectedCategory("all");
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

        {/* Filter Bar */}
        <div className='salesMonFilterBar'>
          <div className='salesMonFilterItem'>
            <span>Date Range:</span>  
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
            <span>Product:</span>
            <select 
              value={selectedProduct} 
              onChange={(e) => setSelectedProduct(e.target.value)}
              className='salesMonSelect salesMonSelectProduct'
            >
              <option value="all">All Products</option>
              {uniqueProducts.map(product => (
                <option key={product} value={product}>{product}</option>
              ))}
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

        <div className="salesMonMetrics-content">
          {/* Loading/Error States */}
          {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading sales data...</div>}
          {error && <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>Error: {error}</div>}

          {/* Key Metrics Cards */}
          <div className="salesMonMetrics">
            <div className="salesMonCard">
              <div className="salesMonCardIcon salesMonIconRevenue">
                <FaCashRegister />
              </div>
              <div className="salesMonCardContent">
                <div className="salesMonCardLabel">Total Revenue</div>
                <div className="salesMonCardValue">
                  ₱{metrics.totalRevenue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="salesMonCard">
              <div className="salesMonCardIcon salesMonIconProfit">
                <FaChartLine />
              </div>
              <div className="salesMonCardContent">
                <div className="salesMonCardLabel">Gross Profit</div>
                <div className="salesMonCardValue salesMonValueProfit">
                  ₱{metrics.totalProfit.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="salesMonCard">
              <div className="salesMonCardIcon salesMonIconQuantity">
                <FaBoxOpen />
              </div>
              <div className="salesMonCardContent">
                <div className="salesMonCardLabel">Quantity Sold</div>
                <div className="salesMonCardValueRow">
                  <div className="salesMonCardValue">{metrics.totalQuantity}</div>
                  <div className="salesMonCardUnit">items</div>
                </div>
              </div>
            </div>

            <div className="salesMonCard">
              <div className="salesMonCardIcon salesMonIconMargin">
                <FaPercentage />
              </div>
              <div className="salesMonCardContent">
                <div className="salesMonCardLabel">Profit Margin</div>
                <div className="salesMonCardValue salesMonValueMargin">{metrics.profitMargin}%</div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className='salesMonCharts'>
            {/* Revenue by Product */}
            <div className='salesMonChartCard'>
              <h3 className='salesMonChartTitle'>Revenue by Product</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} contentStyle={{ borderRadius: '4px', border: '1px solid #ccc' }} />
                  <Bar dataKey="revenue" fill="#4B929D" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Profit by Product */}
            <div className='salesMonChartCard'>
              <h3 className='salesMonChartTitle'>Profit by Product</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} contentStyle={{ borderRadius: '4px', border: '1px solid #ccc' }} />
                  <Bar dataKey="profit" fill="#28a745" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Revenue */}
            <div className='salesMonChartCard'>
              <h3 className='salesMonChartTitle'>Revenue by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={{ fontSize: 12 }}>
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} contentStyle={{ borderRadius: '4px', border: '1px solid #ccc' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Order Type Distribution */}
            <div className='salesMonChartCard'>
              <h3 className='salesMonChartTitle'>Order Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={orderTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={{ fontSize: 12 }}>
                    {orderTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #ccc' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Product Details Table */}
          <div className='salesMonTableCard'>
            <h3 className='salesMonTableTitle'>Product Performance Details</h3>
            <div className='salesMonTableWrapper'>
              <table className='salesMonTable'>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Revenue</th>
                    <th>Profit</th>
                    <th>Quantity</th>
                    <th>Order Type</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.filtered.length > 0 ? (
                    metrics.filtered.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.product}</td>
                        <td>{item.category}</td>
                        <td>₱{item.revenue.toFixed(2)}</td>
                        <td>₱{item.profit.toFixed(2)}</td>
                        <td>{item.quantity}</td>
                        <td>{item.orderType}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                        No sales data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalesMonitoring;