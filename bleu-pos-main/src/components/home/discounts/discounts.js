import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import "./discounts.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import { FaPlusCircle, FaPlus, FaTrash, FaFilter, FaSearch } from "react-icons/fa";
import { HiOutlineExclamation } from "react-icons/hi";
import DataTable from "react-data-table-component";
import DiscountModal from "./discountModal";
import PromotionModal from "./promotionModal";
import DiscountDetailsModal from "./discountDetailsModal";
import PromotionDetailsModal from "./promotionDetailsModal";
import Loading from "../shared/loading";
import '../../confirmAlertCustom.css';
import { UnableToLoadData, NoData } from "../shared/exportModal";

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
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

  const [isDiscountDetailsOpen, setIsDiscountDetailsOpen] = useState(false);
  const [isPromotionDetailsOpen, setIsPromotionDetailsOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [selectedPromotion, setSelectedPromotion] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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
    toast.info("Filters cleared");
  };

  const handleRefresh = () => {
    const token = getAuthToken();
    if (token) {
      if (activeTab === "discounts") {
        fetchDiscounts();
      } else {
        fetchPromotions();
      }
      toast.success("Data refreshed");
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
          toast.error(`Error fetching discount details: ${error.message}`);
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
          toast.error(`Error fetching promotion details: ${error.message}`);
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

  // Helper function to transform discount detail to list format
  const transformDiscountDetailToList = (detail) => {
    const appStr = detail.applicationType === 'all_products' 
      ? "All Products"
      : detail.applicationType === 'specific_products'
      ? `${detail.selectedProducts.length} Product(s)`
      : `${detail.selectedCategories.length} Category(s)`;
    
    const discStr = detail.discountType === 'percentage'
      ? `${parseFloat(detail.discountValue).toFixed(1)}%`
      : `₱${parseFloat(detail.discountValue).toFixed(2)}`;

    return {
      id: detail.id,
      name: detail.discountName,
      application: appStr,
      discount: discStr,
      minSpend: parseFloat(detail.minSpend),
      validFrom: detail.validFrom,
      validTo: detail.validTo,
      status: detail.status,
      type: detail.discountType,
      application_type: detail.applicationType,
      applicable_products: detail.selectedProducts || [],
      applicable_categories: detail.selectedCategories || []
    };
  };

  // Helper function to transform promotion detail to list format
  const transformPromotionDetailToList = (detail) => {
    let typeStr = detail.promotionType.toUpperCase();
    if (detail.promotionType === 'bogo') {
      typeStr = `BOGO (${detail.buyQuantity}+${detail.getQuantity})`;
    }

    let valueStr = "";
    if (detail.promotionType === 'percentage') {
      valueStr = `${parseFloat(detail.promotionValue).toFixed(1)}%`;
    } else if (detail.promotionType === 'fixed') {
      valueStr = `₱${parseFloat(detail.promotionValue).toFixed(2)}`;
    } else if (detail.promotionType === 'bogo') {
      if (detail.bogoDiscountType === 'percentage') {
        valueStr = `${parseFloat(detail.bogoDiscountValue).toFixed(1)}% off`;
      } else {
        valueStr = `₱${parseFloat(detail.bogoDiscountValue).toFixed(2)} off`;
      }
    }

    let productsStr = "";
    if (detail.applicationType === 'all_products') {
      productsStr = "All Products";
    } else if (detail.applicationType === 'specific_categories') {
      const cats = detail.selectedCategories || [];
      productsStr = cats.length <= 2 ? cats.join(", ") : `${cats.length} categories`;
    } else {
      const prods = detail.selectedProducts || [];
      productsStr = prods.length <= 2 ? prods.join(", ") : `${prods.length} products`;
    }

    return {
      id: detail.id,
      name: detail.promotionName,
      type: typeStr,
      value: valueStr,
      products: productsStr,
      validFrom: detail.validFrom,
      validTo: detail.validTo,
      status: detail.status
    };
  };

  const handleSaveDiscount = async () => {
    if (userRole === "manager") return;

    if (!discountForm.discountName.trim()) {
      toast.error("Please enter a discount name");
      return;
    }
    if (new Date(discountForm.validFrom) >= new Date(discountForm.validTo)) {
      toast.error("'Valid From' must be before 'Valid To'");
      return;
    }

    setIsSavingDiscount(true);

    const isEditing = !!editingDiscountId;
    const endpoint = isEditing
      ? `/discounts/${editingDiscountId}`
      : "/discounts/";
    const method = isEditing ? "PUT" : "POST";

    try {
      const result = await apiFetch(endpoint, method, discountForm);
      
      // Transform the returned detail data to list format
      const listItem = transformDiscountDetailToList(result);
      
      // Update state optimistically instead of refetching
      if (isEditing) {
        setDiscounts(prev => prev.map(d => d.id === listItem.id ? listItem : d));
        toast.success(`Discount '${discountForm.discountName}' updated successfully`);
      } else {
        setDiscounts(prev => [listItem, ...prev]);
        toast.success(`Discount '${discountForm.discountName}' created successfully`);
      }
      
      setShowDiscountModal(false);
    } catch (error) {
      toast.error(`Error saving discount: ${error.message}`);
    } finally {
      setIsSavingDiscount(false);
    }
  };

  const handleSavePromotion = async () => {
    if (userRole === "manager") return;

    if (!promotionForm.promotionName.trim()) {
      toast.error("Please enter a promotion name");
      return;
    }
    if (new Date(promotionForm.validFrom) >= new Date(promotionForm.validTo)) {
      toast.error("'Valid From' must be before 'Valid To'");
      return;
    }
    
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
            toast.error("Please select at least one product for a BOGO promotion");
            return;
        }
        payload.applicationType = 'specific_products';
        payload.selectedProducts = promotionForm.selectedProducts;
        payload.buyQuantity = promotionForm.buyQuantity;
        payload.getQuantity = promotionForm.getQuantity;
        payload.bogoDiscountType = promotionForm.bogoDiscountType;
        payload.bogoDiscountValue = promotionForm.bogoDiscountValue;
    } else {
        payload.applicationType = promotionForm.applicationType;
        payload.promotionValue = promotionForm.promotionValue;

        if (promotionForm.applicationType === 'specific_products') {
            if (!promotionForm.selectedProducts || promotionForm.selectedProducts.length === 0) {
                toast.error("Please select at least one product for this application type");
                return;
            }
            payload.selectedProducts = promotionForm.selectedProducts;
            payload.selectedCategories = [];
        } else if (promotionForm.applicationType === 'specific_categories') {
            if (!promotionForm.selectedCategories || promotionForm.selectedCategories.length === 0) {
                toast.error("Please select at least one category for this application type");
                return;
            }
            payload.selectedCategories = promotionForm.selectedCategories;
            payload.selectedProducts = [];
        } else {
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
      const result = await apiFetch(endpoint, method, payload);
      
      // Transform the returned detail data to list format
      const listItem = transformPromotionDetailToList(result);
      
      // Update state optimistically instead of refetching
      if (isEditing) {
        setPromotions(prev => prev.map(p => p.id === listItem.id ? listItem : p));
        toast.success(`Promotion '${promotionForm.promotionName}' updated successfully`);
      } else {
        setPromotions(prev => [listItem, ...prev]);
        toast.success(`Promotion '${promotionForm.promotionName}' created successfully`);
      }
      
      setShowPromotionModal(false);
    } catch (error) {
      toast.error(`Error saving promotion: ${error.message}`);
    } finally {
      setIsSavingPromotion(false);
    }
  };

  const confirmDeleteDiscount = (discount) => {
    setDeleteTarget({ type: "discount", id: discount.id, name: discount.name });
    setDeleteError(null);
  };

  const confirmDeletePromotion = (promotion) => {
    setDeleteTarget({ type: "promotion", id: promotion.id, name: promotion.name });
    setDeleteError(null);
  };

  let discountColumns = [
    {
      name: "NAME",
      selector: (row) => row.name,
      sortable: true,
      width: "18%",
      center: true,
    },
    {
      name: "DISCOUNT",
      selector: (row) => row.discount,
      sortable: true,
      width: "16%",
      center: true,
    },
    {
      name: "MIN SPEND",
      selector: (row) => `₱${row.minSpend.toFixed(2)}`,
      sortable: true,
      width: "16%",
      center: true,
    },
    {
      name: "APPLICATION",
      selector: (row) => row.application,
      width: "16%",
      center: true,
    },
    {
      name: "VALIDITY",
      selector: (row) => `${row.validFrom} - ${row.validTo}`,
      width: "18%",
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
      width: "16%",
      center: true,
    },
  ];

  let promotionColumns = [
    {
      name: "NAME",
      selector: (row) => row.name,
      sortable: true,
      width: "18%",
      left: true,
    },
    {
      name: "TYPE",
      selector: (row) => row.type,
      sortable: true,
      width: "16%",
      center: true,
    },
    {
      name: "VALUE",
      selector: (row) => row.value,
      sortable: true,
      width: "16%",
      center: true,
    },
    {
      name: "PRODUCTS",
      selector: (row) => row.products,
      width: "16%",
      center: true,
    },
    {
      name: "VALIDITY",
      selector: (row) => `${row.validFrom} - ${row.validTo}`,
      width: "18%",
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
      width: "16%",
      center: true,
    },
  ];

  if (authError) {
    return (
      <div className="mngDiscountPromo-page">
        <Sidebar />
        <div className="mngDiscountPromo">
          <Header pageTitle="Discount & Promotion Management" />
          <div className="mngDiscountPromo-content">
            <UnableToLoadData />
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
            <UnableToLoadData />
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
          {/* Tabs and Filter Wrapper */}
          <div className="mngDiscountPromo-tabs-filter-wrapper">
            {/* Tabs */}
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

            {/* Filter and Add Button Wrapper */}
            {!loading && (
              <div className="mngDiscountPromo-filter-wrapper">
                {/* Filter Bar with Toggle */}
                <div className={`mngDiscountPromo-filter-bar ${isFilterOpen ? "open" : "collapsed"}`}>
                  <button
                    className="mngDiscountPromo-filter-toggle-btn"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                  >
                    <FaFilter />
                  </button>

                  {/* Search */}
                  <div className="mngDiscountPromo-filter-item">
                    <div className="mngDiscountPromo-search-wrapper">
                      <FaSearch className="mngDiscountPromo-search-icon" />
                      <input
                        type="text"
                        placeholder={activeTab === "discounts" ? "Search Discount Name..." : "Search Promotion Name..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mngDiscountPromo-search-input"
                      />
                    </div>
                  </div>

                  {/* Application Filter (only for discounts) */}
                  {activeTab === "discounts" && (
                    <div className="mngDiscountPromo-filter-item">
                      <span>Application:</span>
                      <select
                        value={applicationFilter}
                        onChange={(e) => setApplicationFilter(e.target.value)}
                        className="mngDiscountPromo-select"
                      >
                        <option value="">All Applications</option>
                        {uniqueApplications.map((app) => (
                          <option key={app} value={app}>
                            {app}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Status Filter */}
                  <div className="mngDiscountPromo-filter-item">
                    <span>Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mngDiscountPromo-select"
                    >
                      <option value="">All Status</option>
                      {uniqueStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  <button
                    className="mngDiscountPromo-clear-btn"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </button>
                </div>

                {/* Add Button (Outside Filter Bar) */}
                {userRole !== "manager" && (
                  <button
                  className="mngDiscountPromo-add-btn"
                  onClick={() =>
                    activeTab === "discounts" ? handleDiscountModalOpen() : handlePromotionModalOpen()
                  }
                >
                  <FaPlusCircle /> {activeTab === "discounts" ? "Add Discount" : "Add Promotion"}
                </button>
                )}
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <Loading />
          ) : (
            <>
              {activeTab === "discounts" && (
                <div className="mngDiscountPromo-table-container">
                  <DataTable
                    columns={discountColumns}
                    data={filteredDiscounts}
                    striped
                    highlightOnHover
                    responsive
                    pagination
                    paginationRowsPerPageOptions={[10]}
                    fixedHeader
                    fixedHeaderScrollHeight="60vh"
                    pointerOnHover
                    onRowClicked={(row) => {
                      setSelectedDiscount(row);
                      setIsDiscountDetailsOpen(true);
                    }}
                    noDataComponent={<NoData />}
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
              )}

              {activeTab === "promotions" && (
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
                    onRowClicked={(row) => {
                      setSelectedPromotion(row);
                      setIsPromotionDetailsOpen(true);
                    }}
                    noDataComponent={<NoData />}
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
              )}
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

          {/* Always show details modals to allow viewing */}
          <DiscountDetailsModal
            show={isDiscountDetailsOpen}
            onClose={() => setIsDiscountDetailsOpen(false)}
            discount={selectedDiscount}
            userRole={userRole}
            onEdit={(discount) => {
              setIsDiscountDetailsOpen(false);
              handleDiscountModalOpen(discount);
            }}
            onDelete={(discount) => {
              setIsDiscountDetailsOpen(false);
              confirmDeleteDiscount(discount);
            }}
          />

          <PromotionDetailsModal
            show={isPromotionDetailsOpen}
            onClose={() => setIsPromotionDetailsOpen(false)}
            promotion={selectedPromotion}
            userRole={userRole}
            onEdit={(promotion) => {
              setIsPromotionDetailsOpen(false);
              handlePromotionModalOpen(promotion);
            }}
            onDelete={(promotion) => {
              setIsPromotionDetailsOpen(false);
              confirmDeletePromotion(promotion);
            }}
          />
        </div>
      </div>
      {deleteTarget && (
      <div className="mngDiscountPromo-delete-overlay" onClick={() => !isDeleting && setDeleteTarget(null)}>
        <div className="mngDiscountPromo-delete-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mngDiscountPromo-delete-close" onClick={() => !isDeleting && setDeleteTarget(null)}>
            &times;
          </div>
          <div className="mngDiscountPromo-delete-icon alert-danger">
            <HiOutlineExclamation />
          </div>
          <h1>Confirm Delete</h1>
          <p>
            Are you sure you want to delete this?
          </p>

          {deleteError && <div className="mngDiscountPromo-delete-error">{deleteError}</div>}

          <div className="mngDiscountPromo-delete-button-group">
            <button
              onClick={async () => {
                if (!deleteTarget) return;
                setIsDeleting(true);
                setDeleteError(null);
                try {
                  if (deleteTarget.type === "discount") {
                    await apiFetch(`/discounts/${deleteTarget.id}`, "DELETE");
                    // Remove from state instead of refetching
                    setDiscounts(prev => prev.filter(d => d.id !== deleteTarget.id));
                    toast.success(`Discount '${deleteTarget.name}' deleted successfully`);
                  } else {
                    await apiFetch(`/promotions/${deleteTarget.id}`, "DELETE");
                    // Remove from state instead of refetching
                    setPromotions(prev => prev.filter(p => p.id !== deleteTarget.id));
                    toast.success(`Promotion '${deleteTarget.name}' deleted successfully`);
                  }
                  setDeleteTarget(null);
                } catch (error) {
                  setDeleteError(error.message);
                  toast.error(`Error deleting: ${error.message}`);
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button onClick={() => !isDeleting && setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

export default Discounts;