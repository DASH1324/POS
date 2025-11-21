import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./sharedSpillageModal.css";

function LogSpillageModal({ show, onClose, onSave, loggedByName }) {
  const [cashierName, setCashierName] = useState("");
  const [date, setDate] = useState("");
  const [productType, setProductType] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingCashiers, setIsLoadingCashiers] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableCashiers, setAvailableCashiers] = useState([]);
  const [cashierSessions, setCashierSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  useEffect(() => {
    if (!show) {
      setCashierName("");
      setDate("");
      setProductType("");
      setProductName("");
      setQuantity("");
      setReason("");
      setErrors({});
      setAvailableProducts([]);
      setSelectedSessionId(null);
    }
  }, [show]);

  useEffect(() => {
    if (show) {
      fetchCashiers();
      fetchAllSessions();
    }
  }, [show]);

  // When cashier name OR date changes, find the matching session
  useEffect(() => {
    if (date && cashierName && show) {
      findSessionForCashierAndDate(cashierName, date);
    } else {
      setAvailableProducts([]);
      setProductType("");
      setProductName("");
      setSelectedSessionId(null);
    }
  }, [date, cashierName, show, cashierSessions]);

  if (!show) return null;

  const fetchCashiers = async () => {
    setIsLoadingCashiers(true);
    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await fetch(
        "http://localhost:4000/users/cashiers",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch cashiers: ${response.status}`);
      }

      const cashiers = await response.json();
      setAvailableCashiers(cashiers);

      if (cashiers.length === 0) {
        setErrors((prev) => ({
          ...prev,
          cashierName: "No cashiers found in the system",
        }));
      }
    } catch (error) {
      console.error("Error fetching cashiers:", error);
      setErrors((prev) => ({
        ...prev,
        cashierName: "Error loading cashiers",
      }));
      setAvailableCashiers([]);
    } finally {
      setIsLoadingCashiers(false);
    }
  };

  const fetchAllSessions = async () => {
    try {
      const token = localStorage.getItem("authToken");
      
      const response = await fetch(
        "http://localhost:9003/wastelogs/sessions/active",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const sessions = await response.json();
        setCashierSessions(sessions);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  };

  const findSessionForCashierAndDate = (selectedCashierFullName, selectedDate) => {
    // Find the cashier's username from their full name
    const cashier = availableCashiers.find(c => c.FullName === selectedCashierFullName);
    if (!cashier) {
      setErrors((prev) => ({
        ...prev,
        productType: "Cashier not found",
      }));
      return;
    }

    const cashierUsername = cashier.Username;

    // Parse the selected date
    const selectedDateTime = new Date(selectedDate);
    selectedDateTime.setHours(0, 0, 0, 0);

    // Find a session for this cashier that was active on the selected date
    const matchingSession = cashierSessions.find(session => {
      if (session.cashier_name !== cashierUsername) return false;

      const sessionStart = new Date(session.session_start);
      const sessionEnd = session.session_end ? new Date(session.session_end) : new Date();

      // Check if the selected date falls within the session period
      return selectedDateTime >= new Date(sessionStart.toDateString()) && 
             selectedDateTime <= new Date(sessionEnd.toDateString());
    });

    if (matchingSession) {
      setSelectedSessionId(matchingSession.session_id);
      fetchProductsSoldInSession(matchingSession.session_id);
    } else {
      setSelectedSessionId(null);
      setAvailableProducts([]);
      setErrors((prev) => ({
        ...prev,
        productType: `No active session found for ${selectedCashierFullName} on ${selectedDate}`,
      }));
    }
  };

  const fetchProductsSoldInSession = async (sessionId) => {
    setIsLoadingProducts(true);
    setProductType("");
    setProductName("");
    
    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await fetch(
        `http://localhost:9003/wastelogs/products-sold?session_id=${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const products = await response.json();
      setAvailableProducts(products);

      if (products.length === 0) {
        setErrors((prev) => ({
          ...prev,
          productType: "No products were processed in this session",
        }));
      } else {
        setErrors((prev) => {
          const { productType, ...rest } = prev;
          return rest;
        });
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setErrors((prev) => ({
        ...prev,
        productType: error.message || "Error loading products for this session",
      }));
      setAvailableProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleFocus = (field) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const categories = [...new Set(availableProducts.map((p) => p.category))];

  const filteredProducts = productType
    ? availableProducts.filter((p) => p.category === productType)
    : [];

  // Check if category is merchandise-related
  const isMerchandiseCategory = (category) => {
    const merchandiseCategories = ['merchandise', 'all items'];
    return merchandiseCategories.includes(category.toLowerCase());
  };

  // Function to deduct merchandise directly
  const deductFromMerchandise = async (spillageData, token) => {
    const spillageItem = {
      product_name: spillageData.product_name,
      category: spillageData.category,
      quantity: spillageData.quantity
    };

    try {
      const response = await fetch(
        "http://localhost:8002/merchandise/deduct-from-spillage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            spillage_item: spillageItem
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to deduct merchandise:", errorData);
        throw new Error(errorData.detail || "Failed to deduct merchandise from inventory");
      }

      console.log("Successfully deducted merchandise for spillage");
    } catch (error) {
      console.error("Error deducting merchandise:", error);
      throw error;
    }
  };

  // Function to deduct from IMS (ingredients and materials)
  const deductFromIMS = async (spillageData, token) => {
    const spillageItem = {
      product_name: spillageData.product_name,
      category: spillageData.category,
      quantity: spillageData.quantity
    };

    try {
      const ingredientsResponse = await fetch(
        "http://127.0.0.1:8002/ingredients/deduct-from-spillage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            spillage_item: spillageItem
          }),
        }
      );

      if (!ingredientsResponse.ok) {
        const errorData = await ingredientsResponse.json();
        console.error("Failed to deduct ingredients:", errorData);
        throw new Error(errorData.detail || "Failed to deduct ingredients from IMS");
      }

      const materialsResponse = await fetch(
        "http://localhost:8002/materials/deduct-from-spillage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            spillage_item: spillageItem
          }),
        }
      );

      if (!materialsResponse.ok) {
        const errorData = await materialsResponse.json();
        console.error("Failed to deduct materials:", errorData);
        throw new Error(errorData.detail || "Failed to deduct materials from IMS");
      }

      console.log("Successfully deducted from IMS (ingredients and materials) for spillage");
    } catch (error) {
      console.error("Error deducting from IMS:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  let newErrors = {};

  if (!cashierName.trim()) newErrors.cashierName = "Cashier name is required";
  if (!date.trim()) newErrors.date = "Date is required";
  if (!selectedSessionId) newErrors.productType = "No valid session found for this cashier and date";
  if (!productType.trim()) newErrors.productType = "Product type is required";
  if (!productName.trim()) newErrors.productName = "Product name is required";
  if (!quantity.trim()) newErrors.quantity = "Quantity is required";
  else if (parseInt(quantity) <= 0) newErrors.quantity = "Quantity must be greater than 0";
  if (!reason.trim()) newErrors.reason = "Reason is required";

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  setIsSaving(true);

  try {
    const token = localStorage.getItem("authToken");
    
    const spillageData = {
      session_id: selectedSessionId,
      spillage_date: date,
      product_name: productName,
      category: productType,
      quantity: parseInt(quantity),
      reason: reason,
      logged_by: loggedByName
    };

    const response = await fetch("http://localhost:9003/wastelogs/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(spillageData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to save spillage");
    }

    const savedSpillage = await response.json();
    
    // ✅ Close immediately - inventory handled by backend
    console.log("Spillage logged successfully. Inventory will be updated in background.");
    onSave(savedSpillage);
    onClose();
    
  } catch (error) {
    console.error("Error saving spillage:", error);
    setErrors({
      submit: error.message || "Failed to save spillage. Please try again.",
    });
  } finally {
    setIsSaving(false);
  }
};

  return (
    <div className="spillage-modal-overlay" onClick={onClose}>
      <div className="spillage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spillage-modal-header">
          <h3>Log New Spillage</h3>
          <button className="spillage-close-modal" onClick={onClose}>×</button>
        </div>

        <form className="spillage-modal-content" onSubmit={handleSubmit}>
          <div className="spillage-form-row">
            <label className="spillage-form-label">
              <span className="spillage-label-text">
                Cashier Name <span className="spillage-required">*</span>
              </span>
              <select
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                onFocus={() => handleFocus("cashierName")}
                className={`spillage-input ${errors.cashierName ? "spillage-error-field" : ""}`}
                disabled={isLoadingCashiers}
              >
                <option value="">
                  {isLoadingCashiers
                    ? "Loading cashiers..."
                    : availableCashiers.length === 0
                    ? "No cashiers available"
                    : "Select cashier"}
                </option>
                {availableCashiers.map((cashier) => (
                  <option key={cashier.UserID} value={cashier.FullName}>
                    {cashier.FullName}
                  </option>
                ))}
              </select>
              {errors.cashierName && (
                <p className="spillage-error-message">{errors.cashierName}</p>
              )}
            </label>

            <label className="spillage-form-label">
              <span className="spillage-label-text">
                Date <span className="spillage-required">*</span>
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onFocus={() => handleFocus("date")}
                className={`spillage-input ${errors.date ? "spillage-error-field" : ""}`}
                max={new Date().toLocaleDateString('en-CA')}  
              />
              {errors.date && <p className="spillage-error-message">{errors.date}</p>}
            </label>
          </div>

          <div className="spillage-form-row">
            <label className="spillage-form-label">
              <span className="spillage-label-text">
                Product Type <span className="spillage-required">*</span>
              </span>
              <select
                value={productType}
                onChange={(e) => {
                  setProductType(e.target.value);
                  setProductName("");
                }}
                onFocus={() => handleFocus("productType")}
                className={`spillage-input ${errors.productType ? "spillage-error-field" : ""}`}
                disabled={!cashierName || !date || isLoadingProducts}
              >
                <option value="">
                  {!cashierName || !date
                    ? "Select cashier and date first"
                    : isLoadingProducts
                    ? "Loading..."
                    : availableProducts.length === 0
                    ? "No products processed"
                    : "Select category"}
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.productType && (
                <p className="spillage-error-message">{errors.productType}</p>
              )}
            </label>

            <label className="spillage-form-label">
              <span className="spillage-label-text">
                Product Name <span className="spillage-required">*</span>
              </span>
              <select
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onFocus={() => handleFocus("productName")}
                className={`spillage-input ${errors.productName ? "spillage-error-field" : ""}`}
                disabled={!productType || filteredProducts.length === 0}
              >
                <option value="">
                  {!productType
                    ? "Select category first"
                    : filteredProducts.length === 0
                    ? "No products available"
                    : "Select product"}
                </option>
                {filteredProducts.map((product) => (
                  <option key={product.product_name} value={product.product_name}>
                    {product.product_name}
                  </option>
                ))}
              </select>
              {errors.productName && (
                <p className="spillage-error-message">{errors.productName}</p>
              )}
            </label>
          </div>

          <div className="spillage-form-row">
            <label className="spillage-form-label">
              <span className="spillage-label-text">
                Quantity <span className="spillage-required">*</span>
              </span>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onFocus={() => handleFocus("quantity")}
                className={`spillage-input ${errors.quantity ? "spillage-error-field" : ""}`}
                placeholder="Enter quantity"
              />
              {errors.quantity && (
                <p className="spillage-error-message">{errors.quantity}</p>
              )}
            </label>
          </div>

          <div className="spillage-form-row spillage-full-width">
            <label className="spillage-form-label">
              <span className="spillage-label-text">
                Reason <span className="spillage-required">*</span>
              </span>
              <textarea
                rows="3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onFocus={() => handleFocus("reason")}
                className={`spillage-input spillage-textarea ${errors.reason ? "spillage-error-field" : ""}`}
                placeholder="Describe what happened..."
              />
              {errors.reason && (
                <p className="spillage-error-message">{errors.reason}</p>
              )}
            </label>
          </div>

          {errors.submit && (
            <div className="spillage-form-row spillage-full-width">
              <p className="spillage-error-message">{errors.submit}</p>
            </div>
          )}

          <div className="spillage-modal-footer">
            <button
              type="button"
              className="spillage-btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="spillage-btn-confirm"
              disabled={isSaving || isLoadingProducts || isLoadingCashiers}
            >
              {isSaving ? "Logging..." : "Log Spillage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

LogSpillageModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  loggedByName: PropTypes.string.isRequired,
};

export default LogSpillageModal;