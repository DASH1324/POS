import React, { useState } from "react";
import "./dashboard.css"; 
import Sidebar from "../sidebar"; 
import Header from "../admin/header"; 
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillWave,
  faChartLine,
  faShoppingCart,
  faClock,
  faArrowTrendUp,
  faArrowTrendDown
} from '@fortawesome/free-solid-svg-icons';

const revenueData = [
  { name: 'Jan', income: 5000, expense: 3000 },
  { name: 'Feb', income: 14000, expense: 10000 },
  { name: 'Mar', income: 15000, expense: 12000 },
  { name: 'Apr', income: 11000, expense: 9000 },
  { name: 'May', income: 13000, expense: 7000 },
  { name: 'June', income: 18000, expense: 10000 },
  { name: 'July', income: 18000, expense: 13000 },
];

const salesData = [
  { name: 'Mon', sales: 60 },
  { name: 'Tue', sales: 95 },
  { name: 'Wed', sales: 70 },
  { name: 'Thu', sales: 25 },
  { name: 'Fri', sales: 60 },
  { name: 'Sat', sales: 68 },
  { name: 'Sun', sales: 63 },
];

const summaryCardData = [
  {
    title: "Today's Sales",
    current: 28123,
    previous: 25000,
    format: "currency",
    icon: faMoneyBillWave,
    type: "posAdmnSales"
  },
  {
    title: "Today's Revenue",
    current: 18003,
    previous: 17000,
    format: "currency",
    icon: faChartLine,
    type: "posAdmnRevenue"
  },
  {
    title: "Today's Orders",
    current: 45,
    previous: 50,
    format: "number",
    icon: faShoppingCart,
    type: "posAdmnOrders"
  },
  {
    title: "Pending Orders",
    current: 5,
    previous: 5,
    format: "number",
    icon: faClock,
    type: "posAdmnPendings"
  }
];

const formatValue = (value, format) => {
  return format === "currency"
    ? `₱${value.toLocaleString()}`
    : value.toLocaleString();
};

const Dashboard = () => {
  const [revenueFilter, setRevenueFilter] = useState("Monthly");
  const [salesFilter, setSalesFilter] = useState("Monthly");

  return (
    <div className="posAdmnDashboard">
      <Sidebar />
      <main className="posAdmnDashboardMain">
      <Header pageTitle="Dashboard" />

        <div className="posAdmnDashboardContents">
          <div className="posAdmnDashboardCards">
            {summaryCardData.map((card, index) => {
              const { current, previous } = card;
              const diff = current - previous;
              const percent = previous !== 0 ? (diff / previous) * 100 : 0;
              const isImproved = current > previous;
              const hasChange = current !== previous;

              return (
                <div key={index} className={`posAdmnCard ${card.type}`}>
                  <div className="posAdmnCardText">
                    <div className="posAdmnCardTitle">{card.title}</div>
                    <div className="posAdmnCardDetails">
                      <div className="posAdmnCardValue">{formatValue(current, card.format)}</div>
                      {hasChange && (
                        <div className={`posAdmnCardPercent ${isImproved ? 'posAdmnGreen' : 'posAdmnRed'}`}>
                          <FontAwesomeIcon icon={isImproved ? faArrowTrendUp : faArrowTrendDown} />
                             {Math.abs(percent).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="posAdmnCardIcon">
                    <FontAwesomeIcon icon={card.icon} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="posAdmnDashboardCharts">
            <div className="posAdmnChartBox">
              <div className="posAdmnChartHeader">
                <span>Revenue</span>
                <select
                  className="posAdmnChartDropdown"
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
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#00b4d8" strokeWidth={2}/>
                  <Line type="monotone" dataKey="expense" stroke="#ff4d6d" strokeWidth={2}/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="posAdmnChartBox">
              <div className="posAdmnChartHeader">
                <span>Sales</span>
                <select
                  className="posAdmnChartDropdown"
                  value={salesFilter}
                  onChange={(e) => setSalesFilter(e.target.value)}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#00b4d8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;