import React, { useState, useMemo, useEffect } from "react";
import { FaEdit, FaTrash, FaPlus, FaFilter, FaSearch, FaClipboardList, FaDollarSign, FaExclamationTriangle, FaBoxes, FaUserTie } from "react-icons/fa";
import "./spillage.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import DataTable from "react-data-table-component";
import SpillageDetailsModal from "./modals/detailSpillageModal";
import LogSpillageModal from "./modals/logSpillageModal";
import EditSpillageModal from "./modals/editSpillageModal";
import DeleteSpillageModal from "./modals/deleteSpillageModal";
import CustomDateModal from "../shared/customDateModal";
import Loading from "../shared/loading";
import { toast } from 'react-toastify';
import { UnableToLoadData, NoData } from "../shared/exportModal";
import '../../confirmAlertCustom.css';
import {
  startOfToday,
  startOfMonth,
  startOfYear,
  endOfToday,
  endOfMonth,
  endOfYear,
} from "date-fns";

function Spillage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateRange, setDateRange] = useState("thisWeek");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedSpillage, setSelectedSpillage] = useState(null);
  const [spillageData, setSpillageData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loggedByName, setLoggedByName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cashiersMap, setCashiersMap] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role) {
      setUserRole(role);
    }
  }, []);

  // Fetch cashiers and create username to full name mapping
  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://localhost:4000/users/cashiers", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const cashiers = await response.json();
          const mapping = {};
          cashiers.forEach(cashier => {
            mapping[cashier.Username] = cashier.FullName;
          });
          setCashiersMap(mapping);
        }
      } catch (error) {
        console.error("Error fetching cashiers:", error);
      }
    };

    fetchCashiers();
  }, []);

  // Fetch the logged-in user's full employee name
  useEffect(() => {
    const fetchLoggedInUserName = async () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('authToken');
      
      if (username && token) {
        try {
          const response = await fetch(
            `http://127.0.0.1:4000/users/employee_name?username=${username}`,
            {
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const employeeName = data.employee_name || username;
            setLoggedByName(employeeName);
          } else {
            setLoggedByName(username);
          }
        } catch (error) {
          console.error("Error fetching employee name:", error);
          setLoggedByName(username);
        }
      }
    };

    fetchLoggedInUserName();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await fetchSpillageData();
      } catch (error) {
        console.error("Error during data fetching:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchSpillageData = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://localhost:9003/wastelogs/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch spillage data");
      }

      const data = await response.json();
      setSpillageData(data);
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error("Error fetching spillage data:", error);
      setSpillageData([]);
      setError(error.message); // Set error message
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return [startOfToday(), endOfToday()];
      case "thisWeek":
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        return [sevenDaysAgo, now];
      case "thisMonth":
        return [startOfMonth(now), endOfMonth(now)];
      case "thisYear":
        return [startOfYear(now), endOfYear(now)];
      case "custom":
        return customStart && customEnd
          ? [new Date(customStart), new Date(customEnd)]
          : [null, null];
      default:
        return [null, null];
    }
  };

  const handleAddSpillage = (newSpillage) => {
    setSpillageData((prev) => [newSpillage, ...prev]);
    toast.success(`Spillage for "${newSpillage.product_name}" logged successfully`);
  };

  const handleUpdateSpillage = (updatedSpillage) => {
    setSpillageData((prev) =>
      prev.map((item) =>
        item.spillage_id === updatedSpillage.spillage_id ? updatedSpillage : item
      )
    );
    setSelectedSpillage(updatedSpillage);
    toast.success(`Spillage for "${updatedSpillage.product_name}" updated successfully`);
  };

  const handleDeleteSpillage = (id) => {
    const deletedItem = spillageData.find(item => item.spillage_id === id);
    setSpillageData((prev) => prev.filter((item) => item.spillage_id !== id));
    if (selectedSpillage && selectedSpillage.spillage_id === id) {
      setSelectedSpillage(null);
      setIsDetailsModalOpen(false);
    }
    if (deletedItem) {
      toast.success(`Spillage for "${deletedItem.product_name}" deleted successfully`);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setDateRange("thisWeek");
    setCustomStart("");
    setCustomEnd("");
  };

  const filteredData = useMemo(() => {
    const [start, end] = getDateRange();
    return spillageData.filter((item) => {
      const productName = item.product_name || "";
      const matchesSearch = productName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      const category = item.category || "";
      const matchesCategory =
        categoryFilter === "" ||
        category.toLowerCase() === categoryFilter.toLowerCase();
      
      const itemDate = new Date(item.spillage_date);
      const matchesDate =
        !start || !end || (itemDate >= start && itemDate <= end);

      const matchesLoggedBy =
        userRole !== 'manager' || (item.logged_by && item.logged_by === loggedByName);
      
      return matchesSearch && matchesCategory && matchesDate && matchesLoggedBy;
    });
  }, [spillageData, searchTerm, categoryFilter, dateRange, customStart, customEnd, userRole, loggedByName]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalReports = filteredData.length;
    
    const totalEstimatedCost = filteredData.reduce((sum, item) => 
      sum + (parseFloat(item.estimated_cost) || 0), 0
    );
    
    // Most frequent cause
    const reasonCount = {};
    filteredData.forEach(item => {
      const reason = item.reason || "Unknown";
      reasonCount[reason] = (reasonCount[reason] || 0) + 1;
    });
    const mostFrequentCause = Object.keys(reasonCount).length > 0
      ? Object.entries(reasonCount).reduce((a, b) => a[1] > b[1] ? a : b)[0]
      : "N/A";
    const mostFrequentCount = reasonCount[mostFrequentCause] || 0;
    
    const totalItemsWasted = filteredData.reduce((sum, item) => 
      sum + (parseInt(item.quantity) || 0), 0
    );
    
    // Staff most involved - use full name from cashiersMap
    const staffCount = {};
    filteredData.forEach(item => {
      const cashierUsername = item.cashier_name || "Unknown";
      const cashierFullName = cashiersMap[cashierUsername] || cashierUsername;
      staffCount[cashierFullName] = (staffCount[cashierFullName] || 0) + 1;
    });
    const staffMostInvolved = Object.keys(staffCount).length > 0
      ? Object.entries(staffCount).reduce((a, b) => a[1] > b[1] ? a : b)[0]
      : "N/A";
    const staffMostInvolvedCount = staffCount[staffMostInvolved] || 0;
    
    return {
      totalReports,
      totalEstimatedCost,
      mostFrequentCause,
      mostFrequentCount,
      totalItemsWasted,
      staffMostInvolved,
      staffMostInvolvedCount
    };
  }, [filteredData, cashiersMap]);

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  const uniqueCategories = useMemo(() => {
    return [...new Set(spillageData.map((item) => item.category).filter(Boolean))];
  }, [spillageData]);

  const columns = useMemo(() => {
    const baseColumns = [
      {
        name: "PRODUCT",
        selector: (row) => row.product_name,
        cell: (row) => (
          <div>
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>
              {row.product_name}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              Qty: {row.quantity}
            </div>
          </div>
        ),
        sortable: true,
        width: "16%",
      },
      { 
        name: "CATEGORY", 
        selector: (row) => row.category, 
        sortable: true, 
        width: "16%",
        center: true,
      },
      {
        name: "CASHIER",
        selector: (row) => cashiersMap[row.cashier_name] || row.cashier_name,
        sortable: true,
        width: "16%",
        center: true,
      },
      {
        name: "DATE",
        selector: (row) => {
          const d = new Date(row.spillage_date);
          return d.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        },
        sortable: true,
        width: "16%",
        center: true,
      },
      { 
        name: "REASON", 
        selector: (row) => row.reason, 
        width: "20%",
        center: true,
      },
      {
        name: "LOGGED BY",
        selector: (row) => row.logged_by,
        sortable: true,
        width: "16%",
        center: true,
      },
    ];
    return baseColumns;
  }, [cashiersMap]);

  return (
    <div className="mSpillage-page">
      <Sidebar />
      <div className="mSpillage">
        <Header pageTitle="Spillage Management" />
        <div className="mSpillage-content">
          {/* Filter and Button - Always visible */}
          <div className="mSpillage-filter-wrapper">
            <div className={`mSpillage-filter-bar ${isFilterOpen ? "open" : "collapsed"}`}>
              <button
                className="mSpillage-filter-toggle-btn"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <FaFilter />
              </button>

              <div className="mSpillage-filter-item">
                <div className="mSpillage-search-wrapper">
                  <FaSearch className="mSpillage-search-icon" />
                  <input
                    type="text"
                    placeholder="Search by Product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mSpillage-search-input"
                  />
                </div>
              </div>

              <div className="mSpillage-filter-item">
                <span>Date Range:</span>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateRange(v);
                    if (v === "custom") setIsCustomModalOpen(true);
                  }}
                  className="mSpillage-select"
                >
                  <option value="today">Today</option>
                  <option value="thisWeek">This Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="thisYear">This Year</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="mSpillage-filter-item">
                <span>Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="mSpillage-select"
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <button className="mSpillage-clear-btn" onClick={handleClearFilters}>
                Clear Filters
              </button>
            </div>
              
            {userRole !== 'admin' && (
              <button
                className="mSpillage-add-btn"
                onClick={() => setIsLogModalOpen(true)}
              >
                <FaPlus /> Log Spillage
              </button>
            )}
          </div>

          {/* Content area with loading/error/data states */}
          {isLoading ? (
            <Loading />
          ) : error ? (
            <UnableToLoadData />
          ) : spillageData.length === 0 ? (
            <NoData />
          ) : (
            <>
              {/* Summary Cards */}
              {filteredData.length > 0 && (
                <div className="mSpillage-cards-container">
                  <div className="mSpillage-stat-card">
                    <div className="mSpillage-card-icon mSpillage-icon-blue">
                      <FaClipboardList />
                    </div>
                    <div className="mSpillage-card-content">
                      <div className="mSpillage-card-label">TOTAL REPORTS</div>
                      <div className="mSpillage-card-value">{summary.totalReports}</div>
                    </div>
                  </div>

                  <div className="mSpillage-stat-card">
                    <div className="mSpillage-card-icon mSpillage-icon-red">
                      <FaDollarSign />
                    </div>
                    <div className="mSpillage-card-content">
                      <div className="mSpillage-card-label">TOTAL ESTIMATED COST</div>
                      <div className="mSpillage-card-value">{formatCurrency(summary.totalEstimatedCost)}</div>
                    </div>
                  </div>

                  <div className="mSpillage-stat-card">
                    <div className="mSpillage-card-icon mSpillage-icon-orange">
                      <FaExclamationTriangle />
                    </div>
                    <div className="mSpillage-card-content">
                      <div className="mSpillage-card-label">MOST FREQUENT CAUSE</div>
                      <div className="mSpillage-card-value" style={{ fontSize: "16px" }}>
                        {summary.mostFrequentCause.length > 25 
                          ? summary.mostFrequentCause.substring(0, 25) + "..." 
                          : summary.mostFrequentCause}
                      </div>
                      <div className="mSpillage-card-subvalue">
                        {summary.mostFrequentCount} {summary.mostFrequentCount === 1 ? 'incident' : 'incidents'}
                      </div>
                    </div>
                  </div>

                  <div className="mSpillage-stat-card">
                    <div className="mSpillage-card-icon mSpillage-icon-purple">
                      <FaBoxes />
                    </div>
                    <div className="mSpillage-card-content">
                      <div className="mSpillage-card-label">TOTAL ITEMS WASTED</div>
                      <div className="mSpillage-card-value">{summary.totalItemsWasted}</div>
                    </div>
                  </div>

                  <div className="mSpillage-stat-card">
                    <div className="mSpillage-card-icon mSpillage-icon-teal">
                      <FaUserTie />
                    </div>
                    <div className="mSpillage-card-content">
                      <div className="mSpillage-card-label">STAFF MOST INVOLVED</div>
                      <div className="mSpillage-card-value" style={{ fontSize: "18px" }}>
                        {summary.staffMostInvolved}
                      </div>
                      <div className="mSpillage-card-subvalue">
                        {summary.staffMostInvolvedCount} {summary.staffMostInvolvedCount === 1 ? 'report' : 'reports'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mSpillage-table-container">
                <DataTable
                  columns={columns}
                  data={filteredData}
                  striped
                  highlightOnHover
                  responsive
                  pagination
                  paginationPerPage={8}
                  paginationRowsPerPageOptions={[8]}
                  fixedHeader
                  fixedHeaderScrollHeight="60vh"
                  pointerOnHover
                  onRowClicked={(row) => {
                    setSelectedSpillage(row);
                    setIsDetailsModalOpen(true);
                  }}
                  noDataComponent={
                    <div style={{ padding: "24px" }}>No spillage logs found.</div>
                  }
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
              </div>
            </>
          )}

          {/* Modals */}
          <SpillageDetailsModal
            show={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            spillage={selectedSpillage}
            userRole={userRole}
            cashiersMap={cashiersMap}
            onEdit={() => {
              setIsDetailsModalOpen(false);
              setIsEditModalOpen(true);
            }}
            onDelete={() => {
              setIsDetailsModalOpen(false);
              setIsDeleteModalOpen(true);
            }}
          />
          <LogSpillageModal
            show={isLogModalOpen}
            onClose={() => setIsLogModalOpen(false)}
            onSave={handleAddSpillage}
            loggedByName={loggedByName}
          />
          {isEditModalOpen && selectedSpillage && (
            <EditSpillageModal
              spillage={selectedSpillage}
              onClose={() => setIsEditModalOpen(false)}
              onUpdate={handleUpdateSpillage}
              loggedByName={loggedByName}
            />
          )}
          {isDeleteModalOpen && selectedSpillage && (
            <DeleteSpillageModal
              show={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              onConfirm={handleDeleteSpillage}
              spillage={selectedSpillage}
            />
          )}
        </div>
      </div>
      <CustomDateModal
        show={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onApply={(s, e) => {
          setCustomStart(s);
          setCustomEnd(e);
        }}
      />
    </div>
  );
}

export default Spillage;