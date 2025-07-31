import React, { useState, useEffect, useCallback } from "react";
// useNavigate is not used in this version, but can be kept for future use
// import { useNavigate } from "react-router-dom";
import "../admin/discounts.css";
import Sidebar from "../sidebar";
import Header from "../admin/header";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import DataTable from "react-data-table-component";
import DiscountModal from "../admin/discountModal";
import PromotionModal from "../admin/promotionModal";

// --- API Configuration ---
const API_BASE_URL = "http://localhost:9002/api"; // Your Discount Service URL

// --- API Helper Function ---
// A reusable wrapper for fetch that adds auth headers and handles errors
const apiFetch = async (endpoint, method = 'GET', body = null) => {
  const token = localStorage.getItem('authToken'); // Assuming token is stored in localStorage
  if (!token) {
    throw new Error('Authentication token not found. Please log in.');
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || 'An unknown API error occurred.');
  }

  if (response.status === 204 || (response.status === 200 && response.headers.get('content-length') === '0')) {
    return null;
  }

  return response.json();
};


function Discounts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const today = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState("discounts");

  // --- State Initialization (No more sample data) ---
  const [discounts, setDiscounts] = useState([]);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(false);
  const [errorDiscounts, setErrorDiscounts] = useState(null);

  const [promotions, setPromotions] = useState([]);
  // const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);

  const [availableProducts, setAvailableProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoadingChoices, setIsLoadingChoices] = useState(false);
  const [errorChoices, setErrorChoices] = useState(null);

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);

  // Form states remain the same
  const [discountForm, setDiscountForm] = useState({
    discountName: '',
    applicationType: 'all_products',
    selectedCategories: [],
    selectedProducts: [],
    discountType: 'percentage',
    discountValue: '',
    minSpend: '',
    validFrom: '',
    validTo: '',
    status: 'active'
  });

  // --- REAL API Fetching Functions ---
  const fetchDiscounts = useCallback(async () => {
    setIsLoadingDiscounts(true);
    setErrorDiscounts(null);
    try {
      const data = await apiFetch('/discounts/');
      setDiscounts(data);
    } catch (error) {
      console.error("Failed to fetch discounts:", error);
      setErrorDiscounts(error.message);
    } finally {
      setIsLoadingDiscounts(false);
    }
  }, []);

  const fetchChoices = useCallback(async () => {
    setIsLoadingChoices(true);
    setErrorChoices(null);
    try {
      const [productsData, categoriesData] = await Promise.all([
        apiFetch('/available-products'),
        apiFetch('/available-categories')
      ]);
      setAvailableProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Failed to fetch products/categories:", error);
      setErrorChoices(error.message);
    } finally {
      setIsLoadingChoices(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchDiscounts();
    fetchChoices();
  }, [fetchDiscounts, fetchChoices]);

  // --- Modal Handlers ---
  const handleDiscountModalOpen = useCallback(async (discount = null) => {
    if (discount) {
      try {
        const detailedDiscount = await apiFetch(`/discounts/${discount.id}`);
        setDiscountForm(detailedDiscount);
        setEditingDiscountId(detailedDiscount.id);
      } catch (error) {
        alert(`Error fetching discount details: ${error.message}`);
        return;
      }
    } else {
      setEditingDiscountId(null);
      setDiscountForm({
        discountName: '',
        applicationType: 'all_products',
        selectedCategories: [],
        selectedProducts: [],
        discountType: 'percentage',
        discountValue: '',
        minSpend: '',
        validFrom: today,
        validTo: '',
        status: 'active'
      });
    }
    setShowDiscountModal(true);
  }, [today]);

  // --- FORM HANDLERS ---
  const handleDiscountFormChange = (e) => {
    const { name, value } = e.target;
    setDiscountForm(prev => ({ ...prev, [name]: value }));
  };

  // *** THIS IS THE CORRECTED FUNCTION ***
  // It now correctly accepts the array of strings from the modal.
  const handleMultiSelectChange = (name, newValue) => {
    setDiscountForm(prev => ({
      ...prev,
      [name]: newValue,
    }));
  };
  
  // --- REAL Save/Delete Handlers ---
  const handleSaveDiscount = async () => {
    if (!discountForm.discountName.trim()) {
      alert("Please enter a discount name.");
      return;
    }
    if (new Date(discountForm.validFrom) >= new Date(discountForm.validTo)) {
        alert("'Valid From' must be before 'Valid To'");
        return;
    }

    setIsSavingDiscount(true);

    const isEditing = !!editingDiscountId;
    const endpoint = isEditing ? `/discounts/${editingDiscountId}` : '/discounts/';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      await apiFetch(endpoint, method, discountForm);
      alert(`Discount '${discountForm.discountName}' saved successfully.`);
      setShowDiscountModal(false);
      fetchDiscounts();
    } catch (error) {
      alert(`Error saving discount: ${error.message}`);
    } finally {
      setIsSavingDiscount(false);
    }
  };
  
  const handleDeleteDiscount = async (discountId) => {
    if (!window.confirm("Are you sure you want to delete this discount?")) {
      return;
    }
    try {
        await apiFetch(`/discounts/${discountId}`, 'DELETE');
        alert("Discount deleted successfully.");
        fetchDiscounts();
    } catch (error) {
        alert(`Error deleting discount: ${error.message}`);
    }
  };

  // --- Filtering ---
  const filteredDiscounts = discounts.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === "" || d.status.toLowerCase() === statusFilter.toLowerCase())
  );
  
  const filteredPromotions = promotions;

  // --- Column Definitions ---
  const discountColumns = [
    { name: "NAME", selector: row => row.name, sortable: true, minWidth: "150px" },
    { name: "DISCOUNT", selector: row => row.discount, sortable: true, minWidth: "100px" },
    { name: "MIN SPEND", selector: row => `₱${row.minSpend.toFixed(2)}`, sortable: true, minWidth: "120px" },
    { name: "APPLICATION", selector: row => row.application, minWidth: "150px" },
    { name: "VALIDITY", selector: row => `${row.validFrom} - ${row.validTo}`, minWidth: "200px" },
    { name: "STATUS", selector: row => row.status, sortable: true,
      cell: row => (<span className={`status-badge ${row.status.toLowerCase()}`}>{row.status.toUpperCase()}</span>),
      minWidth: "100px"
    },
    { name: "ACTIONS",
      cell: row => (
        <div className="action-buttons">
          <button className="edit-btn" onClick={() => handleDiscountModalOpen(row)} title="Edit"><FaEdit /></button>
          <button className="delete-btn" onClick={() => handleDeleteDiscount(row.id)} title="Delete"><FaTrash /></button>
        </div>
      ),
      ignoreRowClick: true, allowOverflow: true, button: true, minWidth: "120px"
    }
  ];

  const promotionColumns = [ /* ... promotion columns ... */ ];

  return (
    <div className="mng-discounts">
      <Sidebar />
      <div className="discounts">
        <Header pageTitle="Manage Discounts & Promotions" />
        <div className="discounts-admin-content">
          <div className="tabs">
            <button className={`tab ${activeTab === "discounts" ? "active-tab" : ""}`} onClick={() => setActiveTab("discounts")}>Discounts</button>
            <button className={`tab ${activeTab === "promotions" ? "active-tab" : ""}`} onClick={() => setActiveTab("promotions")}>Promotions</button>
          </div>

          {activeTab === "discounts" && (
            <>
              <div className="filter-bar">
                 <input
                  type="text"
                  className="search-input"
                  placeholder="Search Discount Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select 
                  className="filter-select"
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="expired">Expired</option>
                </select>
                <button className="add-btn" onClick={() => handleDiscountModalOpen()}><FaPlus /> Add Discount</button>
              </div>

              {isLoadingDiscounts ? (
                <div className="loading">Loading discounts...</div>
              ) : errorDiscounts ? (
                <div className="error">Error: {errorDiscounts}</div>
              ) : (
                <DataTable
                  columns={discountColumns}
                  data={filteredDiscounts}
                  pagination striped highlightOnHover
                  noDataComponent="No discounts found"
                  customStyles={{
                    headCells: { style: { backgroundColor: "#4B929D", color: "#fff", fontWeight: "600", fontSize: "14px", padding: "12px", textTransform: "uppercase" } },
                    rows: { style: { minHeight: "55px", padding: "5px" } },
                  }}
                />
              )}
            </>
          )}

          {activeTab === "promotions" && (
            <div className="placeholder-content">
              <h3>Promotions</h3>
              <p>Promotions management is not yet connected to the backend.</p>
            </div>
          )}

          <DiscountModal
            showModal={showDiscountModal}
            onClose={() => setShowDiscountModal(false)}
            editingId={editingDiscountId}
            form={discountForm}
            onFormChange={handleDiscountFormChange}
            onMultiSelectChange={handleMultiSelectChange}
            onSave={handleSaveDiscount}
            isSaving={isSavingDiscount}
            availableProducts={availableProducts}
            categories={categories}
            today={today}
            isLoadingChoices={isLoadingChoices}
            errorChoices={errorChoices}
          />
          
          {/* PromotionModal can be left as is for now */}
        </div>
      </div>
    </div>
  );
}

export default Discounts;