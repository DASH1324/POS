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
} from "react-icons/fa";
import Lottie from "lottie-react";
import loadingAnimation from "../../../assets/animation/loading.json";
import axios from "axios";

const BLOCKCHAIN_API_URL = "http://localhost:9005/blockchain";
const USER_API_URL = "http://127.0.0.1:4000/users";

function BlockchainActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [groupedLogs, setGroupedLogs] = useState([]);
  const [error, setError] = useState(null);
  
  // State to store the mapping of username -> FullName
  const [actorNameMap, setActorNameMap] = useState({});

  // Fetch blockchain logs
  useEffect(() => {
    fetchLogs();
  }, [serviceFilter, entityTypeFilter, actionFilter]);

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

  const handleClearFilters = () => {
    setSearchTerm("");
    setServiceFilter("");
    setEntityTypeFilter("");
    setActionFilter("");
  };

  const getServiceIcon = (service) => {
    switch (service) {
      case "DISCOUNTS_SERVICE":
        return <FaTag className="activityLogs-icon-white" />;
      case "POS_SALES":
        return <FaShoppingCart className="activityLogs-icon-white" />;
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
      POS_SALES: "#10b981",
      PRODUCTS_SERVICE: "#f59e0b",
      INVENTORY_SERVICE: "#8b5cf6",
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
      default:
        return "";
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
    const entityName =
      group.events[0]?.data?.name ||
      group.events[0]?.change_description?.split(":")[1]?.trim() ||
      `${group.entityType} #${group.entityId}`;
    return `${group.entityType}: ${entityName}`;
  };

  // Filter groups by search term
  const filteredGroups = groupedLogs.filter((group) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const entityTitle = getEntityTitle(group).toLowerCase();
    
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

  return (
    <div className="activityLogs">
      <Sidebar />
      <div className="activityLogs-container">
        <Header pageTitle="Blockchain Activity Logs" />

        <div className="activityLogs-content">
          {/* Filter Bar */}
          <div
            className={`activityLogs-filterBar ${
              isFilterOpen ? "open" : "collapsed"
            }`}
          >
            <button
              className="activityLogs-filter-toggle-btn"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter />
            </button>

            <div className="activityLogs-filter-item">
              <div className="activityLogs-search-wrapper">
                <FaSearch className="activityLogs-search-icon" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="activityLogs-search-input"
                />
              </div>
            </div>

            <div className="activityLogs-filter-item">
              <span>Service:</span>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="activityLogs-select"
              >
                <option value="">All Services</option>
                <option value="DISCOUNTS_SERVICE">Discounts</option>
                <option value="POS_SALES">POS Sales</option>
                <option value="PRODUCTS_SERVICE">Products</option>
                <option value="INVENTORY_SERVICE">Inventory</option>
              </select>
            </div>

            <div className="activityLogs-filter-item">
              <span>Entity:</span>
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="activityLogs-select"
              >
                <option value="">All Types</option>
                <option value="Discount">Discount</option>
                <option value="Sale">Sale</option>
                <option value="Product">Product</option>
                <option value="Inventory">Inventory</option>
              </select>
            </div>

            <div className="activityLogs-filter-item">
              <span>Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="activityLogs-select"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>
            </div>

            <button
              className="activityLogs-clearBtn"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="activityLogs-error">
              <p>{error}</p>
              <button onClick={fetchLogs}>Retry</button>
            </div>
          )}

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
          ) : filteredGroups.length === 0 ? (
            <div className="activityLogs-empty">
              <p>No activity logs found</p>
            </div>
          ) : (
            /* Timeline */
            <div className="activityLogs-timeline">
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
                                {event.action.toLowerCase()}d:{" "}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlockchainActivityLogs;