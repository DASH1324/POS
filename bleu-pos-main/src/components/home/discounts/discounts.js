import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./discounts.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import DataTable from "react-data-table-component";
import DiscountModal from "./discountModal";
import PromotionModal from "./promotionModal";

const getAuthToken = () => {
  return localStorage.getItem("authToken");
};

const getUserRole = () => {
  return localStorage.getItem("userRole");
};

const API_BASE_URL = "http://localhost:9002/api";

// API Helper Function
const apiFetch = async (endpoint, method = "GET", body = null) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Authentication token not found. Please log in.");
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    
    // Attempt to parse validation error details for a more specific message
    if (response.status === 422 && Array.isArray(errorData.detail)) {
      const messages = errorData.detail.map(err => `${err.loc.slice(-1)[0]}: ${err.msg}`).join('; ');
      throw new Error(`Validation Error: ${messages}`);
    }
    
    throw new Error(errorData.detail || "An unknown API error occurred.");
  }

  if (
    response.status === 204 ||
    (response.status === 200 && response.headers.get("content-length") === "0")
  ) {
    return null;
  }

  return response.json();
};

function Discounts() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const [activeTab, setActiveTab] = useState("discounts");
  const [searchTerm, setSearchTerm] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [discounts, setDiscounts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [isLoadingChoices, setIsLoadingChoices] = useState(false);
  const [errorChoices, setErrorChoices] = useState(null);

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);

  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState(null);
  const [isSavingPromotion, setIsSavingPromotion] = useState(false);

  const [userRole, setUserRole] = useState("");

  const [discountForm, setDiscountForm] = useState({
    discountName: "",
    applicationType: "all_products",
    selectedCategories: [],
    selectedProducts: [],
    discountType: "percentage",
    discountValue: "",
    minSpend: "",
    validFrom: "",
    validTo: "",
    status: "active",
  });

  const [promotionForm, setPromotionForm] = useState({
    promotionName: "",
    description: "",
    applicationType: "all_products",
    selectedCategories: [],
    selectedProducts: [],
    promotionType: "percentage",
    promotionValue: "",
    buyQuantity: 1,
    getQuantity: 1,
    bogoDiscountType: "percentage",
    bogoDiscountValue: "",
    minQuantity: "",
    validFrom: "",
    validTo: "",
    status: "active",
  });

  const handleAuthError = () => {
    localStorage.removeItem("authToken");
    setAuthError(true);
    navigate("/");
  };

  const fetchDiscounts = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      handleAuthError();
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(false);

    try {
      const data = await apiFetch("/discounts/");
      setDiscounts(data);
    } catch (err) {
      console.error("Failed to fetch discounts:", err);
      if (err.message.includes("Authentication")) {
        handleAuthError();
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchPromotions = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      handleAuthError();
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(false);

    try {
      const data = await apiFetch("/promotions/");
      setPromotions(data);
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
      if (err.message.includes("Authentication")) {
        handleAuthError();
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchChoices = useCallback(async () => {
    setIsLoadingChoices(true);
    setErrorChoices(null);
    try {
      const [productsData, categoriesData] = await Promise.all([
        apiFetch("/available-products"),
        apiFetch("/available-categories"),
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

  useEffect(() => {
    const token = getAuthToken();
    const role = getUserRole();
    
    if (!token) {
      navigate("/");
      return;
    }
    
    setUserRole(role);
    fetchDiscounts();
    fetchPromotions();
    fetchChoices();
  }, [navigate, fetchDiscounts, fetchPromotions, fetchChoices]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setApplicationFilter("");
    setStatusFilter("");
  };

  const handleRefresh = () => {
    const token = getAuthToken();
    if (token) {
      if (activeTab === "discounts") {
        fetchDiscounts();
      } else {
        fetchPromotions();
      }
    } else {
      navigate("/");
    }
  };

  const filteredDiscounts = useMemo(() => {
    return discounts.filter(
      (d) =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (applicationFilter === "" ||
          d.application.toLowerCase().includes(applicationFilter.toLowerCase())) &&
        (statusFilter === "" || d.status.toLowerCase() === statusFilter.toLowerCase())
    );
  }, [discounts, searchTerm, applicationFilter, statusFilter]);

  const filteredPromotions = useMemo(() => {
    return promotions.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (statusFilter === "" || p.status.toLowerCase() === statusFilter.toLowerCase())
    );
  }, [promotions, searchTerm, statusFilter]);

  const uniqueApplications = useMemo(() => {
    return [
      ...new Set(
        discounts.map((item) => item.application).filter(Boolean)
      ),
    ];
  }, [discounts]);

  const uniqueStatuses = useMemo(() => {
    if (activeTab === "discounts") {
      return [
        ...new Set(discounts.map((item) => item.status).filter(Boolean)),
      ];
    } else {
      return [
        ...new Set(promotions.map((item) => item.status).filter(Boolean)),
      ];
    }
  }, [discounts, promotions, activeTab]);

  useEffect(() => {
    setApplicationFilter("");
    setStatusFilter("");
    setSearchTerm("");
  }, [activeTab]);

  const handleDiscountModalOpen = useCallback(
    async (discount = null) => {
      if (userRole === "manager") return;

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
          discountName: "",
          applicationType: "all_products",
          selectedCategories: [],
          selectedProducts: [],
          discountType: "percentage",
          discountValue: "",
          minSpend: "",
          validFrom: today,
          validTo: "",
          status: "active",
        });
      }
      setShowDiscountModal(true);
    },
    [today, userRole]
  );

  const handlePromotionModalOpen = useCallback(
    async (promotion = null) => {
      if (userRole === "manager") return;

      if (promotion) {
        try {
          const detailedPromotion = await apiFetch(`/promotions/${promotion.id}`);
          setPromotionForm(detailedPromotion);
          setEditingPromotionId(detailedPromotion.id);
        } catch (error) {
          alert(`Error fetching promotion details: ${error.message}`);
          return;
        }
      } else {
        setEditingPromotionId(null);
        setPromotionForm({
          promotionName: "",
          description: "",
          applicationType: "all_products",
          selectedCategories: [],
          selectedProducts: [],
          promotionType: "percentage",
          promotionValue: "",
          buyQuantity: 1,
          getQuantity: 1,
          bogoDiscountType: "percentage",
          bogoDiscountValue: "",
          minQuantity: "",
          validFrom: today,
          validTo: "",
          status: "active",
        });
      }
      setShowPromotionModal(true);
    },
    [today, userRole]
  );

  const handleDiscountFormChange = (e) => {
    const { name, value } = e.target;
    setDiscountForm((prev) => ({ ...prev, [name]: value }));
  };
  
  const handlePromotionFormChange = (e) => {
    const { name, value } = e.target;

    setPromotionForm(prev => {
      let newState = { ...prev, [name]: value };

      if (name === "promotionType") {
        newState.promotionValue = "";
        newState.bogoDiscountValue = "";
        newState.buyQuantity = 1;
        newState.getQuantity = 1;

        if (value === "bogo") {
          newState.applicationType = "specific_products";
          newState.selectedCategories = [];
        }
      }

      if (name === "applicationType") {
        if (value === "all_products") {
          newState.selectedProducts = [];
          newState.selectedCategories = [];
        } else if (value === "specific_products") {
          newState.selectedCategories = [];
        } else if (value === "specific_categories") {
          newState.selectedProducts = [];
        }
      }
      
      return newState;
    });
  };

  const handleMultiSelectChange = (name, newValue) => {
    setDiscountForm((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handlePromotionMultiSelectChange = (name, newValue) => {
    setPromotionForm((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleSaveDiscount = async () => {
    if (userRole === "manager") return;

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
    const endpoint = isEditing
      ? `/discounts/${editingDiscountId}`
      : "/discounts/";
    const method = isEditing ? "PUT" : "POST";

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

  // --- FIX APPLIED HERE ---
  const handleSavePromotion = async () => {
    if (userRole === "manager") return;

    // --- 1. Client-side validation ---
    if (!promotionForm.promotionName.trim()) {
      alert("Please enter a promotion name.");
      return;
    }
    if (new Date(promotionForm.validFrom) >= new Date(promotionForm.validTo)) {
      alert("'Valid From' must be before 'Valid To'");
      return;
    }
    
    // --- 2. Build the payload dynamically ---
    let payload = {
        promotionName: promotionForm.promotionName,
        description: promotionForm.description,
        promotionType: promotionForm.promotionType,
        validFrom: promotionForm.validFrom,
        validTo: promotionForm.validTo,
        status: promotionForm.status,
    };

    if (promotionForm.promotionType === 'bogo') {
        if (!promotionForm.selectedProducts || promotionForm.selectedProducts.length === 0) {
            alert("Please select at least one product for a BOGO promotion.");
            return;
        }
        payload.applicationType = 'specific_products';
        payload.selectedProducts = promotionForm.selectedProducts;
        payload.buyQuantity = promotionForm.buyQuantity;
        payload.getQuantity = promotionForm.getQuantity;
        payload.bogoDiscountType = promotionForm.bogoDiscountType;
        payload.bogoDiscountValue = promotionForm.bogoDiscountValue;
    } else { // For 'percentage' or 'fixed'
        payload.applicationType = promotionForm.applicationType;
        payload.promotionValue = promotionForm.promotionValue;

        if (promotionForm.applicationType === 'specific_products') {
            if (!promotionForm.selectedProducts || promotionForm.selectedProducts.length === 0) {
                alert("Please select at least one product for this application type.");
                return;
            }
            payload.selectedProducts = promotionForm.selectedProducts;
            payload.selectedCategories = [];
        } else if (promotionForm.applicationType === 'specific_categories') {
            if (!promotionForm.selectedCategories || promotionForm.selectedCategories.length === 0) {
                alert("Please select at least one category for this application type.");
                return;
            }
            payload.selectedCategories = promotionForm.selectedCategories;
            payload.selectedProducts = [];
        } else { // all_products
            payload.selectedProducts = [];
            payload.selectedCategories = [];
        }

        if (promotionForm.minQuantity) {
            payload.minQuantity = promotionForm.minQuantity;
        }
    }

    setIsSavingPromotion(true);

    const isEditing = !!editingPromotionId;
    const endpoint = isEditing ? `/promotions/${editingPromotionId}` : "/promotions/";
    const method = isEditing ? "PUT" : "POST";

    try {
      // --- 3. Send the clean payload ---
      await apiFetch(endpoint, method, payload);
      alert(`Promotion '${promotionForm.promotionName}' saved successfully.`);
      setShowPromotionModal(false);
      fetchPromotions();
    } catch (error) {
      alert(`Error saving promotion: ${error.message}`);
    } finally {
      setIsSavingPromotion(false);
    }
  };

  const handleDeleteDiscount = async (discountId) => {
    if (userRole === "manager") return;

    if (!window.confirm("Are you sure you want to delete this discount?")) {
      return;
    }
    try {
      await apiFetch(`/discounts/${discountId}`, "DELETE");
      alert("Discount deleted successfully.");
      fetchDiscounts();
    } catch (error) {
      alert(`Error deleting discount: ${error.message}`);
    }
  };

  const handleDeletePromotion = async (promotionId) => {
    if (userRole === "manager") return;

    if (!window.confirm("Are you sure you want to delete this promotion?")) {
      return;
    }
    try {
      await apiFetch(`/promotions/${promotionId}`, "DELETE");
      alert("Promotion deleted successfully.");
      fetchPromotions();
    } catch (error) {
      alert(`Error deleting promotion: ${error.message}`);
    }
  };

  let discountColumns = [
    {
      name: "NAME",
      selector: (row) => row.name,
      sortable: true,
      width: "15%",
      center: true,
    },
    {
      name: "DISCOUNT",
      selector: (row) => row.discount,
      sortable: true,
      width: "10%",
      center: true,
    },
    {
      name: "MIN SPEND",
      selector: (row) => `₱${row.minSpend.toFixed(2)}`,
      sortable: true,
      width: "12%",
      center: true,
    },
    {
      name: "APPLICATION",
      selector: (row) => row.application,
      width: "15%",
      center: true,
    },
    {
      name: "VALIDITY",
      selector: (row) => `${row.validFrom} - ${row.validTo}`,
      width: "20%",
      center: true,
    },
    {
      name: "STATUS",
      selector: (row) => row.status,
      sortable: true,
      cell: (row) => (
        <span
          className={`mngDiscountPromo-status-badge ${row.status.toLowerCase()}`}
        >
          {row.status.toUpperCase()}
        </span>
      ),
      width: "10%",
      center: true,
    },
  ];

  if (userRole !== "manager") {
    discountColumns.push({
      name: "ACTIONS",
      cell: (row) => (
        <div className="mngDiscountPromo-action-buttons">
          <button
            className="mngDiscountPromo-edit-btn"
            onClick={() => handleDiscountModalOpen(row)}
            title="Edit"
          >
            <FaEdit />
          </button>
          <button
            className="mngDiscountPromo-delete-btn"
            onClick={() => handleDeleteDiscount(row.id)}
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: "18%",
      center: true,
    });
  }

  let promotionColumns = [
    {
      name: "NAME",
      selector: (row) => row.name,
      sortable: true,
      width: "15%",
      center: true,
    },
    {
      name: "TYPE",
      selector: (row) => row.type,
      sortable: true,
      width: "12%",
      center: true,
    },
    {
      name: "VALUE",
      selector: (row) => row.value,
      sortable: true,
      width: "10%",
      center: true,
    },
    {
      name: "PRODUCTS",
      selector: (row) => row.products,
      width: "18%",
      center: true,
    },
    {
      name: "VALIDITY",
      selector: (row) => `${row.validFrom} - ${row.validTo}`,
      width: "20%",
      center: true,
    },
    {
      name: "STATUS",
      selector: (row) => row.status,
      sortable: true,
      cell: (row) => (
        <span
          className={`mngDiscountPromo-status-badge ${row.status.toLowerCase()}`}
        >
          {row.status.toUpperCase()}
        </span>
      ),
      width: "10%",
      center: true,
    },
  ];

  if (userRole !== "manager") {
    promotionColumns.push({
      name: "ACTIONS",
      cell: (row) => (
        <div className="mngDiscountPromo-action-buttons">
          <button
            className="mngDiscountPromo-edit-btn"
            onClick={() => handlePromotionModalOpen(row)}
            title="Edit"
          >
            <FaEdit />
          </button>
          <button
            className="mngDiscountPromo-delete-btn"
            onClick={() => handleDeletePromotion(row.id)}
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: "15%",
      center: true,
    });
  }

  if (authError) {
    return (
      <div className="mngDiscountPromo-page">
        <Sidebar />
        <div className="mngDiscountPromo">
          <Header pageTitle="Discount & Promotion Management" />
          <div className="mngDiscountPromo-content">
            <div style={{ padding: "20px", textAlign: "center", color: "red" }}>
              Authentication failed. Please login again.
              <br />
              <button onClick={() => navigate("/")}>Go to Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mngDiscountPromo-page">
        <Sidebar />
        <div className="mngDiscountPromo">
          <Header pageTitle="Discount & Promotion Management" />
          <div className="mngDiscountPromo-content">
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ color: "red", marginBottom: "10px" }}>
                Error loading data: {error}
              </div>
              <button onClick={handleRefresh} style={{ marginRight: "10px" }}>
                Retry
              </button>
              <button onClick={() => navigate("/")}>Back to Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mngDiscountPromo-page">
      <Sidebar />
      <div className="mngDiscountPromo">
        <Header pageTitle="Discount & Promotion Management" />
        <div className="mngDiscountPromo-content">
          <div className="mngDiscountPromo-tabs">
            <button
              className={`mngDiscountPromo-tab ${
                activeTab === "discounts" ? "mngDiscountPromo-tab-active" : ""
              }`}
              onClick={() => setActiveTab("discounts")}
            >
              Discounts
            </button>
            <button
              className={`mngDiscountPromo-tab ${
                activeTab === "promotions" ? "mngDiscountPromo-tab-active" : ""
              }`}
              onClick={() => setActiveTab("promotions")}
            >
              Promotions
            </button>
          </div>

          {activeTab === "discounts" && (
            <>
              <div className="mngDiscountPromo-filter-bar">
                <input
                  type="text"
                  placeholder="Search Discount Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  value={applicationFilter}
                  onChange={(e) => setApplicationFilter(e.target.value)}
                >
                  <option value="">All Applications</option>
                  {uniqueApplications.map((app) => (
                    <option key={app} value={app}>
                      {app}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  className="mngDiscountPromo-clear-btn"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </button>
                {userRole !== "manager" && (
                  <button
                    className="mngDiscountPromo-add-btn"
                    onClick={() => handleDiscountModalOpen()}
                  >
                    <FaPlus /> Add Discount
                  </button>
                )}
              </div>

              <div className="mngDiscountPromo-table-container">
                <DataTable
                  columns={discountColumns}
                  data={filteredDiscounts}
                  striped
                  highlightOnHover
                  responsive
                  pagination
                  fixedHeader
                  fixedHeaderScrollHeight="60vh"
                  pointerOnHover
                  progressPending={loading}
                  progressComponent={
                    <div style={{ padding: "24px", textAlign: "center" }}>
                      Loading discounts...
                    </div>
                  }
                  noDataComponent={
                    <div style={{ padding: "24px" }}>No discounts found.</div>
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

          {activeTab === "promotions" && (
            <>
              <div className="mngDiscountPromo-filter-bar">
                <input
                  type="text"
                  placeholder="Search Promotion Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  className="mngDiscountPromo-clear-btn"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </button>
                {userRole !== "manager" && (
                  <button
                    className="mngDiscountPromo-add-btn"
                    onClick={() => handlePromotionModalOpen()}
                  >
                    <FaPlus /> Add Promotion
                  </button>
                )}
              </div>

              <div className="mngDiscountPromo-table-container">
                <DataTable
                  columns={promotionColumns}
                  data={filteredPromotions}
                  striped
                  highlightOnHover
                  responsive
                  pagination
                  fixedHeader
                  fixedHeaderScrollHeight="60vh"
                  pointerOnHover
                  progressPending={loading}
                  progressComponent={
                    <div style={{ padding: "24px", textAlign: "center" }}>
                      Loading promotions...
                    </div>
                  }
                  noDataComponent={
                    <div style={{ padding: "24px" }}>No promotions found.</div>
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

          {userRole !== "manager" && (
            <>
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
              <PromotionModal
                showModal={showPromotionModal}
                onClose={() => setShowPromotionModal(false)}
                editingId={editingPromotionId}
                form={promotionForm}
                onChange={handlePromotionFormChange}
                onMultiSelectChange={handlePromotionMultiSelectChange}
                onSave={handleSavePromotion}
                isSaving={isSavingPromotion}
                availableProducts={availableProducts}
                categories={categories}
                today={today}
                isLoadingChoices={isLoadingChoices}
                errorChoices={errorChoices}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Discounts;