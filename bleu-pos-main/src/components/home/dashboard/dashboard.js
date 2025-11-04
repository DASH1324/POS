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
import { jwtDecode } from 'jwt-decode';

// Static data for demonstration purposes
const revenueData = {
  Daily: [
    { name: 'Mon', income: 2500, expense: 1800 },
    { name: 'Tue', income: 2800, expense: 2000 },
    { name: 'Wed', income: 3200, expense: 2200 },
    { name: 'Thu', income: 2900, expense: 1900 },
    { name: 'Fri', income: 3500, expense: 2400 },
    { name: 'Sat', income: 4200, expense: 2800 },
    { name: 'Sun', income: 3800, expense: 2600 },
  ],
  Weekly: [
    { name: 'Week 1', income: 18000, expense: 12000 },
    { name: 'Week 2', income: 22000, expense: 15000 },
    { name: 'Week 3', income: 19500, expense: 13500 },
    { name: 'Week 4', income: 24000, expense: 16000 },
  ],
  Monthly: [
    { name: 'Jan', income: 5000, expense: 3000 },
    { name: 'Feb', income: 14000, expense: 10000 },
    { name: 'Mar', income: 15000, expense: 12000 },
    { name: 'Apr', income: 11000, expense: 9000 },
    { name: 'May', income: 13000, expense: 7000 },
    { name: 'June', income: 18000, expense: 10000 },
    { name: 'July', income: 18000, expense: 13000 },
  ],
  Yearly: [
    { name: '2021', income: 120000, expense: 85000 },
    { name: '2022', income: 145000, expense: 98000 },
    { name: '2023', income: 168000, expense: 112000 },
    { name: '2024', income: 195000, expense: 128000 },
  ]
};

const bestSellingItemsData = {
  'Today': [
    { name: 'Caramel Latte', sales: 45 },
    { name: 'Iced Americano', sales: 38 },
    { name: 'Cappuccino', sales: 32 },
    { name: 'Espresso', sales: 28 },
    { name: 'Mocha', sales: 25 },
  ],
  'Last 7 Days': [
    { name: 'Caramel Latte', sales: 245 },
    { name: 'Iced Americano', sales: 198 },
    { name: 'Cappuccino', sales: 176 },
    { name: 'Espresso', sales: 154 },
    { name: 'Mocha', sales: 132 },
  ],
  'Last 30 Days': [
    { name: 'Caramel Latte', sales: 1050 },
    { name: 'Iced Americano', sales: 890 },
    { name: 'Cappuccino', sales: 780 },
    { name: 'Espresso', sales: 680 },
    { name: 'Mocha', sales: 620 },
  ],
  'Last 90 Days': [
    { name: 'Caramel Latte', sales: 3200 },
    { name: 'Iced Americano', sales: 2850 },
    { name: 'Cappuccino', sales: 2400 },
    { name: 'Espresso', sales: 2100 },
    { name: 'Mocha', sales: 1950 },
  ],
  'All-Time': [
    { name: 'Caramel Latte', sales: 8500 },
    { name: 'Iced Americano', sales: 7200 },
    { name: 'Cappuccino', sales: 6800 },
    { name: 'Espresso', sales: 5900 },
    { name: 'Mocha', sales: 5400 },
  ]
};

const shiftPerformanceData = {
  'Today': [
    { cashier: 'Cashier 1', sales: 920, orders: 135 },
    { cashier: 'Cashier 2', sales: 680, orders: 95 },
    { cashier: 'Cashier 3', sales: 1210, orders: 112 },
    { cashier: 'Cashier 4', sales: 850, orders: 128 },
    { cashier: 'Cashier 5', sales: 690, orders: 85 },
  ],
  'Yesterday': [
    { cashier: 'Cashier 1', sales: 880, orders: 128 },
    { cashier: 'Cashier 2', sales: 720, orders: 102 },
    { cashier: 'Cashier 3', sales: 1150, orders: 108 },
    { cashier: 'Cashier 4', sales: 910, orders: 135 },
    { cashier: 'Cashier 5', sales: 740, orders: 92 },
  ],
  'This Week': [
    { cashier: 'Cashier 1', sales: 6200, orders: 920 },
    { cashier: 'Cashier 2', sales: 4800, orders: 680 },
    { cashier: 'Cashier 3', sales: 8400, orders: 780 },
    { cashier: 'Cashier 4', sales: 5900, orders: 890 },
    { cashier: 'Cashier 5', sales: 4900, orders: 610 },
  ],
  'Last Week': [
    { cashier: 'Cashier 1', sales: 5900, orders: 880 },
    { cashier: 'Cashier 2', sales: 4600, orders: 650 },
    { cashier: 'Cashier 3', sales: 8100, orders: 750 },
    { cashier: 'Cashier 4', sales: 5700, orders: 860 },
    { cashier: 'Cashier 5', sales: 4700, orders: 590 },
  ],
  'This Month': [
    { cashier: 'Cashier 1', sales: 25000, orders: 3800 },
    { cashier: 'Cashier 2', sales: 19500, orders: 2700 },
    { cashier: 'Cashier 3', sales: 34000, orders: 3200 },
    { cashier: 'Cashier 4', sales: 24000, orders: 3600 },
    { cashier: 'Cashier 5', sales: 20000, orders: 2500 },
  ]
};

const activeOrdersData = {
  'Real-time': [
    { time: '8am', pending: 3, inProgress: 5 },
    { time: '10am', pending: 5, inProgress: 8 },
    { time: '12pm', pending: 8, inProgress: 12 },
    { time: '2pm', pending: 4, inProgress: 6 },
    { time: '4pm', pending: 6, inProgress: 9 },
    { time: '6pm', pending: 2, inProgress: 4 },
  ],
  'Last 4 Hours': [
    { time: '2pm', pending: 4, inProgress: 6 },
    { time: '3pm', pending: 5, inProgress: 7 },
    { time: '4pm', pending: 6, inProgress: 9 },
    { time: '5pm', pending: 5, inProgress: 8 },
    { time: '6pm', pending: 2, inProgress: 4 },
  ],
  'Full Day': [
    { time: '8am', pending: 3, inProgress: 5 },
    { time: '9am', pending: 4, inProgress: 6 },
    { time: '10am', pending: 5, inProgress: 8 },
    { time: '11am', pending: 6, inProgress: 10 },
    { time: '12pm', pending: 8, inProgress: 12 },
    { time: '1pm', pending: 6, inProgress: 9 },
    { time: '2pm', pending: 4, inProgress: 6 },
    { time: '3pm', pending: 5, inProgress: 7 },
    { time: '4pm', pending: 6, inProgress: 9 },
    { time: '5pm', pending: 5, inProgress: 8 },
    { time: '6pm', pending: 2, inProgress: 4 },
  ]
};

const completedOrdersData = {
  'Today': [
    { hour: '8-9', orders: 15 },
    { hour: '9-10', orders: 28 },
    { hour: '10-11', orders: 45 },
    { hour: '11-12', orders: 52 },
    { hour: '12-1', orders: 68 },
    { hour: '1-2', orders: 42 },
    { hour: '2-3', orders: 35 },
    { hour: '3-4', orders: 48 },
  ],
  'Average Last 7 Days': [
    { hour: '8-9', orders: 18 },
    { hour: '9-10', orders: 32 },
    { hour: '10-11', orders: 48 },
    { hour: '11-12', orders: 55 },
    { hour: '12-1', orders: 72 },
    { hour: '1-2', orders: 45 },
    { hour: '2-3', orders: 38 },
    { hour: '3-4', orders: 52 },
  ],
  'Last Same Day': [
    { hour: '8-9', orders: 12 },
    { hour: '9-10', orders: 25 },
    { hour: '10-11', orders: 42 },
    { hour: '11-12', orders: 48 },
    { hour: '12-1', orders: 65 },
    { hour: '1-2', orders: 38 },
    { hour: '2-3', orders: 32 },
    { hour: '3-4', orders: 45 },
  ]
};

const canceledOrdersTrendData = {
  'By Cashier': [
    { name: 'Cashier 1', canceled: 2 },
    { name: 'Cashier 2', canceled: 4 },
    { name: 'Cashier 3', canceled: 1 },
    { name: 'Cashier 4', canceled: 3 },
    { name: 'Cashier 5', canceled: 1 },
  ],
  'By Product Category': [
    { name: 'Coffee', canceled: 5 },
    { name: 'Pastries', canceled: 3 },
    { name: 'Sandwiches', canceled: 2 },
    { name: 'Beverages', canceled: 1 },
  ],
  'By Cancellation Reason': [
    { name: 'Wrong Order', canceled: 4 },
    { name: 'Out of Stock', canceled: 3 },
    { name: 'Customer Request', canceled: 2 },
    { name: 'Payment Issue', canceled: 2 },
  ]
};

const spillageData = {
  'By Product Type': {
    stats: { cost: 2450, incidents: 8, target: -12.5 },
    items: [
      { name: 'Coffee', cost: 1200, incidents: 4 },
      { name: 'Milk', cost: 650, incidents: 2 },
      { name: 'Pastry', cost: 400, incidents: 1 },
      { name: 'Syrup', cost: 200, incidents: 1 },
    ]
  },
  'By Cashier/Shift': {
    stats: { cost: 2450, incidents: 8, target: -12.5 },
    items: [
      { name: 'Morning Shift', cost: 980, incidents: 3 },
      { name: 'Afternoon Shift', cost: 850, incidents: 3 },
      { name: 'Evening Shift', cost: 620, incidents: 2 },
    ]
  },
  'By Incident Reason': {
    stats: { cost: 2450, incidents: 8, target: -12.5 },
    items: [
      { name: 'Preparation Error', cost: 1100, incidents: 4 },
      { name: 'Equipment Malfunction', cost: 750, incidents: 2 },
      { name: 'Customer Complaint', cost: 400, incidents: 1 },
      { name: 'Expired Product', cost: 200, incidents: 1 },
    ]
  }
};

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
  const [completedOrdersFilter, setCompletedOrdersFilter] = useState("Today");
  const [canceledOrdersFilter, setCanceledOrdersFilter] = useState("By Cashier");
  const [activeOrdersFilter, setActiveOrdersFilter] = useState("Real-time");
  const [spillageFilter, setSpillageFilter] = useState("By Product Type");
  const [userRole, setUserRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  }, []);

  const getTotalSalesData = () => {
    const salesByFilter = {
      'Today': { current: 28123, previous: 25000 },
      'Yesterday': { current: 25000, previous: 24500 },
      'This Week': { current: 165000, previous: 158000 },
      'This Month': { current: 650000, previous: 620000 }
    };
    return salesByFilter[totalSalesFilter] || salesByFilter['Today'];
  };

  const getSummaryCards = () => {
    if (userRole === 'admin') {
      const salesData = getTotalSalesData();
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
          filterOptions: ['Today', 'Yesterday', 'This Week', 'This Month']
        },
        {
          title: "Cash Drawer Variance",
          current: 60,
          previous: 45,
          format: "currency",
          icon: faMoneyBillWave,
          type: "posDashboardCashVariance",
          subtext: "Across all shifts"
        },
        {
          title: "Best-Selling Product",
          current: 245,
          previous: 220,
          format: "number",
          icon: faChartLine,
          type: "posDashboardBestSelling",
          subtext: "Caramel Latte"
        },
        {
          title: "Total Refunds",
          current: 5,
          previous: 7,
          format: "number",
          icon: faUndo,
          type: "posDashboardRefunds",
          subtext: "2.1% of total sales"
        }
      ];
    } else if (userRole === 'manager') {
      return [
        {
          title: "Active Orders",
          current: 12,
          previous: 10,
          format: "number",
          icon: faClock,
          type: "posDashboardActiveOrders",
          subtext: "Real-time count"
        },
        {
          title: "Completed Orders",
          current: 45,
          previous: 50,
          format: "number",
          icon: faShoppingCart,
          type: "posDashboardOrders",
          subtext: "Daily total"
        },
        {
          title: "Canceled Orders",
          current: 11,
          previous: 8,
          format: "number",
          icon: faTimesCircle,
          type: "posDashboardCanceled",
          subtext: "Today's cancellations"
        },
        {
          title: "Spillage Cost",
          current: 2450,
          previous: 2800,
          format: "currency",
          icon: faExclamationTriangle,
          type: "posDashboardSpillage",
          subtext: "8 incidents today"
        }
      ];
    }
    return [];
  };

  const summaryCards = getSummaryCards();
  const currentSpillageData = spillageData[spillageFilter];
  const currentShiftData = shiftPerformanceData[shiftPerformanceFilter];

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="posDashboard">
      <Sidebar key={userRole} />
      <main className="posDashboardMain">
        <Header key={userRole} pageTitle={`Dashboard`} />

        <div className="posDashboardContents">
          <div className="posDashboardCards">
            {summaryCards.map((card, index) => {
              const { current, previous } = card;
              const diff = current - previous;
              const percent = previous !== 0 ? (diff / previous) * 100 : 0;
              const isImproved = current > previous;
              const hasChange = current !== previous;

              return (
                <div key={index} className={`posDashboardCard ${card.type}`}>
                  <div className="posDashboardCardText">
                    <div className="posDashboardCardTitleRow">
                      <div className="posDashboardCardTitle">
                        {card.hasFilter ? card.title.split(' (')[0] : card.title}
                      </div>
                    </div>
                    <div className="posDashboardCardDetails">
                      <div className="posDashboardCardValue">{formatValue(current, card.format)}</div>
                      {hasChange && (
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
                  <div className="posDashboardChartBox posDashboardSpillageBox">
                    <div className="posDashboardChartHeader">
                      <span>Spillage Overview</span>
                      <select
                        className="posDashboardChartDropdown"
                        value={spillageFilter}
                        onChange={(e) => setSpillageFilter(e.target.value)}
                      >
                        <option value="By Product Type">By Product Type</option>
                        <option value="By Cashier/Shift">By Cashier/Shift</option>
                        <option value="By Incident Reason">By Incident Reason</option>
                      </select>
                    </div>
                    <div className="posDashboardSpillageContent">
                      <div className="posDashboardSpillageStats">
                        <div className="posDashboardSpillageStat">
                          <div className="posDashboardSpillageLabel">Total Cost Today</div>
                          <div className="posDashboardSpillageValue">₱{currentSpillageData.stats.cost.toLocaleString()}</div>
                        </div>
                        <div className="posDashboardSpillageStat">
                          <div className="posDashboardSpillageLabel">Incidents</div>
                          <div className="posDashboardSpillageValue">{currentSpillageData.stats.incidents}</div>
                        </div>
                        <div className="posDashboardSpillageStat">
                          <div className="posDashboardSpillageLabel">vs Target</div>
                          <div className="posDashboardSpillageValue posDashboardGreen">{currentSpillageData.stats.target}%</div>
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
                            strokeDashoffset="125.6"
                            strokeLinecap="round"
                            transform="rotate(-90 100 100)"
                          />
                          <text x="100" y="95" textAnchor="middle" fontSize="32" fontWeight="bold" fill="#333">75%</text>
                          <text x="100" y="120" textAnchor="middle" fontSize="14" fill="#666">of budget</text>
                        </svg>
                      </div>
                      <div className="posDashboardSpillageBreakdown">
                        <div className="posDashboardSpillageBreakdownTitle">Breakdown</div>
                        {currentSpillageData.items.map((item, idx) => (
                          <div key={idx} className="posDashboardSpillageItem">
                            <span className="posDashboardSpillageItemName">{item.name}</span>
                            <span className="posDashboardSpillageItemValue">
                              ₱{item.cost.toLocaleString()} ({item.incidents} {item.incidents === 1 ? 'incident' : 'incidents'})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="posDashboardChartBox">
                    <div className="posDashboardChartHeader">
                      <span>Active Orders Monitor</span>
                      <select
                        className="posDashboardChartDropdown"
                        value={activeOrdersFilter}
                        onChange={(e) => setActiveOrdersFilter(e.target.value)}
                      >
                        <option value="Real-time">Real-time</option>
                        <option value="Last 4 Hours">Last 4 Hours</option>
                        <option value="Full Day">Full Day</option>
                      </select>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={activeOrdersData[activeOrdersFilter]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="pending" stackId="1" stroke="#ffc107" fill="#ffc107" name="Pending" />
                        <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#fd7e14" fill="#fd7e14" name="In Progress" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="posDashboardOrdersRow">
                  <div className="posDashboardChartBox">
                    <div className="posDashboardChartHeader">
                      <span>Completed Orders - Peak Hours</span>
                      <select
                        className="posDashboardChartDropdown"
                        value={completedOrdersFilter}
                        onChange={(e) => setCompletedOrdersFilter(e.target.value)}
                      >
                        <option value="Today">Today</option>
                        <option value="Average Last 7 Days">Average Last 7 Days</option>
                        <option value="Last Same Day">Last Same Day</option>
                      </select>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={completedOrdersData[completedOrdersFilter]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="orders" fill="#28a745" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="posDashboardChartBox">
                    <div className="posDashboardChartHeader">
                      <span>Canceled Orders Analysis</span>
                      <select
                        className="posDashboardChartDropdown"
                        value={canceledOrdersFilter}
                        onChange={(e) => setCanceledOrdersFilter(e.target.value)}
                      >
                        <option value="By Cashier">By Cashier</option>
                        <option value="By Product Category">By Product Category</option>
                        <option value="By Cancellation Reason">By Cancellation Reason</option>
                      </select>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={canceledOrdersTrendData[canceledOrdersFilter]} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="canceled" fill="#e83e8c" name="Canceled Orders" />
                      </BarChart>
                    </ResponsiveContainer>
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
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={revenueData[revenueFilter]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="income" stroke="#00b4d8" strokeWidth={2} name="Income" />
                        <Line type="monotone" dataKey="expense" stroke="#ff4d6d" strokeWidth={2} name="Expense" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                {/* Best Selling Items */}
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
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={bestSellingItemsData[bestSellingFilter]} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="sales" fill="#00b4d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                </div>

                {/* Shift Performance Chart - Full width */}
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
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={currentShiftData}>
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
                    </div>
                    <div className="posDashboardShiftStats">
                      <div className="posDashboardShiftStat">
                        <div className="posDashboardShiftStatLabel">Total Sales</div>
                        <div className="posDashboardShiftStatValue">
                          ₱{currentShiftData.reduce((sum, c) => sum + c.sales, 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="posDashboardShiftStat">
                        <div className="posDashboardShiftStatLabel">Order Count</div>
                        <div className="posDashboardShiftStatValue">
                          {currentShiftData.reduce((sum, c) => sum + c.orders, 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;