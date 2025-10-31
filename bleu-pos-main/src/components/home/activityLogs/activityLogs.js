import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./activityLogs.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import { FaUser, FaTrash, FaCheck, FaEnvelope, FaPhone, FaFilter, FaSearch } from "react-icons/fa";
import Lottie from "lottie-react";
import loadingAnimation from "../../../assets/animation/loading.json";

// Sample activity data matching your image
const activityData = [
  {
    id: 1,
    timestamp: "11-16-2023 4:27 pm",
    title: "Accessing the Account Delete",
    icon: "user",
    iconColor: "#3b82f6",
    events: [
      {
        timestamp: "11-16-2023 4:37 pm",
        type: "success",
        message: "The user 'ABC' Successful event after correct password confirmation"
      },
      {
        timestamp: "11-16-2023 4:37 pm",
        type: "error",
        message: "The user 'ABC' Failed event after wrong password confirmation"
      }
    ]
  },
  {
    id: 2,
    timestamp: "11-16-2023 4:27 pm",
    title: "Delete Process",
    icon: "trash",
    iconColor: "#ef4444",
    events: [
      {
        timestamp: "11-16-2023 4:37 pm",
        type: "success",
        message: "The user 'ABC' Success of below verifications."
      }
    ],
    subEvents: [
      {
        timestamp: "11-16-2023 4:27 pm",
        icon: "email",
        type: "success",
        message: "Email Verification"
      },
      {
        timestamp: "11-16-2023 4:27 pm",
        icon: "phone",
        type: "error",
        message: "Phone Number Verification Rejected"
      }
    ],
    finalEvent: {
      timestamp: "11-16-2023 4:37 pm",
      type: "error",
      message: "The user 'ABC' Failure of final delete event from the respective Seebiz Product."
    }
  },
  {
    id: 3,
    timestamp: "11-16-2023 4:38 pm",
    title: "Password Change",
    icon: "check",
    iconColor: "#3b82f6",
    events: []
  }
];

function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleClearFilters = () => {
    setSearchTerm("");
    setDateFilter("");
    setTypeFilter("");
  };

  const getIcon = (iconType) => {
    switch (iconType) {
      case "user":
        return <FaUser className="activityLogs-icon-white" />;
      case "trash":
        return <FaTrash className="activityLogs-icon-white" />;
      case "check":
        return <FaCheck className="activityLogs-icon-white" />;
      case "email":
        return <FaEnvelope className="activityLogs-icon-success" />;
      case "phone":
        return <FaPhone className="activityLogs-icon-error" />;
      default:
        return null;
    }
  };

  return (
    <div className="activityLogs">
      <Sidebar />
      <div className="activityLogs-container">
        <Header pageTitle="Activity Logs" />

        <div className="activityLogs-content">
          {/* Filter Bar */}
          <div className={`activityLogs-filterBar ${isFilterOpen ? "open" : "collapsed"}`}>
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
              <span>Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="activityLogs-select"
              >
                <option value="">All Dates</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            <div className="activityLogs-filter-item">
              <span>Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="activityLogs-select"
              >
                <option value="">All Types</option>
                <option value="user">User Actions</option>
                <option value="delete">Delete Process</option>
                <option value="password">Password Change</option>
              </select>
            </div>

            <button 
              className="activityLogs-clearBtn" 
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-bg">
                <Lottie animationData={loadingAnimation} loop={true} className="loading-animation" />
              </div>
            </div>
          ) : (
            /* Timeline */
            <div className="activityLogs-timeline">
              <div className="activityLogs-timeline-line"></div>

              {activityData.map((activity) => (
                <div key={activity.id} className="activityLogs-activity-item">
                  {/* Main Activity */}
                  <div className="activityLogs-activity-header">
                    {/* Icon Circle */}
                    <div
                      className="activityLogs-icon-circle"
                      style={{ backgroundColor: activity.iconColor }}
                    >
                      {getIcon(activity.icon)}
                    </div>

                    {/* Content */}
                    <div className="activityLogs-activity-content">
                      <div className="activityLogs-activity-title-row">
                        <span className="activityLogs-timestamp">{activity.timestamp}</span>
                        <h3 className="activityLogs-activity-title">{activity.title}</h3>
                      </div>

                      {/* Events */}
                      {activity.events.map((event, eventIndex) => (
                        <div key={eventIndex} className="activityLogs-event-item">
                          <div className="activityLogs-event-dot"></div>
                          <div className="activityLogs-event-content">
                            <div className="activityLogs-event-timestamp">{event.timestamp}</div>
                            <div className={`activityLogs-event-message ${event.type === "success" ? "activityLogs-event-success" : "activityLogs-event-error"}`}>
                              {event.message}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Sub Events */}
                      {activity.subEvents && activity.subEvents.map((subEvent, subIndex) => (
                        <div key={subIndex} className="activityLogs-subevent-item">
                          <div className={`activityLogs-subevent-dot ${subEvent.type === "success" ? "activityLogs-subevent-success" : "activityLogs-subevent-error"}`}></div>
                          <div className="activityLogs-subevent-content">
                            <div className="activityLogs-subevent-timestamp">{subEvent.timestamp}</div>
                            <div className="activityLogs-subevent-message">
                              {getIcon(subEvent.icon)}
                              <span>{subEvent.message}</span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Final Event */}
                      {activity.finalEvent && (
                        <div className="activityLogs-event-item">
                          <div className="activityLogs-event-dot"></div>
                          <div className="activityLogs-event-content">
                            <div className="activityLogs-event-timestamp">{activity.finalEvent.timestamp}</div>
                            <div className={`activityLogs-event-message ${activity.finalEvent.type === "success" ? "activityLogs-event-success" : "activityLogs-event-error"}`}>
                              {activity.finalEvent.message}
                            </div>
                          </div>
                        </div>
                      )}
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

export default ActivityLogs;