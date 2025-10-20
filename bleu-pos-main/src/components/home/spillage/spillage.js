import React, { useState, useMemo, useEffect } from "react";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import "./spillage.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import DataTable from "react-data-table-component";
import SpillageDetailsModal from "./modals/detailSpillageModal";
import LogSpillageModal from "./modals/logSpillageModal";
import EditSpillageModal from "./modals/editSpillageModal";
import DeleteSpillageModal from "./modals/deleteSpillageModal";
import CustomDateModal from "../shared/customDateModal";
import {
  startOfToday,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfToday,
  endOfWeek,
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
  const [cashiersMap, setCashiersMap] = useState({});
  const [loggedByName, setLoggedByName] = useState(""); // Store logged-in user's full name

  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role) {
      setUserRole(role);
    }
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
            setLoggedByName(data.employee_name || username);
          } else {
            setLoggedByName(username); // Fallback to username
          }
        } catch (error) {
          console.error("Error fetching employee name:", error);
          setLoggedByName(username); // Fallback to username
        }
      }
    };

    fetchLoggedInUserName();
  }, []);

  // Fetch cashiers for mapping usernames to full names
  useEffect(() => {
    fetchCashiers();
  }, []);

  // Fetch spillage data from API
  useEffect(() => {
    fetchSpillageData();
  }, []);

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
        // Create a map of username -> full name
        const map = {};
        cashiers.forEach(c => {
          map[c.Username] = c.FullName;
        });
        setCashiersMap(map);
      }
    } catch (error) {
      console.error("Error fetching cashiers:", error);
    }
  };

  const fetchSpillageData = async () => {
    setIsLoading(true);
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
    } catch (error) {
      console.error("Error fetching spillage data:", error);
    } finally {
      setIsLoading(false);
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
  };

  const handleUpdateSpillage = (updatedSpillage) => {
    setSpillageData((prev) =>
      prev.map((item) =>
        item.spillage_id === updatedSpillage.spillage_id ? updatedSpillage : item
      )
    );
    setSelectedSpillage(updatedSpillage);
  };

  const handleDeleteSpillage = (id) => {
    setSpillageData((prev) => prev.filter((item) => item.spillage_id !== id));
    if (selectedSpillage && selectedSpillage.spillage_id === id) {
      setSelectedSpillage(null);
      setIsDetailsModalOpen(false);
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

      // **MODIFICATION START**
      // If the user is a manager, only show entries logged by them.
      const matchesLoggedBy =
        userRole !== 'manager' || (item.logged_by && item.logged_by === loggedByName);
      // **MODIFICATION END**
      
      return matchesSearch && matchesCategory && matchesDate && matchesLoggedBy; // Added matchesLoggedBy
    });
  }, [spillageData, searchTerm, categoryFilter, dateRange, customStart, customEnd, userRole, loggedByName]); // Added userRole and loggedByName to dependency array

  const uniqueCategories = useMemo(() => {
    return [...new Set(spillageData.map((item) => item.category).filter(Boolean))];
  }, [spillageData]);

  const columns = useMemo(() => {
    const baseColumns = [
      {
        name: "PRODUCT NAME",
        selector: (row) => row.product_name,
        sortable: true,
        width: "15%",
      },
      { 
        name: "CATEGORY", 
        selector: (row) => row.category, 
        sortable: true, 
        width: "10%" 
      },
      { 
        name: "QUANTITY", 
        selector: (row) => row.quantity, 
        sortable: true, 
        width: "8%",
        center: true,
      },
      {
        name: "CASHIER",
        selector: (row) => cashiersMap[row.cashier_name] || row.cashier_name,
        sortable: true,
        width: "12%",
      },
      {
        name: "DATE",
        selector: (row) => new Date(row.spillage_date).toLocaleDateString(),
        sortable: true,
        width: "10%",
        center: true,
      },
      { 
        name: "REASON", 
        selector: (row) => row.reason, 
        width: "20%",
        wrap: true,
      },
      {
        name: "LOGGED BY",
        selector: (row) => row.logged_by,
        sortable: true,
        width: "12%",
      },
      {
        name: "LOGGED AT",
        selector: (row) => new Date(row.logged_at).toLocaleString(),
        sortable: true,
        width: "13%",
      },
    ];

    if (userRole !== 'admin') {
      baseColumns.push({
        name: "ACTIONS",
        cell: (row) => (
          <div className="spillage-action-buttons">
            <button
              type="button"
              className="action-btn edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSpillage(row);
                setIsEditModalOpen(true);
              }}
              title="Edit"
            >
              <FaEdit />
            </button>
            <button
              type="button"
              className="action-btn delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSpillage(row);
                setIsDeleteModalOpen(true);
              }}
              title="Delete"
            >
              <FaTrash />
            </button>
          </div>
        ),
        center: true,
        width: "10%",
      });
    }

    return baseColumns;
  }, [userRole, cashiersMap]);

  return (
    <div className="spillage-page">
      <Sidebar />
      <div className="spillage">
        <Header pageTitle="Spillage Management" />
        <div className="spillage-filter-bar">
          <input
            type="text"
            placeholder="Search by Product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            value={dateRange}
            onChange={(e) => {
              const v = e.target.value;
              setDateRange(v);
              if (v === "custom") setIsCustomModalOpen(true);
            }}
          >
            <option value="today">Today</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
            <option value="thisYear">This Year</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Category: All</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="spillage-clear-btn" onClick={handleClearFilters}>
            Clear Filters
          </button>
          
          {userRole !== 'admin' && (
            <button
              className="spillage-add-btn"
              onClick={() => setIsLogModalOpen(true)}
            >
              <FaPlus /> Log Spillage
            </button>
          )}
        </div>
        <div className="spillage-table-container">
          <DataTable
            columns={columns}
            data={filteredData}
            striped
            highlightOnHover
            responsive
            pagination
            fixedHeader
            fixedHeaderScrollHeight="60vh"
            pointerOnHover
            progressPending={isLoading}
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
          <SpillageDetailsModal
            show={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            spillage={selectedSpillage}
            cashiersMap={cashiersMap}
            userRole={userRole}
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