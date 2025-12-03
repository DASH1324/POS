import React, { useState, useEffect } from "react";
import "./dashboard.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import Loading from "../shared/loading";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillWave, faChartLine, faShoppingCart, faClock, faArrowTrendUp, faArrowTrendDown,
  faExclamationTriangle, faTimesCircle, faBoxes, faUndo, faUsers
} from '@fortawesome/free-solid-svg-icons';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:9000';

const formatValue = (value, format) => {
  return format === "currency"
    ? `₱${value.toLocaleString()}`
    : value.toLocaleString();
};

const Dashboard = () => {
  const [revenueFilter, setRevenueFilter] = useState("Monthly");
  const [bestSellingFilter, setBestSellingFilter] = useState("Last 30 Days");
  const [shiftPerformanceFilter, setShiftPerformanceFilter] = useState("Today");
  const [totalSalesFilter, setTotalSalesFilter] = useState("Today");
  const [bestProductFilter, setBestProductFilter] = useState("Today");
  const [completedOrdersFilter, setCompletedOrdersFilter] = useState("Today");
  const [canceledOrdersFilter, setCanceledOrdersFilter] = useState("By Cashier");
  const [activeOrdersFilter, setActiveOrdersFilter] = useState("Real-time");
  const [spillageFilter, setSpillageFilter] = useState("By Product Type");
  const [userRole, setUserRole] = useState('');
  
  // Granular loading states for each section
  const [loadingStates, setLoadingStates] = useState({
    initial: true,
    totalSales: false,
    bestProduct: false,
    revenue: false,
    bestSelling: false,
    shiftPerformance: false,
    spillage: false,
    activeOrders: false,
    completedOrders: false,
    canceledOrders: false
  });

  // Data states
  const [summaryCardsData, setSummaryCardsData] = useState({});
  const [revenueData, setRevenueData] = useState([]);
  const [bestSellingItemsData, setBestSellingItemsData] = useState([]);
  const [shiftPerformanceData, setShiftPerformanceData] = useState([]);
  const [activeOrdersData, setActiveOrdersData] = useState([]);
  const [completedOrdersData, setCompletedOrdersData] = useState([]);
  const [canceledOrdersData, setCanceledOrdersData] = useState([]);
  const [spillageData, setSpillageData] = useState({ cost: 0, incidents: 0, target: 0, items: [] });

  // Helper to update loading state
  const setLoading = (key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  // Fetch API with error handling
  const fetchAPI = async (endpoint, params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
      
      const authToken = localStorage.getItem('authToken');
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      return null;
    }
  };

  // Initialize user role
  useEffect(() => {
    let roleToSet = '';
    
    const searchParams = new URLSearchParams(window.location.search);
    const roleFromUrl = searchParams.get('userRole');

    if (roleFromUrl) {
      roleToSet = roleFromUrl;
      localStorage.setItem('userRole', roleFromUrl);
    } else {
      const roleFromStorage = localStorage.getItem('userRole');
      if (roleFromStorage) {
        roleToSet = roleFromStorage;
      }
    }

    if (roleToSet) {
      setUserRole(roleToSet);
    } else {
      setUserRole('guest');
    }
  }, []);

  // Individual fetch functions for each section
  const fetchTotalSales = async () => {
    setLoading('totalSales', true);
    const data = await fetchAPI('/api/dashboard/admin/total-sales', { filter: totalSalesFilter });
    setSummaryCardsData(prev => ({
      ...prev,
      totalSales: data || { current: 0, previous: 0 }
    }));
    setLoading('totalSales', false);
  };

  const fetchBestProduct = async () => {
    setLoading('bestProduct', true);
    const data = await fetchAPI('/api/dashboard/admin/best-selling-product', { filter: bestProductFilter });
    setSummaryCardsData(prev => ({
      ...prev,
      bestProduct: data || { current: 0, previous: 0, subtext: 'N/A' }
    }));
    setLoading('bestProduct', false);
  };

  const fetchRevenue = async () => {
    setLoading('revenue', true);
    const data = await fetchAPI('/api/dashboard/admin/sales-overview', { filter: revenueFilter });
    setRevenueData(data || []);
    setLoading('revenue', false);
  };

  const fetchBestSelling = async () => {
    setLoading('bestSelling', true);
    const data = await fetchAPI('/api/dashboard/admin/best-selling-items', { filter: bestSellingFilter });
    setBestSellingItemsData(data || []);
    setLoading('bestSelling', false);
  };

  const fetchShiftPerformance = async () => {
    setLoading('shiftPerformance', true);
    const data = await fetchAPI('/api/dashboard/admin/shift-performance', { filter: shiftPerformanceFilter });
    setShiftPerformanceData(data || []);
    setLoading('shiftPerformance', false);
  };

  const fetchSpillage = async () => {
    setLoading('spillage', true);
    const data = await fetchAPI('/api/dashboard/manager/spillage-overview', { filter: spillageFilter });
    setSpillageData(data || { cost: 0, incidents: 0, target: 0, items: [] });
    setLoading('spillage', false);
  };

  const fetchActiveOrders = async () => {
    setLoading('activeOrders', true);
    const data = await fetchAPI('/api/dashboard/manager/active-orders-monitor', { filter: activeOrdersFilter });
    setActiveOrdersData(data || []);
    setLoading('activeOrders', false);
  };

  const fetchCompletedOrders = async () => {
    setLoading('completedOrders', true);
    const data = await fetchAPI('/api/dashboard/manager/completed-orders-peak', { filter: completedOrdersFilter });
    setCompletedOrdersData(data || []);
    setLoading('completedOrders', false);
  };

  const fetchCanceledOrders = async () => {
    setLoading('canceledOrders', true);
    const data = await fetchAPI('/api/dashboard/manager/canceled-orders-analysis', { filter: canceledOrdersFilter });
    setCanceledOrdersData(data || []);
    setLoading('canceledOrders', false);
  };

  // Initial data load
  const fetchInitialAdminData = async () => {
    setLoading('initial', true);
    try {
      const [totalSales, cashVariance, bestProduct, refunds, revenue, bestSelling, shiftPerf] = await Promise.all([
        fetchAPI('/api/dashboard/admin/total-sales', { filter: totalSalesFilter }),
        fetchAPI('/api/dashboard/admin/cash-variance'),
        fetchAPI('/api/dashboard/admin/best-selling-product', { filter: bestProductFilter }),
        fetchAPI('/api/dashboard/admin/total-refunds'),
        fetchAPI('/api/dashboard/admin/sales-overview', { filter: revenueFilter }),
        fetchAPI('/api/dashboard/admin/best-selling-items', { filter: bestSellingFilter }),
        fetchAPI('/api/dashboard/admin/shift-performance', { filter: shiftPerformanceFilter })
      ]);

      setSummaryCardsData({
        totalSales: totalSales || { current: 0, previous: 0 },
        cashVariance: cashVariance || { current: 0, previous: 0 },
        bestProduct: bestProduct || { current: 0, previous: 0, subtext: 'N/A' },
        refunds: refunds || { current: 0, previous: 0, subtext: '0% of total sales' }
      });

      setRevenueData(revenue || []);
      setBestSellingItemsData(bestSelling || []);
      setShiftPerformanceData(shiftPerf || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
    setLoading('initial', false);
  };

  const fetchInitialManagerData = async () => {
    setLoading('initial', true);
    try {
      const [activeOrders, completedOrders, canceledOrders, spillageCost, spillage, activeOrdersMonitor, completedPeak, canceledAnalysis] = await Promise.all([
        fetchAPI('/api/dashboard/manager/active-orders'),
        fetchAPI('/api/dashboard/manager/completed-orders'),
        fetchAPI('/api/dashboard/manager/canceled-orders'),
        fetchAPI('/api/dashboard/manager/spillage-cost'),
        fetchAPI('/api/dashboard/manager/spillage-overview', { filter: spillageFilter }),
        fetchAPI('/api/dashboard/manager/active-orders-monitor', { filter: activeOrdersFilter }),
        fetchAPI('/api/dashboard/manager/completed-orders-peak', { filter: completedOrdersFilter }),
        fetchAPI('/api/dashboard/manager/canceled-orders-analysis', { filter: canceledOrdersFilter })
      ]);

      setSummaryCardsData({
        activeOrders: activeOrders || { current: 0, previous: 0 },
        completedOrders: completedOrders || { current: 0, previous: 0 },
        canceledOrders: canceledOrders || { current: 0, previous: 0 },
        spillageCost: spillageCost || { current: 0, previous: 0, subtext: '0 incidents today' }
      });

      setSpillageData(spillage || { cost: 0, incidents: 0, target: 0, items: [] });
      setActiveOrdersData(activeOrdersMonitor || []);
      setCompletedOrdersData(completedPeak || []);
      setCanceledOrdersData(canceledAnalysis || []);
    } catch (error) {
      console.error('Error fetching manager data:', error);
    }
    setLoading('initial', false);
  };

  // Initial load on role change
  useEffect(() => {
    if (!userRole || userRole === 'guest') return;

    if (userRole === 'admin') {
      fetchInitialAdminData();
    } else if (userRole === 'manager') {
      fetchInitialManagerData();
    }
  }, [userRole]);

  // Individual filter effects - only reload affected section
  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'admin') fetchTotalSales();
  }, [totalSalesFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'admin') fetchBestProduct();
  }, [bestProductFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'admin') fetchRevenue();
  }, [revenueFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'admin') fetchBestSelling();
  }, [bestSellingFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'admin') fetchShiftPerformance();
  }, [shiftPerformanceFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'manager') fetchSpillage();
  }, [spillageFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'manager') fetchActiveOrders();
  }, [activeOrdersFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'manager') fetchCompletedOrders();
  }, [completedOrdersFilter]);

  useEffect(() => {
    if (!userRole || userRole === 'guest' || loadingStates.initial) return;
    if (userRole === 'manager') fetchCanceledOrders();
  }, [canceledOrdersFilter]);

  const getSummaryCards = () => {
    if (userRole === 'admin') {
      const salesData = summaryCardsData.totalSales || { current: 0, previous: 0 };
      const cashData = summaryCardsData.cashVariance || { current: 0, previous: 0 };
      const productData = summaryCardsData.bestProduct || { current: 0, previous: 0, subtext: 'N/A' };
      const refundsData = summaryCardsData.refunds || { current: 0, previous: 0, subtext: '0% of total sales' };

      return [
        {
          title: `Total Sales (${totalSalesFilter})`,
          current: salesData.current,
          previous: salesData.previous,
          format: "currency",
          icon: faMoneyBillWave,
          type: "posDashboardSales",
          hasFilter: true,
          filterValue: totalSalesFilter,
          onFilterChange: setTotalSalesFilter,
          filterOptions: ['Today', 'Yesterday', 'This Week', 'This Month'],
          isLoading: loadingStates.totalSales
        },
        {
          title: "Cash Drawer Variance",
          current: cashData.current,
          previous: cashData.previous,
          format: "currency",
          icon: faMoneyBillWave,
          type: "posDashboardCashVariance",
          subtext: cashData.subtext || "Across all shifts"
        },
        {
          title: "Best-Selling Product",
          current: productData.current,
          previous: productData.previous,
          format: "number",
          icon: faChartLine,
          type: "posDashboardBestSelling",
          subtext: productData.subtext,
          isLoading: loadingStates.bestProduct
        },
        {
          title: "Total Refunds",
          current: refundsData.current,
          previous: refundsData.previous,
          format: "number",
          icon: faUndo,
          type: "posDashboardRefunds",
          subtext: refundsData.subtext
        }
      ];
    } else if (userRole === 'manager') {
      const activeData = summaryCardsData.activeOrders || { current: 0, previous: 0 };
      const completedData = summaryCardsData.completedOrders || { current: 0, previous: 0 };
      const canceledData = summaryCardsData.canceledOrders || { current: 0, previous: 0 };
      const spillageDataCard = summaryCardsData.spillageCost || { current: 0, previous: 0, subtext: '0 incidents today' };

      return [
        {
          title: "Active Orders",
          current: activeData.current,
          previous: activeData.previous,
          format: "number",
          icon: faClock,
          type: "posDashboardActiveOrders",
          subtext: activeData.subtext || "Real-time count"
        },
        {
          title: "Completed Orders",
          current: completedData.current,
          previous: completedData.previous,
          format: "number",
          icon: faShoppingCart,
          type: "posDashboardOrders",
          subtext: completedData.subtext || "Daily total"
        },
        {
          title: "Canceled Orders",
          current: canceledData.current,
          previous: canceledData.previous,
          format: "number",
          icon: faTimesCircle,
          type: "posDashboardCanceled",
          subtext: canceledData.subtext || "Today's cancellations"
        },
        {
          title: "Spillage Cost",
          current: spillageDataCard.current,
          previous: spillageDataCard.previous,
          format: "currency",
          icon: faExclamationTriangle,
          type: "posDashboardSpillage",
          subtext: spillageDataCard.subtext
        }
      ];
    }
    return [];
  };

  const summaryCards = getSummaryCards();

  // Render loading spinner for a specific chart
  const ChartLoader = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 350 }}>
      <div style={{ fontSize: '14px', color: '#999' }}>Loading...</div>
    </div>
  );

  return (
    <div className="posDashboard">
      <Sidebar key={userRole} />
      <main className="posDashboardMain">
        <Header key={userRole} pageTitle={`Dashboard`} />

        {loadingStates.initial ? (
          <Loading />
        ) : (
          <div className="posDashboardContents">
            <div className="posDashboardCards">
              {summaryCards.map((card, index) => {
                const { current, previous } = card;
                const diff = current - previous;
                const percent = previous !== 0 ? (diff / previous) * 100 : 0;
                const isImproved = current > previous;
                const hasChange = current !== previous;

                return (
                  <div key={index} className={`posDashboardCard ${card.type}`} style={{ opacity: card.isLoading ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                    <div className="posDashboardCardText">
                      <div className="posDashboardCardTitleRow">
                        <div className="posDashboardCardTitle">
                          {card.hasFilter ? card.title.split(' (')[0] : card.title}
                        </div>
                      </div>
                      <div className="posDashboardCardDetails">
                        <div className="posDashboardCardValue">
                          {card.isLoading ? '...' : formatValue(current, card.format)}
                        </div>
                        {hasChange && !card.isLoading && (
                          <div className={`posDashboardCardPercent ${isImproved ? 'posDashboardGreen' : 'posDashboardRed'}`}>
                            <FontAwesomeIcon icon={isImproved ? faArrowTrendUp : faArrowTrendDown} />
                            {` `}{Math.abs(percent).toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {card.subtext && (
                        <div className="posDashboardCardSubtext">{card.subtext}</div>
                      )}
                    </div>
                    <div className="posDashboardCardIcon">
                      <FontAwesomeIcon icon={card.icon} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="posDashboardCharts">
              {userRole === 'manager' && (
                <>
                  <div className="posDashboardOverviewRow">
                    <div className="posDashboardChartBox posDashboardSpillageBox" style={{ opacity: loadingStates.spillage ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                      <div className="posDashboardChartHeader">
                        <span>Spillage Overview</span>
                        <select
                          className="posDashboardChartDropdown"
                          value={spillageFilter}
                          onChange={(e) => setSpillageFilter(e.target.value)}
                          disabled={loadingStates.spillage}
                        >
                          <option value="By Product Type">By Product Type</option>
                          <option value="By Cashier/Shift">By Cashier/Shift</option>
                          <option value="By Incident Reason">By Incident Reason</option>
                        </select>
                      </div>
                      {loadingStates.spillage ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                          <div style={{ fontSize: '14px', color: '#999' }}>Loading...</div>
                        </div>
                      ) : (
                        <div className="posDashboardSpillageContent">
                          <div className="posDashboardSpillageStats">
                            <div className="posDashboardSpillageStat">
                              <div className="posDashboardSpillageLabel">Total Cost Today</div>
                              <div className="posDashboardSpillageValue">₱{spillageData.cost.toLocaleString()}</div>
                            </div>
                            <div className="posDashboardSpillageStat">
                              <div className="posDashboardSpillageLabel">Incidents</div>
                              <div className="posDashboardSpillageValue">{spillageData.incidents}</div>
                            </div>
                            <div className="posDashboardSpillageStat">
                              <div className="posDashboardSpillageLabel">vs Target</div>
                              <div className={`posDashboardSpillageValue ${spillageData.target >= 0 ? 'posDashboardGreen' : 'posDashboardRed'}`}>
                                {spillageData.target}%
                              </div>
                            </div>
                          </div>
                          <div className="posDashboardSpillageRing">
                            <svg width="200" height="200" viewBox="0 0 200 200">
                              <circle cx="100" cy="100" r="80" fill="none" stroke="#e9ecef" strokeWidth="20"/>
                              <circle 
                                cx="100" 
                                cy="100" 
                                r="80" 
                                fill="none" 
                                stroke="#dc3545" 
                                strokeWidth="20"
                                strokeDasharray="502.4"
                                strokeDashoffset={502.4 * (1 - Math.min(spillageData.cost / 3000, 1))}
                                strokeLinecap="round"
                                transform="rotate(-90 100 100)"
                              />
                              <text x="100" y="95" textAnchor="middle" fontSize="32" fontWeight="bold" fill="#333">
                                {Math.round((spillageData.cost / 3000) * 100)}%
                              </text>
                              <text x="100" y="120" textAnchor="middle" fontSize="14" fill="#666">of budget</text>
                            </svg>
                          </div>
                          <div className="posDashboardSpillageBreakdown">
                            <div className="posDashboardSpillageBreakdownTitle">Breakdown</div>
                            {spillageData.items.length > 0 ? (
                              spillageData.items.map((item, idx) => (
                                <div key={idx} className="posDashboardSpillageItem">
                                  <span className="posDashboardSpillageItemName">{item.name}</span>
                                  <span className="posDashboardSpillageItemValue">
                                    ₱{item.cost.toLocaleString()} ({item.incidents} {item.incidents === 1 ? 'incident' : 'incidents'})
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                                No spillage incidents today
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="posDashboardChartBox" style={{ opacity: loadingStates.activeOrders ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                      <div className="posDashboardChartHeader">
                        <span>Active Orders Monitor</span>
                        <select
                          className="posDashboardChartDropdown"
                          value={activeOrdersFilter}
                          onChange={(e) => setActiveOrdersFilter(e.target.value)}
                          disabled={loadingStates.activeOrders}
                        >
                          <option value="Real-time">Real-time</option>
                          <option value="Last 4 Hours">Last 4 Hours</option>
                          <option value="Full Day">Full Day</option>
                        </select>
                      </div>
                      {loadingStates.activeOrders ? (
                        <ChartLoader />
                      ) : (
                        <ResponsiveContainer width="100%" height={350}>
                          <AreaChart data={activeOrdersData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Area type="monotone" dataKey="pending" stackId="1" stroke="#ffc107" fill="#ffc107" name="Pending" />
                            <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#fd7e14" fill="#fd7e14" name="In Progress" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="posDashboardOrdersRow">
                    <div className="posDashboardChartBox" style={{ opacity: loadingStates.completedOrders ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                      <div className="posDashboardChartHeader">
                        <span>Completed Orders - Peak Hours</span>
                        <select
                          className="posDashboardChartDropdown"
                          value={completedOrdersFilter}
                          onChange={(e) => setCompletedOrdersFilter(e.target.value)}
                          disabled={loadingStates.completedOrders}
                        >
                          <option value="Today">Today</option>
                          <option value="Average Last 7 Days">Average Last 7 Days</option>
                          <option value="Last Same Day">Last Same Day</option>
                        </select>
                      </div>
                      {loadingStates.completedOrders ? (
                        <ChartLoader />
                      ) : completedOrdersData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={completedOrdersData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="orders" fill="#28a745" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 350, color: '#999' }}>
                          No completed orders for this period
                        </div>
                      )}
                    </div>

                    <div className="posDashboardChartBox" style={{ opacity: loadingStates.canceledOrders ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                      <div className="posDashboardChartHeader">
                        <span>Canceled Orders Analysis</span>
                        <select
                          className="posDashboardChartDropdown"
                          value={canceledOrdersFilter}
                          onChange={(e) => setCanceledOrdersFilter(e.target.value)}
                          disabled={loadingStates.canceledOrders}
                        >
                          <option value="By Cashier">By Cashier</option>
                          <option value="By Product Category">By Product Category</option>
                          <option value="By Cancellation Reason">By Cancellation Reason</option>
                        </select>
                      </div>
                      {loadingStates.canceledOrders ? (
                        <ChartLoader />
                      ) : canceledOrdersData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={canceledOrdersData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={120} />
                            <Tooltip />
                            <Bar dataKey="canceled" fill="#e83e8c" name="Canceled Orders" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 350, color: '#999' }}>
                          No canceled orders for this period
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {userRole === 'admin' && (
                <>
                  <div className="posDashboardOverviewRow">
                    <div className="posDashboardChartBox">
                      <div className="posDashboardChartHeader">
                        <span>Sales Overview</span>
                        <select
                          className="posDashboardChartDropdown"
                          value={revenueFilter}
                          onChange={(e) => setRevenueFilter(e.target.value)}
                        >
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                      </div>
                      {revenueData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="income" stroke="#00b4d8" strokeWidth={2} name="Income" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 350, color: '#999' }}>
                          No sales data available for this period
                        </div>
                      )}
                    </div>

                    <div className="posDashboardChartBox">
                      <div className="posDashboardChartHeader">
                        <span>Best-Selling Items</span>
                        <select
                          className="posDashboardChartDropdown"
                          value={bestSellingFilter}
                          onChange={(e) => setBestSellingFilter(e.target.value)}
                        >
                          <option value="Today">Today</option>
                          <option value="Last 7 Days">Last 7 Days</option>
                          <option value="Last 30 Days">Last 30 Days</option>
                          <option value="Last 90 Days">Last 90 Days</option>
                          <option value="All-Time">All-Time</option>
                        </select>
                      </div>
                      {bestSellingItemsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={bestSellingItemsData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={120} />
                            <Tooltip />
                            <Bar dataKey="sales" fill="#00b4d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 350, color: '#999' }}>
                          No sales data available for this period
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="posDashboardChartBox posDashboardShiftBox">
                    <div className="posDashboardChartHeader">
                      <span>Shift Performance</span>
                      <select
                        className="posDashboardChartDropdown"
                        value={shiftPerformanceFilter}
                        onChange={(e) => setShiftPerformanceFilter(e.target.value)}
                      >
                        <option value="Today">Today</option>
                        <option value="Yesterday">Yesterday</option>
                        <option value="This Week">This Week</option>
                        <option value="Last Week">Last Week</option>
                        <option value="This Month">This Month</option>
                      </select>
                    </div>
                    <div className="posDashboardShiftContent">
                      <div className="posDashboardShiftChart">
                        {shiftPerformanceData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={shiftPerformanceData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="cashier" />
                              <YAxis yAxisId="left" orientation="left" stroke="#5b93ff" />
                              <YAxis yAxisId="right" orientation="right" stroke="#a8c5ff" />
                              <Tooltip />
                              <Legend />
                              <Bar yAxisId="left" dataKey="sales" fill="#5b93ff" name="Total Sales" radius={[8, 8, 0, 0]} />
                              <Bar yAxisId="right" dataKey="orders" fill="#a8c5ff" name="Order Count" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#999' }}>
                            No shift data available for this period
                          </div>
                        )}
                      </div>
                      <div className="posDashboardShiftStats">
                        <div className="posDashboardShiftStat">
                          <div className="posDashboardShiftStatLabel">Total Sales</div>
                          <div className="posDashboardShiftStatValue">
                            ₱{shiftPerformanceData.reduce((sum, c) => sum + c.sales, 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="posDashboardShiftStat">
                          <div className="posDashboardShiftStatLabel">Order Count</div>
                          <div className="posDashboardShiftStatValue">
                            {shiftPerformanceData.reduce((sum, c) => sum + c.orders, 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;