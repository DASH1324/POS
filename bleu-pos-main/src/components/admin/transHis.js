import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/transHis.css";
import Sidebar from "../sidebar";
import Header from "../admin/header";
import DataTable from "react-data-table-component";

const getAuthToken = () => localStorage.getItem("authToken");

// --- CHANGED: Define the API URL for easy access
const API_URL = "http://127.0.0.1:9000/auth/purchase_orders/all";

// --- CHANGED: Create a function to transform API data into the format the component expects
const transformApiData = (apiTransaction) => {
  // Calculate the subtotal from the order items
  const subtotal = apiTransaction.orderItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  // Calculate the discount amount
  const discount = subtotal - apiTransaction.total;

  return {
    id: apiTransaction.id,
    // Convert the API's friendly date string to a standard ISO string for reliable filtering/sorting
    date: new Date(apiTransaction.date).toISOString(), 
    orderType: apiTransaction.orderType,
    // Map the API's `orderItems` to the `items` array the component uses
    items: apiTransaction.orderItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      details: item.addons && Object.values(item.addons).some(v => v > 0) 
        ? "Includes add-ons" 
        : undefined,
    })),
    total: apiTransaction.total,
    subtotal: subtotal,
    discount: discount,
    // Normalize status to start with a capital letter, like the sample data
    status: apiTransaction.status.charAt(0).toUpperCase() + apiTransaction.status.slice(1),
    paymentMethod: apiTransaction.paymentMethod,
    // The '/all' endpoint is for store transactions. We can set the type here.
    type: "store", 
    // The API doesn't provide detailed discount names, so we'll provide a default
    discountsAndPromotions: discount > 0 ? "Discount Applied" : "None",
    // Keep the original fields for the modal
    cashierName: apiTransaction.cashierName,
    GCashReferenceNumber: apiTransaction.GCashReferenceNumber,
  };
};


function TransactionHistory() {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState("store");
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  // --- REMOVED: The old sampleTransactions array is no longer needed ---

  // --- CHANGED: Updated fetchTransactions to call the real API
  const fetchTransactions = useCallback(async (token) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the API data before setting the state
      const transformedData = data.map(transformApiData);
      setTransactions(transformedData);

    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      setError("Failed to load transaction data. Please check the connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []); // The URL is constant, so no dependencies needed here

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate('/');
      return;
    }
    fetchTransactions(token);
  }, [navigate, fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    // This filtering logic now works perfectly with the transformed data
    return transactions.filter(transaction => {
      // For this implementation, all transactions are 'store' type from the '/all' endpoint
      const matchesTab = activeTab === "store"; 
      const matchesSearch = (transaction.id || '').toString().toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "" || transaction.status === statusFilter;

      const transactionDate = new Date(transaction.date).toISOString().slice(0, 10);
      const matchesDate = filterDate === "" || transactionDate === filterDate;

      return matchesTab && matchesSearch && matchesStatus && matchesDate;
    });
  }, [activeTab, transactions, searchTerm, statusFilter, filterDate]);

  useEffect(() => {
    setStatusFilter("");
    setSearchTerm("");
    setFilterDate("");
  }, [activeTab]);

  const uniqueStatuses = useMemo(() => {
    return [...new Set(transactions.map(item => item.status).filter(Boolean))];
  }, [transactions]);


  const handleRowClick = (row) => {
    setSelectedTransaction(row);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const columns = [
    {
      name: "TRANSACTION ID",
      selector: (row) => row.id,
      sortable: true,
      width: "17%",
    },
    {
      name: "DATE",
      selector: (row) => new Date(row.date).toLocaleDateString(),
      sortable: true,
      width: "17%",
    },
    {
      name: "ITEMS",
      selector: (row) => row.items?.length || 0,
      center: true,
      width: "17%",
    },
    {
      name: "TOTAL",
      selector: (row) => `₱${parseFloat(row.total).toFixed(2)}`,
      center: true,
      sortable: true,
      width: "17%",
    },
    {
      name: "STATUS",
      selector: (row) => row.status,
      cell: (row) => (
        <span className={`status-badge ${row.status.toLowerCase()}`}>
          {row.status}
        </span>
      ),
      center: true,
      sortable: true,
      width: "16%",
    },
    {
      name: "PAYMENT METHOD",
      selector: (row) => row.paymentMethod || "N/A",
      center: true,
      width: "16%",
    },
  ];

  return (
    <div className='transaction-history'>
      <Sidebar />
      <div className='transHis'>
        <Header pageTitle="Transaction History" />
        
        <div className="transHis-content">
          <div className="tabs">
            {/* The online tab is kept for UI but will show no data until its API is added */}
            <button className={`tab ${activeTab === "store" ? "active-tab" : ""}`} onClick={() => setActiveTab("store")}>Store</button>
            <button className={`tab ${activeTab === "online" ? "active-tab" : ""}`} onClick={() => setActiveTab("online")}>Online</button>
          </div>
          
          <div className="tab-content">
            <div className="filter-bar">
              <input 
                type="text" 
                placeholder="Search by Transaction ID..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
              <input 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)} 
                title="Filter by Date"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Status: All</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            
            {isLoading ? (
              <p style={{ textAlign: "center", padding: "20px" }}>Loading Transactions...</p>
            ) : error ? (
              <div style={{ color: "red", textAlign: "center", padding: "20px" }}>Error: {error}</div>
            ) : (
              <div className="transactions-table-container">
                <DataTable 
                  columns={columns} 
                  data={filteredTransactions} 
                  striped 
                  highlightOnHover 
                  responsive 
                  pagination
                  fixedHeader
                  fixedHeaderScrollHeight="60vh"
                  onRowClicked={handleRowClick}
                  pointerOnHover
                  noDataComponent={<div style={{ padding: "24px" }}>No transactions found.</div>}
                  conditionalRowStyles={[
                    {
                      when: row => selectedTransaction && row.id === selectedTransaction.id,
                      style: {
                        backgroundColor: "#e9f9ff",
                        boxShadow: "inset 0 0 0 1px #2a9fbf",
                      },
                    },
                  ]}
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
                        cursor: "pointer",
                      },
                    },
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* --- CHANGED: Modal now correctly displays API data --- */}
        {isModalOpen && selectedTransaction && (
          <div className="modal-backdrop" onClick={closeModal}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Transaction Details</h2>
                <button className="modal-close-btn" onClick={closeModal}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="modal-section">
                  <div className="modal-row">
                    <div className="modal-col">
                      <label>Order Type:</label>
                      <span>{selectedTransaction.orderType}</span>
                    </div>
                    <div className="modal-col">
                      <label>Payment Method:</label>
                      <span>{selectedTransaction.paymentMethod}</span>
                    </div>
                  </div>
                  <div className="modal-row">
                    <div className="modal-col">
                      <label>Status:</label>
                      <span>{selectedTransaction.status}</span>
                    </div>
                    <div className="modal-col">
                      <label>Date & Time:</label>
                      {/* Use the original date string for full detail */}
                      <span>{new Date(selectedTransaction.date).toLocaleString()}</span>
                    </div>
                  </div>
                   <div className="modal-row">
                      <div className="modal-col">
                        <label>Cashier:</label>
                        <span>{selectedTransaction.cashierName}</span>
                      </div>
                    </div>

                  {/* Check for the correct property name from the API */}
                  {selectedTransaction.paymentMethod === "GCash" && selectedTransaction.GCashReferenceNumber && (
                    <div className="modal-row">
                      <div className="modal-col">
                        <label>GCash Reference #:</label>
                        <span>{selectedTransaction.GCashReferenceNumber}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-section">
                  <h3>Order Items</h3>
                  <div className="items-list">
                    {selectedTransaction.items.map((item, index) => (
                      <div key={index} className="item-row">
                        <div className="item-info">
                          <div className="item-name">{item.name}</div>
                          <div className="item-qty">Qty: {item.quantity}</div>
                          {item.details && <div className="item-details">{item.details}</div>}
                        </div>
                        <div className="item-price">₱{(item.price * item.quantity).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTransaction.discountsAndPromotions !== "None" && (
                  <div className="modal-section">
                    <div className="applied-discount">
                      <label>Applied Discount</label>
                      <span className="discount-badge">{selectedTransaction.discountsAndPromotions}</span>
                    </div>
                  </div>
                )}

                <div className="modal-section">
                  <div className="bill-summary">
                    <div className="bill-row">
                      <span>Subtotal:</span>
                      <span>₱{selectedTransaction.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedTransaction.discount > 0 && (
                      <div className="bill-row discount-row">
                        <span>Discount:</span>
                        <span>-₱{selectedTransaction.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="bill-row total-row">
                      <span>Total Amount:</span>
                      <span>₱{selectedTransaction.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionHistory;