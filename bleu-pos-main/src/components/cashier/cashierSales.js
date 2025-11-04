import React, { useState, useMemo, useEffect } from 'react';
import './cashierSales.css';
import Navbar from '../navbar';
import DataTable from "react-data-table-component";
import {
  faMoneyBillWave,
  faShoppingCart,
  faChartLine,
  faReceipt,
  faTimes,
  faExclamationTriangle,
  faCheckCircle,
  faCoins,
  faCashRegister,
  faDownload,
  faSpinner,
  faFilter,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';


// API Endpoints
const SESSION_API_URL = 'http://127.0.0.1:9001/api';
const CANCELLED_ORDERS_API_URL = 'http://127.0.0.1:9000/auth/cancelled_orders';
const SALES_METRICS_API_URL = 'http://127.0.0.1:9000/auth/sales_metrics';
const CASH_TALLY_API_URL = 'http://127.0.0.1:9001/api/auth/cash_tally';
const TOP_PRODUCTS_API_URL = 'http://127.0.0.1:9000/auth/top_products';
const SPILLAGE_API_URL = 'http://127.0.0.1:9003/wastelogs';

function CashierSales({ shiftLabel = "Morning Shift", shiftTime = "6:00AM – 2:00PM", date }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [modalType, setModalType] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderTypeFilter, setOrderTypeFilter] = useState('All');
  const [productTypeFilter, setProductTypeFilter] = useState('All');
  const [initialCash, setInitialCash] = useState(0);
  const [loggedInUser, setLoggedInUser] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [salesData, setSalesData] = useState({ totalSales: 0, cashSales: 0, gcashSales: 0, itemsSold: 0 });
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState(null);
  const [sessionSalesData, setSessionSalesData] = useState({ totalSales: 0, cashSales: 0, gcashSales: 0, itemsSold: 0 });
  const [isSessionSalesLoading, setIsSessionSalesLoading] = useState(true);
  const [sessionSalesError, setSessionSalesError] = useState(null);
  const [cancelledOrders, setCancelledOrders] = useState([]);
  const [isCancelledLoading, setIsCancelledLoading] = useState(false);
  const [cancelledError, setCancelledError] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [isTopProductsLoading, setIsTopProductsLoading] = useState(true);
  const [topProductsError, setTopProductsError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashCounts, setCashCounts] = useState({
    bills1000: 0, bills500: 0, bills200: 0, bills100: 0, bills50: 0, bills20: 0,
    coins10: 0, coins5: 0, coins1: 0, cents25: 0, cents10: 0, cents05: 0
  });

  // PIN Modal states
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalType, setPinModalType] = useState(null); // 'confirm' or 'discrepancy'
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  // Spillage state
  const [spillageEntries, setSpillageEntries] = useState([]);
  const [isSpillageLoading, setIsSpillageLoading] = useState(true);
  const [spillageError, setSpillageError] = useState(null);

  // Helper function to get dynamic section titles based on product type filter
  const getSectionTitles = () => {
    switch (productTypeFilter) {
      case 'Products':
        return {
          topSelling: 'Top Selling Products',
          cancelled: 'Cancelled or Refunded Products'
        };
      case 'Merchandise':
        return {
          topSelling: 'Top Selling Merchandise',
          cancelled: 'Cancelled or Refunded Merchandise'
        };
      case 'All':
      default:
        return {
          topSelling: 'Top Selling Products and Merchandise',
          cancelled: 'Cancelled or Refunded Products and Merchandise'
        };
    }
  };

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username) {
        setLoggedInUser(username);
    }

    const fetchSalesMetricsByDate = async () => {
      const token = localStorage.getItem('authToken');
      if (!token || !username) return;
      setIsSalesLoading(true); setSalesError(null);
      try {
        const response = await fetch(`${SALES_METRICS_API_URL}/by_date`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            cashierName: username,
            date: selectedDate,
            orderType: orderTypeFilter,
            productType: productTypeFilter
          })
        });
        if (!response.ok) throw new Error("Failed to fetch daily sales.");
        const data = await response.json();
        setSalesData(data);
      } catch (err) { setSalesError(err.message); } finally { setIsSalesLoading(false); }
    };

    const fetchSessionSalesMetrics = async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !username) return;
        setIsSessionSalesLoading(true); setSessionSalesError(null);
        try {
          const response = await fetch(`${SALES_METRICS_API_URL}/current_session`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              cashierName: username,
              orderType: orderTypeFilter,
              productType: productTypeFilter
            })
          });
          if (!response.ok) throw new Error("Failed to fetch session sales.");
          const data = await response.json();
          setSessionSalesData(data);
        } catch (err) { setSessionSalesError(err.message); } finally { setIsSessionSalesLoading(false); }
    };

    const fetchSessionData = async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !username) { setError("No cashier logged in."); setIsLoading(false); return; }
        setIsLoading(true); setError(null);
        try {
            const response = await fetch(`${SESSION_API_URL}/session/status?cashier_name=${encodeURIComponent(username)}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error("Could not fetch session data.");
            const data = await response.json();
            if (data.hasActiveSession) {
                setInitialCash(data.initialCash || 0);
                setActiveSessionId(data.sessionId);
            } else {
                setInitialCash(0); setActiveSessionId(null);
                setError(`No active session found for ${username} today.`);
            }
        } catch (err) { setError(err.message); setInitialCash(0); } finally { setIsLoading(false); }
    };

    const fetchCancelledOrders = async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !username) return;
        setIsCancelledLoading(true); setCancelledError(null);
        try {
            const response = await fetch(`${CANCELLED_ORDERS_API_URL}/by_date`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify({
                  cashierName: username,
                  date: selectedDate,
                  orderType: orderTypeFilter,
                  productType: productTypeFilter
                })
            });
            if (!response.ok) throw new Error("Failed to fetch cancelled/refunded orders.");
            const data = await response.json();
            setCancelledOrders(data.flatMap(o => o.orderItems.map((item, i) => ({
              id: `${o.id}-${i}`,
              time: new Date(o.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              product: item.name,
              qty: item.quantity,
              value: (item.price * item.quantity).toFixed(2),
              status: o.status === 'refunded' ? 'Refund' : 'Cancelled'
            }))));
        } catch (error) { setCancelledError(error.message); } finally { setIsCancelledLoading(false); }
    };

    const fetchTopProducts = async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !username) return;
        setIsTopProductsLoading(true); setTopProductsError(null);
        try {
            const response = await fetch(`${TOP_PRODUCTS_API_URL}/by_date`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  cashierName: username,
                  date: selectedDate,
                  orderType: orderTypeFilter,
                  productType: productTypeFilter
                })
            });
            if (!response.ok) throw new Error("Failed to fetch top products.");
            const data = await response.json();
            setTopProducts(data);
        } catch (err) {
            setTopProductsError(err.message);
        } finally {
            setIsTopProductsLoading(false);
        }
    };

    const fetchSpillageData = async () => {
      const token = localStorage.getItem('authToken');
      if (!token || !username) return;

      setIsSpillageLoading(true);
      setSpillageError(null);

      try {
        const url = `${SPILLAGE_API_URL}/?cashier_name=${encodeURIComponent(username)}&date=${selectedDate}`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        
        // Parse the selected date for comparison
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        
        // Format and filter based on product type AND date match
        const formattedData = data
          .map(entry => {
            const loggedDate = new Date(entry.logged_at);
            return {
              id: entry.spillage_id,
              timestamp: loggedDate.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }),
              rawDate: loggedDate, // Keep raw date for filtering
              category: entry.category,
              productName: entry.product_name,
              quantity: entry.quantity,
              reason: entry.reason,
              loggedBy: entry.logged_by || '-'
            };
          })
          .filter(entry => {
            // First check: date must match selectedDate
            const entryDate = new Date(entry.rawDate);
            entryDate.setHours(0, 0, 0, 0);
            
            const dateMatches = entryDate.getTime() === selectedDateObj.getTime();
            
            if (!dateMatches) {
              return false; // Skip if date doesn't match
            }
            
            // Second check: Apply product type filter
            if (productTypeFilter === 'All') {
              return true;
            } else if (productTypeFilter === 'Merchandise') {
              return entry.category === 'Merchandise';
            } else if (productTypeFilter === 'Products') {
              return entry.category !== 'Merchandise';
            }
            return true;
          })
          .map(entry => {
            // Remove rawDate before setting state (we don't need it in the display)
            const { rawDate, ...displayEntry } = entry;
            return displayEntry;
          });

        setSpillageEntries(formattedData);
      } catch (error) {
        setSpillageError(error.message);
      } finally {
        setIsSpillageLoading(false);
      }
    };

    // Fetch data based on active tab
    if (activeTab === 'summary') {
      fetchSalesMetricsByDate();
      fetchCancelledOrders();
      fetchTopProducts();
      fetchSpillageData();
    }
    
    if (activeTab === 'cash') {
      fetchSessionData();
      fetchSessionSalesMetrics();
      
      const interval = setInterval(() => {
        fetchSessionSalesMetrics();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab, orderTypeFilter, productTypeFilter, selectedDate]);

  const today = new Date();
  const formattedDate = date || today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayString = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0];
  
  const salesMetrics = [
    { title: 'Total Sales', key: 'totalSales', format: 'currency', icon: faCashRegister, isLoading: isSalesLoading, error: salesError },
    { title: 'Cash Sales', key: 'cashSales', format: 'currency', icon: faMoneyBillWave, isLoading: isSalesLoading, error: salesError },
    { title: 'GCash Sales', key: 'gcashSales', format: 'currency', icon: faCoins, isLoading: isSalesLoading, error: salesError },
    { title: 'Items Sold', key: 'itemsSold', format: 'number', icon: faShoppingCart, isLoading: isSalesLoading, error: salesError },
  ];

  const denominations = [
    { key: 'bills1000', label: '₱1000 Bills', value: 1000 }, { key: 'bills500', label: '₱500 Bills', value: 500 },
    { key: 'bills200', label: '₱200 Bills', value: 200 }, { key: 'bills100', label: '₱100 Bills', value: 100 },
    { key: 'bills50', label: '₱50 Bills', value: 50 }, { key: 'bills20', label: '₱20 Bills', value: 20 },
    { key: 'coins10', label: '₱10 Coins', value: 10 }, { key: 'coins5', label: '₱5 Coins', value: 5 },
    { key: 'coins1', label: '₱1 Coins', value: 1 }, { key: 'cents25', label: '25¢ Coins', value: 0.25 },
    { key: 'cents10', label: '10¢ Coins', value: 0.10 }, { key: 'cents05', label: '5¢ Coins', value: 0.05 }
  ];

  const cancelledProductsColumns = [
    { name: "TIME", selector: (row) => row.time, sortable: true, width: "18%" },
    { name: "PRODUCT", selector: (row) => row.product, sortable: true, width: "32%" },
    { name: "STATUS", selector: (row) => row.status, sortable: true, width: "18%", cell: (row) => <span style={{ fontWeight: "500" }}>{row.status}</span> },
    { name: "QTY", selector: (row) => row.qty, center: "true", sortable: true, width: "8%" },
    { name: "VALUE", selector: (row) => `₱${row.value}`, center: "true", sortable: true, width: "24%" }
  ];

  const topProductsColumns = [
    { name: "RANK", selector: (row, index) => `#${index + 1}`, width: "15%", center: "true" },
    { name: "PRODUCT NAME", selector: (row) => row.name, sortable: true, width: "60%" },
    { name: "QUANTITY SOLD", selector: (row) => row.sales, center: "true", sortable: true, width: "25%" }
  ];

  const spillageColumns = [
    { name: "TIME", selector: (row) => row.timestamp, sortable: true, width: "18%" },
    { name: "PRODUCT", selector: (row) => row.productName, sortable: true, width: "25%" },
    { name: "CATEGORY", selector: (row) => row.category || '-', sortable: true, width: "15%" },
    { name: "QTY", selector: (row) => row.quantity, center: "true", sortable: true, width: "10%" },
    { name: "REASON", selector: (row) => row.reason, wrap: true, width: "17%" },
    { name: "LOGGED BY", selector: (row) => row.loggedBy, sortable: true, width: "15%" }
  ];

  const modalCancelledColumns = [...cancelledProductsColumns];
  const customTableStyles = {
    headCells: { style: { fontWeight: "600", fontSize: "14px", padding: "12px", textTransform: "uppercase", textAlign: "center", letterSpacing: "1px" } },
    rows: { style: { minHeight: "55px", padding: "5px", cursor: "pointer" } },
  };

  const limitedCancelledProducts = useMemo(() => cancelledOrders.slice(0, 5), [cancelledOrders]);

  const actualCashCounted = useMemo(() => {
    return denominations.reduce((total, denom) => total + ((cashCounts[denom.key] || 0) * denom.value), 0);
  }, [cashCounts]);

  const expectedCashInSession = initialCash + sessionSalesData.cashSales;
  const discrepancyInSession = actualCashCounted - expectedCashInSession;
  const hasDiscrepancyInSession = Math.abs(discrepancyInSession) > 0.01;

  const formatMetricValue = (val, format) => format === 'currency' ? `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val.toLocaleString();
  const handleCashCountChange = (denomination, value) => { const numValue = Math.max(0, parseInt(value) || 0); setCashCounts(prev => ({ ...prev, [denomination]: numValue })); };
  const openModal = (type) => setModalType(type);
  const closeModal = () => setModalType(null);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    if (tab === 'cash') {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('authToken');
      
      if (token && username) {
        setIsSessionSalesLoading(true);
        fetch(`${SALES_METRICS_API_URL}/current_session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({
            cashierName: username,
            orderType: orderTypeFilter,
            productType: productTypeFilter
          })
        })
        .then(response => {
          if (!response.ok) throw new Error("Failed to fetch session sales.");
          return response.json();
        })
        .then(data => {
          setSessionSalesData(data);
          setSessionSalesError(null);
        })
        .catch(err => {
          setSessionSalesError(err.message);
        })
        .finally(() => {
          setIsSessionSalesLoading(false);
        });
      }
    }
  };

  const handleConfirmCount = () => {
    if (!activeSessionId) { 
      alert("Error: No active session found to close."); 
      return; 
    }
    setEnteredPin("");
    setPinError("");
    setPinModalType('confirm');
    setShowPinModal(true);
  };

  const handleReportDiscrepancy = () => {
    if (!activeSessionId) { 
      alert("Error: No active session found."); 
      return; 
    }
    setEnteredPin("");
    setPinError("");
    setPinModalType('discrepancy');
    setShowPinModal(true);
  };

  const confirmPinAction = async () => {
    if (!enteredPin || enteredPin.length < 4) {
      setPinError("Please enter a valid PIN.");
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('authToken');

    try {
      if (pinModalType === 'confirm') {
        const response = await fetch(`${CASH_TALLY_API_URL}/close_session`, {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            sessionId: activeSessionId, 
            cashCounts: cashCounts,
            pin: enteredPin
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.detail || "Failed to close the session.");
        }

        alert(`Session closed successfully! Verified by: ${data.checkedBy}`);
        setShowPinModal(false);
        setActiveSessionId(null);
        setError(`Session ${data.sessionId} has been closed.`);

      } else if (pinModalType === 'discrepancy') {
        const response = await fetch(`${CASH_TALLY_API_URL}/report_discrepancy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionId: activeSessionId,
            discrepancyAmount: discrepancyInSession,
            reportedBy: loggedInUser,
            pin: enteredPin,
            cashCounts: cashCounts
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to report discrepancy.");
        }

        alert(`Discrepancy of ₱${Math.abs(discrepancyInSession).toFixed(2)} has been reported and session closed.\nVerified by: ${data.checkedBy}\nClosing Cash: ₱${data.closingCash.toFixed(2)}\nCash Sales: ₱${data.cashSalesAtClose.toFixed(2)}`);
        setShowPinModal(false);
        setActiveSessionId(null);
        setError(`Session ${data.sessionId} has been closed with discrepancy reported.`);
      }

    } catch (err) {
      setPinError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const renderModal = () => {
    if (!modalType) return null;
    let modalTitle = '';
    let data = [];
    let columns = [];
    const sectionTitles = getSectionTitles();

    switch (modalType) {
      case 'topProducts':
        modalTitle = sectionTitles.topSelling;
        data = topProducts;
        columns = topProductsColumns;
        break;
      case 'cancelledOrders':
        modalTitle = sectionTitles.cancelled;
        data = cancelledOrders;
        columns = modalCancelledColumns;
        break;
      case 'spillage':
        modalTitle = 'Spillage Records';
        data = spillageEntries;
        columns = spillageColumns;
        break;
      default:
        return null;
    }

    return (
      <div className="cashier-modal-overlay" onClick={closeModal}>
        <div className="cashier-modal" onClick={(e) => e.stopPropagation()}>
          <div className="cashier-modal-header">
            <h3>{modalTitle}</h3>
            <button className="cashier-modal-close" onClick={closeModal}>
              ×
            </button>
          </div>
          <div className="cashier-modal-content">
            <div className="cashier-modal-table-container">
              <DataTable
                columns={columns}
                data={data}
                striped
                highlightOnHover
                responsive
                pagination
                fixedHeader
                fixedHeaderScrollHeight="60vh"
                noDataComponent={
                  <div style={{ padding: "24px" }}>
                    No data available for this filter.
                  </div>
                }
                customStyles={customTableStyles}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCashTallyContent = () => {
    if (isLoading) return <div className="cashier-loading-container"><FontAwesomeIcon icon={faSpinner} spin size="3x" /><p>Loading Session Data...</p></div>;
    return (
        <div className="cashier-cash-tally-container">
            <div className="cashier-cash-count-section">
                <div className="cashier-cash-header"><div className="cashier-cash-title"><FontAwesomeIcon icon={faCashRegister} /><h2>Cash Drawer Count</h2></div></div>
                <div className="cashier-cash-table">
                    <div className="cashier-cash-table-header"><span>Denomination</span><span>Count</span><span>Total Value</span></div>
                    {denominations.map((denom) => (<div key={denom.key} className="cashier-cash-row"><span className="cashier-denom-label">{denom.label}</span><div className="cashier-count-input-container"><input type="number" min="0" value={cashCounts[denom.key]} onChange={(e) => handleCashCountChange(denom.key, e.target.value)} className="cashier-count-input" disabled={!activeSessionId || isSubmitting} /></div><span className="cashier-total-value">₱{(cashCounts[denom.key] * denom.value).toFixed(2)}</span></div>))}
                </div>
            </div>
            <div className="cashier-cash-summary-section">
                <div className="cashier-cash-summary-card">
                    <div className="cashier-summary-header"><FontAwesomeIcon icon={faCoins} /><h3>Cash Summary (Current Session)</h3></div>
                    {error && !error.includes("No active session") && <div className="cashier-summary-error">{error}</div>}
                    <div className="cashier-summary-row"><span>Initial Cash</span><span className="cashier-initial-amount">₱{initialCash.toFixed(2)}</span></div>
                    <div className="cashier-summary-row"><span>Cash Sales (This Session)</span>{isSessionSalesLoading ? <FontAwesomeIcon icon={faSpinner} spin/> : <span className="cashier-sales-amount">₱{sessionSalesData.cashSales.toFixed(2)}</span>}</div>
                    <div className="cashier-summary-row"><span>Expected Cash</span><span className="cashier-expected-amount">₱{expectedCashInSession.toFixed(2)}</span></div>
                    <div className="cashier-summary-row"><span>Actual Cash (Counted)</span><span className="cashier-actual-amount">₱{actualCashCounted.toFixed(2)}</span></div>
                    <div className={`cashier-summary-row cashier-discrepancy ${hasDiscrepancyInSession ? 'has-discrepancy' : 'no-discrepancy'}`}><span className="cashier-discrepancy-label"><FontAwesomeIcon icon={hasDiscrepancyInSession ? faExclamationTriangle : faCheckCircle} />Discrepancy</span><span className={`cashier-discrepancy-amount ${discrepancyInSession > 0 ? 'positive' : discrepancyInSession < 0 ? 'negative' : 'zero'}`}>{discrepancyInSession >= 0 ? '+' : ''}₱{discrepancyInSession.toFixed(2)}</span></div>
                    
                    {/* --- MODIFIED BUTTON LOGIC --- */}
                    <div className="cashier-action-buttons">
                        {hasDiscrepancyInSession && (
                            <button 
                                className="cashier-report-btn" 
                                onClick={handleReportDiscrepancy} 
                                disabled={!activeSessionId || isSubmitting}>
                                <FontAwesomeIcon icon={faExclamationTriangle} /> Report Discrepancy
                            </button>
                        )}
                        <button 
                            className="cashier-confirm-btn" 
                            onClick={handleConfirmCount} 
                            disabled={!activeSessionId || isSubmitting || hasDiscrepancyInSession}>
                            <FontAwesomeIcon icon={isSubmitting ? faSpinner : faCheckCircle} spin={isSubmitting} /> 
                            {isSubmitting ? 'Submitting...' : 'Confirm Count'}
                        </button>
                    </div>
                    {/* --- END OF MODIFICATION --- */}

                </div>
                {error && <div className="cashier-summary-info">{error}</div>}
            </div>
        </div>
    );
  };

  const renderCancelledProductsContent = () => {
    if (isCancelledLoading) return <div className="cashier-loading-container" style={{ minHeight: '150px' }}><FontAwesomeIcon icon={faSpinner} spin size="2x" /><p>Loading Cancelled/Refunded Orders...</p></div>;
    if (cancelledError) return <div className="cashier-error-container"><FontAwesomeIcon icon={faExclamationTriangle} /><p>Error: {cancelledError}</p></div>;
    return <DataTable columns={cancelledProductsColumns} data={limitedCancelledProducts} striped highlightOnHover responsive noDataComponent={<div style={{ padding: "24px" }}>No cancelled or refunded products for this filter.</div>} customStyles={customTableStyles} pagination={false} />;
  };

  const renderTopProductsContent = () => {
    if (isTopProductsLoading) {
      return (
        <div
          className="cashier-loading-container"
          style={{
            minHeight: "200px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
        </div>
      );
    }
    if (topProductsError) {
      return (
        <div className="cashier-error-container" style={{ padding: "24px" }}>
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <p>Could not load top products.</p>
        </div>
      );
    }
    if (topProducts.length === 0) {
      return (
        <div style={{ padding: "24px", textAlign: "center" }}>
          No sales recorded for this filter.
        </div>
      );
    }

    return topProducts.slice(0, 7).map((product, idx) => (
      <div key={idx} className="cashier-top-product-bar">
        <div className="cashier-product-header">
          <div className={`cashier-rank-badge rank-${idx + 1}`}>{idx + 1}</div>
          <span className="cashier-product-name">{product.name}</span>
          <span className="cashier-product-sales">{product.sales} sold</span>
        </div>
        <div className="cashier-product-bar">
          <div
            style={{
              width: `${(product.sales / topProducts[0].sales) * 100}%`,
            }}
          />
        </div>
      </div>
    ));
  };

  const renderSpillageContent = () => {
    if (isSpillageLoading) {
      return (
        <div className="cashier-loading-container" style={{ minHeight: '150px' }}>
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          <p>Loading Spillage Data...</p>
        </div>
      );
    }
    if (spillageError) {
      return (
        <div className="cashier-error-container">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <p>Error: {spillageError}</p>
        </div>
      );
    }

    const limitedSpillage = spillageEntries.slice(0, 5);

    return (
      <DataTable
        columns={spillageColumns}
        data={limitedSpillage}
        striped
        highlightOnHover
        responsive
        noDataComponent={
          <div style={{ padding: "24px" }}>No spillage entries found.</div>
        }
        customStyles={customTableStyles}
        pagination={false}
      />
    );
  };

  // Get the current section titles based on filter
  const sectionTitles = getSectionTitles();

  return (
    <div className="cashier-sales">
      <Navbar user={loggedInUser} />
      <div className="cashier-sales-container">
        <div className="cashier-tabs-header-row">
          <div className="cashier-sales-tabs">
            <button className={`cashier-sales-tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
            <button className={`cashier-sales-tab ${activeTab === 'cash' ? 'active' : ''}`} onClick={() => setActiveTab('cash')}>Cash Tally</button>
          </div>
          {activeTab === 'summary' && (
            <div className="cashier-sales-header">
              <div className="cashier-filter-item">
                <span>Order Type:</span>
                <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)} className="cashier-filter-select">
                  <option value="All">All</option>
                  <option value="Store">In Store</option>
                  <option value="Online">Online</option>
                </select>
              </div>
              <div className="cashier-filter-item">
                <span>Product Type:</span>
                <select value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)} className="cashier-filter-select">
                  <option value="All">All</option>
                  <option value="Products">Products</option>
                  <option value="Merchandise">Merchandise</option>
                </select>
              </div>
              <div className="cashier-filter-item">
                <span>Date:</span>
                <input type="date" value={selectedDate} onChange={handleDateChange} max={todayString} className="cashier-date-input" />
              </div>

            </div>
          )}
        </div>
        {activeTab === 'summary' && (
          <div className="cashier-sales-summary">
            <div className="cashier-sales-main">
              <div className="cashier-sales-metrics">
                {salesMetrics.map((metric, index) => (
                  <div key={index} className="cashier-sales-card">
                    <div className="cashier-sales-icon"><FontAwesomeIcon icon={metric.icon} /></div>
                    <div className="cashier-sales-info">
                      <div className="cashier-sales-title">{metric.title}</div>
                      {metric.isLoading ? (<div className="cashier-sales-value"><FontAwesomeIcon icon={faSpinner} spin /></div>) : metric.error ? (<div className="cashier-sales-error">Failed</div>) : (<div className="cashier-sales-value">{formatMetricValue(salesData[metric.key], metric.format)}</div>)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom sections container with split layout */}
              <div className="cashier-bottom-sections">
                <div className="cashier-cancelled-section">
                  <div className="cashier-section-header">
                    <h3>{sectionTitles.cancelled}</h3>
                    <button className="cashier-view-all-btn" onClick={() => openModal('cancelledOrders')}>View All</button>
                  </div>
                  <div className="cashier-cancelled-table-container">
                    {renderCancelledProductsContent()}
                  </div>
                </div>

                <div className="cashier-spillage-section">
                  <div className="cashier-section-header">
                    <h3>Spillage Records</h3>
                    <button className="cashier-view-all-btn" onClick={() => openModal('spillage')}>View All</button>
                  </div>
                  <div className="cashier-spillage-table-container">
                    {renderSpillageContent()}
                  </div>
                </div>
              </div>
            </div>

            <div className="cashier-sales-side">
              <div className="cashier-section-header">
                <h3>{sectionTitles.topSelling}</h3>
                <button className="cashier-view-all-btn" onClick={() => openModal('topProducts')}>View All</button>
              </div>
              <div className="cashier-top-products">
                {renderTopProductsContent()}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'cash' && (
          <div className="cashier-cash-tally">
            {renderCashTallyContent()}
          </div>
        )}
      </div>
      {renderModal()}

      {/* PIN Modal for Confirm Count and Report Discrepancy */}
      {showPinModal && (
        <div className="orderpanel-modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="orderpanel-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="orderpanel-modal-header">
              <h3 className="orderpanel-modal-title">Manager PIN Required</h3>
              <button className="orderpanel-close-modal" onClick={() => setShowPinModal(false)}>×</button>
            </div>
            <div className="orderpanel-modal-body">
              <p className="orderpanel-modal-description">
                {pinModalType === 'confirm' 
                  ? 'Please ask a manager to enter their PIN to confirm and close this session.'
                  : 'Please ask a manager to enter their PIN to report this discrepancy and close the session.'}
              </p>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="orderpanel-modal-input"
                placeholder="Enter Manager PIN"
                value={enteredPin}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value)) {
                    setEnteredPin(value);
                    setPinError("");
                  }
                }}
                autoFocus
              />
              {pinError && <p className="orderpanel-modal-error">{pinError}</p>}
            </div>
            <div className="orderpanel-modal-footer">
              <button 
                className="orderpanel-modal-btn orderpanel-modal-cancel" 
                onClick={() => setShowPinModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                className="orderpanel-modal-btn orderpanel-modal-confirm" 
                onClick={confirmPinAction}
                disabled={isSubmitting || enteredPin.length < 4}
              >
                {isSubmitting ? "Verifying..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CashierSales;