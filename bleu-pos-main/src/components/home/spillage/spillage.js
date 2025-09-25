import React, { useState, useMemo } from "react";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import "./spillage.css";
import Sidebar from "../sidebar/sidebar";
import Header from "../header/header";
import DataTable from "react-data-table-component";
import SpillageDetailsModal from "./modals/spillageDetailsModal";
import LogSpillageModal from "./modals/logSpillageModal";
import EditSpillageModal from "./modals/editSpillageModal"; 
import CustomDateModal from "../CustomDateModal";

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
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateRange, setDateRange] = useState("thisWeek");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedSpillage, setSelectedSpillage] = useState(null);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return [startOfToday(), endOfToday()];
      case "thisWeek":
        return [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })];
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

  const [spillageData, setSpillageData] = useState([
    {
      id: 1,
      productName: "Cappuccino",
      type: "Drink",
      amount: 2,
      size: "12oz",
      loggedBy: "Cashier A",
      reason: "Customer returned due to wrong order",
      date: "2025-09-20",
    },
    {
      id: 2,
      productName: "Cheeseburger",
      type: "Food",
      amount: 1,
      size: "Solo",
      loggedBy: "Cashier B",
      reason: "Dropped accidentally",
      date: "2025-09-21",
    },
    {
      id: 3,
      productName: "Latte",
      type: "Drink",
      amount: 1,
      size: "22oz",
      loggedBy: "Cashier C",
      reason: "Spilled while serving",
      date: "2025-09-22",
    },
  ]);

  const handleAddSpillage = (newSpillage) => {
    setSpillageData((prev) => [
      ...prev,
      { id: prev.length + 1, ...newSpillage },
    ]);
  };

  const handleUpdateSpillage = (updatedSpillage) => {
    setSpillageData((prev) =>
      prev.map((item) =>
        item.id === updatedSpillage.id ? updatedSpillage : item
      )
    );
    setSelectedSpillage(updatedSpillage);
  };

  const handleDeleteSpillage = (id) => {
    setSpillageData((prev) => prev.filter((item) => item.id !== id));
    if (selectedSpillage && selectedSpillage.id === id) {
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
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "" || item.type.toLowerCase() === categoryFilter.toLowerCase();
      const itemDate = new Date(item.date);
      const matchesDate = !start || !end || (itemDate >= start && itemDate <= end);
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [spillageData, searchTerm, categoryFilter, dateRange, customStart, customEnd]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(spillageData.map((item) => item.type))];
  }, [spillageData]);

  const columns = [
    { name: "PRODUCT NAME", selector: (row) => row.productName, sortable: true, width: "15%" },
    { name: "TYPE", selector: (row) => row.type, sortable: true, width: "10%" },
    { name: "AMOUNT", selector: (row) => row.amount, center: true, width: "7%" },
    { name: "SIZE", selector: (row) => row.size, center: true, width: "10%" },
    { name: "LOGGED BY", selector: (row) => row.loggedBy, center: true, sortable: true, width: "16%" },
    { name: "DATE", selector: (row) => row.date, sortable: true, width: "12%", center: true },
    { name: "REASON", selector: (row) => row.reason, center: true, width: "15%" },
    {
      name: "ACTIONS",
      cell: (row) => (
        <div className="spillage-action-buttons">
          <button
            type="button"
            className="spillage-edit-btn"
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
            className="spillage-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSpillage(row.id);
            }}
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      ),
      center: true,
      width: "15%",
    },
  ];

  return (
    <div className="spillage-page">
      <Sidebar />
      <div className="spillage">
        <Header pageTitle="Spillage Management" />
        <div className="spillage-content">
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
            <button
              className="spillage-add-btn"
              onClick={() => setIsLogModalOpen(true)}
            >
              <FaPlus /> Log Spillage
            </button>
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
              onRowClicked={(row) => {
                setSelectedSpillage(row);
                setIsDetailsModalOpen(true);
              }}
              noDataComponent={<div style={{ padding: "24px" }}>No spillage logs found.</div>}
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
            {/* 🔹 View Details Modal */}
            <SpillageDetailsModal
              show={isDetailsModalOpen}
              onClose={() => setIsDetailsModalOpen(false)}
              spillage={selectedSpillage}
              onEdit={() => {
                setIsDetailsModalOpen(false);
                setIsEditModalOpen(true); 
              }}
              onDelete={handleDeleteSpillage}
            />
            {/* 🔹 Log New Spillage Modal */}
            <LogSpillageModal
              show={isLogModalOpen}
              onClose={() => setIsLogModalOpen(false)}
              onSave={handleAddSpillage}
            />
            {/* 🔹 Edit Spillage Modal */}
            {isEditModalOpen && selectedSpillage && (
              <EditSpillageModal
                spillage={selectedSpillage}
                onClose={() => setIsEditModalOpen(false)}
                onUpdate={handleUpdateSpillage}
              />
            )}
          </div>
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
