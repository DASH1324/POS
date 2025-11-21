import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./activityLogs.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaTag,
  FaShoppingCart,
  FaBox,
  FaFilter,
  FaSearch,
  FaCube,
  FaUndo,
  FaBan,
  FaUser,
} from "react-icons/fa";
import Lottie from "lottie-react";
import loadingAnimation from "../../../assets/animation/loading.json";
import axios from "axios";
import CustomDateModal from "../shared/customDateModal";

const BLOCKCHAIN_API_URL = "http://localhost:9005/blockchain";
const USER_API_URL = "http://127.0.0.1:4000/users";

// Services to show by default in the Transaction Logs tab
const REQUIRED_TRANSACTION_SERVICES = [
  'PURCHASE_ORDER_SERVICE',
  'POS_SALES',
  'CASH_TALLY',
  'CASHIER_SESSION'
];

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
    case "week": {
      return `Last 7 Days`;
    }
    case "month": {
      return `Last 30 Days`;
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
      return "All Time";
  }
};

function BlockchainActivityLogs() {
  const [activeTab, setActiveTab] = useState("activity");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [currentPeriodText, setCurrentPeriodText] = useState(getPeriodText("all"));
  const [groupedLogs, setGroupedLogs] = useState([]);
  const [error, setError] = useState(null);

  // State to store the mapping of username -> FullName
  const [actorNameMap, setActorNameMap] = useState({});

  // Update the period display text when the date filter or custom range changes
  useEffect(() => {
    setCurrentPeriodText(getPeriodText(dateFilter, customRange.start, customRange.end));
  }, [dateFilter, customRange]);

  // Fetch blockchain logs
  useEffect(() => {
    if (activeTab === "activity") {
      fetchLogs();
    } else if (activeTab === "transaction") {
      fetchTransactionLogs();
    }
  }, [serviceFilter, entityTypeFilter, actionFilter, dateFilter, customRange, activeTab]);

  // Fetch actor full names when logs are loaded
  useEffect(() => {
    if (groupedLogs.length === 0) return;

    const fetchActorNames = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      // Find all unique usernames
      const allUsernames = new Set();
      groupedLogs.forEach((group) => {
        group.events.forEach((event) => {
          allUsernames.add(event.actor_username);
        });
      });

      if (allUsernames.size === 0) return;

      // Fetch names for all usernames
      const namePromises = Array.from(allUsernames).map(async (username) => {
        // Skip system users - don't make API calls for them
        if (username === "System" || username === "SYSTEM_AUTO_CANCEL") {
          return { username, fullName: "System (Automated)" };
        }

        try {
          const response = await axios.get(
            `${USER_API_URL}/employee_name?username=${username}`,
            { headers }
          );

          const fullName = response.data.employee_name || username;

          console.log(`Fetched name for ${username}:`, fullName);
          return { username, fullName };
        } catch (err) {
          console.error(`Failed to fetch name for ${username}:`, err);
          return { username, fullName: username };
        }
      });

      // Resolve all promises
      const results = await Promise.all(namePromises);

      // Create a new map from the results
      const newNameMap = {};
      results.forEach(({ username, fullName }) => {
        newNameMap[username] = fullName;
      });

      console.log("Actor name map:", newNameMap);
      // Update the state with the new names
      setActorNameMap(newNameMap);
    };

    fetchActorNames();
  }, [groupedLogs]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");

      const params = {};
      if (serviceFilter) params.service = serviceFilter;
      if (entityTypeFilter) params.entity_type = entityTypeFilter;
      if (actionFilter) params.action = actionFilter;

      // Add date filtering
      if (dateFilter !== "all") {
        const today = new Date();
        let startDate, endDate;

        switch (dateFilter) {
          case "today":
            startDate = formatDateForAPI(today);
            endDate = formatDateForAPI(today);
            break;
          case "yesterday": {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            startDate = formatDateForAPI(yesterday);
            endDate = formatDateForAPI(yesterday);
            break;
          }
          case "week": {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            startDate = formatDateForAPI(weekAgo);
            endDate = formatDateForAPI(today);
            break;
          }
          case "month": {
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            startDate = formatDateForAPI(monthAgo);
            endDate = formatDateForAPI(today);
            break;
          }
          case "custom":
            if (customRange.start && customRange.end) {
              startDate = customRange.start;
              endDate = customRange.end;
            }
            break;
        }

        if (startDate && endDate) {
          params.start_date = startDate;
          params.end_date = endDate;
        }
      }

      params.limit = 100;

      const response = await axios.get(`${BLOCKCHAIN_API_URL}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      // Group logs by entity
      const grouped = groupLogsByEntity(response.data);
      setGroupedLogs(grouped);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setError(err.response?.data?.detail || "Failed to fetch activity logs");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactionLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");

      const params = {
        // Only set the service filter if the user explicitly set one, otherwise, we filter locally
        service: serviceFilter || undefined,
        entity_type: entityTypeFilter || undefined,
        action: actionFilter || undefined,
      };

      // Add date filtering
      if (dateFilter !== "all") {
        const today = new Date();
        let startDate, endDate;

        switch (dateFilter) {
          case "today":
            startDate = formatDateForAPI(today);
            endDate = formatDateForAPI(today);
            break;
          case "yesterday": {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            startDate = formatDateForAPI(yesterday);
            endDate = formatDateForAPI(yesterday);
            break;
          }
          case "week": {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            startDate = formatDateForAPI(weekAgo);
            endDate = formatDateForAPI(today);
            break;
          }
          case "month": {
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            startDate = formatDateForAPI(monthAgo);
            endDate = formatDateForAPI(today);
            break;
          }
          case "custom":
            if (customRange.start && customRange.end) {
              startDate = customRange.start;
              endDate = customRange.end;
            }
            break;
        }

        if (startDate && endDate) {
          params.start_date = startDate;
          params.end_date = endDate;
        }
      }

      params.limit = 100;

      const response = await axios.get(`${BLOCKCHAIN_API_URL}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      // Start filtering the logs
      let transactionLogs = response.data;

      // Determine the set of allowed services: user-filter OR required list
      let allowedServices;

      if (serviceFilter) {
        // If the user has applied a service filter, use it.
        allowedServices = serviceFilter.split(',');
      } else {
        // If no service filter is applied (default state), use the specified list.
        allowedServices = REQUIRED_TRANSACTION_SERVICES;
      }

      // Apply the service filter to the logs
      transactionLogs = transactionLogs.filter(log =>
        allowedServices.includes(log.service_identifier)
      );

      // Filter by action (keep existing logic)
      transactionLogs = transactionLogs.filter(log => {
        const isTransactionAction = ['CREATE', 'UPDATE', 'REFUND', 'CANCEL', 'AUTO_CANCEL', 'CLOSE_SESSION'].includes(log.action);
        return isTransactionAction;
      });

      // Group logs by individual transaction (don't group multiple transactions together)
      const grouped = groupTransactionLogs(transactionLogs);
      setGroupedLogs(grouped);
    } catch (err) {
      console.error("Error fetching transaction logs:", err);
      setError(err.response?.data?.detail || "Failed to fetch transaction logs");
    } finally {
      setIsLoading(false);
    }
  };

  // Group logs by service + entity_type + entity_id
  const groupLogsByEntity = (logs) => {
    const groups = {};

    logs.forEach((log) => {
      const key = `${log.service_identifier}_${log.entity_type}_${log.entity_id}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          service: log.service_identifier,
          entityType: log.entity_type,
          entityId: log.entity_id,
          firstTimestamp: log.created_at,
          events: [],
        };
      }

      groups[key].events.push(log);
    });

    // Sort events within each group by timestamp
    Object.values(groups).forEach((group) => {
      group.events.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      // Update first timestamp to earliest event
      group.firstTimestamp = group.events[0]?.created_at;
    });

    // Convert to array and sort by first timestamp (newest first)
    return Object.values(groups).sort(
      (a, b) => new Date(b.firstTimestamp) - new Date(a.firstTimestamp)
    );
  };

  // Group transaction logs - group by entity_id to show all events for same order
  const groupTransactionLogs = (logs) => {
    const groups = {};

    logs.forEach((log) => {
      // Normalize the key - treat POS_SALES/Sale and PURCHASE_ORDER_SERVICE/PurchaseOrder as the same
      let normalizedService = log.service_identifier;
      let normalizedType = log.entity_type;

      // Treat PurchaseOrder updates as part of Sale transactions
      if (log.service_identifier === 'PURCHASE_ORDER_SERVICE' && log.entity_type === 'PurchaseOrder') {
        normalizedService = 'POS_SALES';
        normalizedType = 'Sale';
      }

      const key = `${normalizedService}_${normalizedType}_${log.entity_id}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          service: normalizedService,  // Use normalized service
          entityType: normalizedType,   // Use normalized type
          entityId: log.entity_id,
          firstTimestamp: log.created_at,
          events: [],
        };
      }

      groups[key].events.push(log);
    });

    // Sort events within each group by timestamp
    Object.values(groups).forEach((group) => {
      group.events.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      // Update first timestamp to earliest event
      group.firstTimestamp = group.events[0]?.created_at;
    });

    // Convert to array and sort by first timestamp (newest first)
    return Object.values(groups).sort(
      (a, b) => new Date(b.firstTimestamp) - new Date(a.firstTimestamp)
    );
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setServiceFilter("");
    setEntityTypeFilter("");
    setActionFilter("");
    setDateFilter("all");
    setCustomRange({ start: null, end: null });
  };

  // Reset filters when switching tabs
  useEffect(() => {
    handleClearFilters();
  }, [activeTab]);

  // Handler for applying a custom date range from the modal
  const handleCustomApply = (startDate, endDate) => {
    const startStr = formatDateForAPI(new Date(startDate));
    const endStr = formatDateForAPI(new Date(endDate));
    setCustomRange({ start: startStr, end: endStr });
    setDateFilter("custom");
    setIsCustomModalOpen(false);
  };

  const getServiceIcon = (service) => {
    switch (service) {
      case "DISCOUNTS_SERVICE":
      case "PROMOTIONS":
        return <FaTag className="activityLogs-icon-white" />;
      case "POS_SALES":
      case "PURCHASE_ORDER_SERVICE":
        return <FaShoppingCart className="activityLogs-icon-white" />;
      case "POS_SALES_AUTO_CANCEL":
        return <FaBan className="activityLogs-icon-white" />;
      case "CASHIER_SESSION":
      case "CASH_TALLY": // FIX: Added CASH_TALLY for icon
        return <FaUser className="activityLogs-icon-white" />;
      case "POS_SALES_REFUND":
        return <FaUndo className="activityLogs-icon-white" />;
      case "PRODUCTS_SERVICE":
        return <FaBox className="activityLogs-icon-white" />;
      case "INVENTORY_SERVICE":
        return <FaCube className="activityLogs-icon-white" />;
      default:
        return <FaBox className="activityLogs-icon-white" />;
    }
  };

  const getServiceColor = (service) => {
    const colors = {
      DISCOUNTS_SERVICE: "#3b82f6",
      PROMOTIONS: "#3b82f6",
      POS_SALES: "#10b981",
      PURCHASE_ORDER_SERVICE: "#10b981",
      POS_SALES_AUTO_CANCEL: "#ef4444",
      POS_SALES_REFUND: "#f59e0b",
      CASHIER_SESSION: "#8b5cf6",
      CASH_TALLY: "#8b5cf6", // FIX: Added CASH_TALLY for color
      PRODUCTS_SERVICE: "#f59e0b",
    };
    return colors[service] || "#6b7280";
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "CREATE":
        return <FaPlus className="activityLogs-action-icon" />;
      case "UPDATE":
        return <FaEdit className="activityLogs-action-icon" />;
      case "DELETE":
        return <FaTrash className="activityLogs-action-icon" />;
      case "REFUND":
        return <FaUndo className="activityLogs-action-icon" />;
      case "CANCEL":
        return <FaBan className="activityLogs-action-icon" />;
      case "AUTO_CANCEL":
        return <FaBan className="activityLogs-action-icon" />;
      default:
        return null;
    }
  };

  const getActionClass = (action) => {
    switch (action) {
      case "CREATE":
        return "activityLogs-event-success";
      case "UPDATE":
        return "activityLogs-event-info";
      case "DELETE":
        return "activityLogs-event-error";
      case "REFUND":
        return "activityLogs-event-warning";
      case "CANCEL":
        return "activityLogs-event-error";
      case "AUTO_CANCEL":
        return "activityLogs-event-error";
      default:
        return "";
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case "CREATE":
        return "created";
      case "UPDATE":
        return "updated";
      case "DELETE":
        return "deleted";
      case "REFUND":
        return "refunded";
      case "CANCEL":
        return "cancelled";
      case "AUTO_CANCEL":
        return "auto-cancelled";
      default:
        return action.toLowerCase();
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getEntityTitle = (group) => {
    // Normalize entity type for comparison
    const normalizedType = group.entityType?.toUpperCase();

    // For POS_SALES in activity logs
    if (group.service === 'POS_SALES') {
      if (normalizedType === 'SALE') {
        // Check if it's a refund based on change_description
        const isRefund = group.events[0]?.change_description?.toLowerCase().includes('refund');
        return isRefund ? 'Sale Refund' : 'Store Sale';
      }
    }

    // For PURCHASE_ORDER_SERVICE - show as "Online Order"
    if (group.service === 'PURCHASE_ORDER_SERVICE' && normalizedType === 'PURCHASEORDER') {
      return 'Online Order';
    }

    const entityName =
      group.events[0]?.data?.name ||
      group.events[0]?.change_description?.split(":")[1]?.trim() ||
      `${group.entityType} #${group.entityId}`;

    return `${group.entityType}: ${entityName}`;
  };

  const getTransactionTitle = (group) => {
    // Check if any event mentions "Received an Online Order"
    const hasOnlineOrder = group.events.some(e =>
      e.change_description?.includes('Received an Online Order:')
    );

    if (hasOnlineOrder) {
      return 'Online Order';
    }

    // FIX: Added explicit check for CASH_TALLY title
    if (group.service === 'CASH_TALLY') {
      return 'Cash Tally';
    }

    if (group.service === 'CASHIER_SESSION') {
      return 'Cashier Session';
    }

    const event = group.events[0];
    const description = event.change_description || '';

    if (description.includes('Refund')) {
      return 'Sale Refund';
    }

    if (description.includes('New sale created')) {
      return 'Store Sale';
    }

    if (description.includes('cancelled')) {
      return description.includes('auto-cancelled') ? 'Auto-Cancelled Order' : 'Cancelled Order';
    }

    return 'Transaction';
  };

  // Filter groups by search term
  const filteredGroups = groupedLogs.filter((group) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const entityTitle = activeTab === "transaction"
      ? getTransactionTitle(group).toLowerCase()
      : getEntityTitle(group).toLowerCase();

    // Search by full name as well
    const actorNames = group.events
      .map(e => (actorNameMap[e.actor_username] || e.actor_username).toLowerCase())
      .join(' ');

    const descriptions = group.events
      .map((e) => e.change_description.toLowerCase())
      .join(" ");

    return (
      entityTitle.includes(searchLower) ||
      actorNames.includes(searchLower) ||
      descriptions.includes(searchLower)
    );
  });

  const renderContent = () => {
    if (activeTab === "activity") {
      return (
        <>
          {/* Loading State */}
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-bg">
                <Lottie
                  animationData={loadingAnimation}
                  loop={true}
                  className="loading-animation"
                />
              </div>
            </div>
          ) : (
            /* Timeline */
            <div className="activityLogs-timeline">
              {/* Error State */}
              {error ? (
                <div className="activityLogs-error">
                  <p>{error}</p>
                  <button onClick={fetchLogs}>Retry</button>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="activityLogs-empty-inline">
                  <p>No activity logs found</p>
                </div>
              ) : (
                <>
                  <div className="activityLogs-timeline-line"></div>

                  {filteredGroups.map((group) => (
                    <div key={group.id} className="activityLogs-activity-item">
                      {/* Main Activity Header */}
                      <div className="activityLogs-activity-header">
                        {/* Icon Circle */}
                        <div
                          className="activityLogs-icon-circle"
                          style={{
                            backgroundColor: getServiceColor(group.service),
                          }}
                        >
                          {getServiceIcon(group.service)}
                        </div>

                        {/* Content */}
                        <div className="activityLogs-activity-content">
                          <div className="activityLogs-activity-title-row">
                            <span className="activityLogs-timestamp">
                              {formatTimestamp(group.firstTimestamp)}
                            </span>
                            <h3 className="activityLogs-activity-title">
                              {getEntityTitle(group)}
                            </h3>
                          </div>

                          {/* Chain of Events */}
                          {group.events.map((event, eventIndex) => (
                            <div key={eventIndex} className="activityLogs-event-item">
                              <div className="activityLogs-event-dot"></div>
                              <div className="activityLogs-event-content">
                                <div className="activityLogs-event-timestamp">
                                  {formatTimestamp(event.created_at)}
                                </div>
                                <div
                                  className={`activityLogs-event-message ${getActionClass(
                                    event.action
                                  )}`}
                                >
                                  {getActionIcon(event.action)}
                                  <div className="activityLogs-event-text">
                                    <strong>
                                      {actorNameMap[event.actor_username] ||
                                        event.actor_username}
                                    </strong>{" "}
                                    {getActionText(event.action)}:{" "}
                                    {event.change_description}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      );
    } else if (activeTab === "transaction") {
      return (
        <>
          {/* Loading State */}
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-bg">
                <Lottie
                  animationData={loadingAnimation}
                  loop={true}
                  className="loading-animation"
                />
              </div>
            </div>
          ) : (
            /* Timeline */
            <div className="activityLogs-timeline">
              {/* Error State */}
              {error ? (
                <div className="activityLogs-error">
                  <p>{error}</p>
                  <button onClick={fetchTransactionLogs}>Retry</button>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="activityLogs-empty-inline">
                  <p>No transaction logs found</p>
                </div>
              ) : (
                <>
                  <div className="activityLogs-timeline-line"></div>

                  {filteredGroups.map((group) => {
                    return (
                      <div key={group.id} className="activityLogs-activity-item">
                        {/* Main Transaction Header */}
                        <div className="activityLogs-activity-header">
                          {/* Icon Circle */}
                          <div
                            className="activityLogs-icon-circle"
                            style={{
                              backgroundColor: getServiceColor(group.service),
                            }}
                          >
                            {getServiceIcon(group.service)}
                          </div>

                          {/* Content */}
                          <div className="activityLogs-activity-content">
                            <div className="activityLogs-activity-title-row">
                              <span className="activityLogs-timestamp">
                                {formatTimestamp(group.firstTimestamp)}
                              </span>
                              <h3 className="activityLogs-activity-title">
                                {getTransactionTitle(group)}
                              </h3>
                            </div>

                            {/* Chain of Transaction Events */}
                            {group.events.map((event, eventIndex) => (
                              <div key={eventIndex} className="activityLogs-event-item">
                                <div className="activityLogs-event-dot"></div>
                                <div className="activityLogs-event-content">
                                  <div className="activityLogs-event-timestamp">
                                    {formatTimestamp(event.created_at)}
                                  </div>
                                  <div
                                    className={`activityLogs-event-message ${getActionClass(
                                      event.action
                                    )}`}
                                  >
                                    {getActionIcon(event.action)}
                                    <div className="activityLogs-event-text">
                                      <strong>
                                        {actorNameMap[event.actor_username] ||
                                          event.actor_username}
                                      </strong>{" "}
                                      {getActionText(event.action)}:{" "}
                                      {event.change_description}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </>
      );
    }
  };

  return (
    <div className="activityLogs">
      <Sidebar />
      <div className="activityLogs-container">
        <Header pageTitle="Blockchain Logs" />

        <div className="activityLogs-content-wrapper">
          <div className="activityLogs-content">
            {/* Tabs and Filter Wrapper */}
            <div className="activityLogs-tabs-filter-wrapper">
              {/* Tabs - Left Side */}
              <div className="activityLogs-tabs">
                <button
                  className={`activityLogs-tab ${
                    activeTab === "activity" ? "activityLogs-tab--active" : ""
                  }`}
                  onClick={() => setActiveTab("activity")}
                >
                  Activity Logs
                </button>
                <button
                  className={`activityLogs-tab ${
                    activeTab === "transaction" ? "activityLogs-tab--active" : ""
                  }`}
                  onClick={() => setActiveTab("transaction")}
                >
                  Transaction Logs
                </button>
              </div>

              {/* Filter Bar - Right Side */}
              {!isLoading && (
                <div className={`activityLogs-filterBar ${isFilterOpen ? "open" : "collapsed"}`}>
                  <button
                    className="activityLogs-filter-toggle-btn"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                  >
                    <FaFilter />
                    <span className="activityLogs-period-text">{currentPeriodText}</span>
                  </button>

                  <div className="activityLogs-filter-item">
                    <span>Period:</span>
                    <select
                      className="activityLogs-select"
                      value={dateFilter}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "custom") {
                          setIsCustomModalOpen(true);
                        } else {
                          setDateFilter(value);
                        }
                      }}
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div className="activityLogs-filter-item">
                    <div className="activityLogs-search-wrapper">
                      <FaSearch className="activityLogs-search-icon" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="activityLogs-search-input"
                      />
                    </div>
                  </div>



                  <button
                    className="activityLogs-clearBtn"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            {/* Render Content Based on Active Tab */}
            {renderContent()}
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

export default BlockchainActivityLogs;