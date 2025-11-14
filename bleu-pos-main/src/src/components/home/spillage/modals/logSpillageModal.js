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
    }
  }, [show]);

  useEffect(() => {
    if (show) {
      fetchCashiers();
    }
  }, [show]);

  useEffect(() => {
    if (date && cashierName && show) {
      fetchProductsSoldByCashierOnDate(date, cashierName);
    } else {
      setAvailableProducts([]);
      setProductType("");
      setProductName("");
    }
  }, [date, cashierName, show]);

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

  const fetchProductsSoldByCashierOnDate = async (selectedDate, selectedCashier) => {
    setIsLoadingProducts(true);
    setProductType("");
    setProductName("");
    
    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const selectedCashierObj = availableCashiers.find(c => c.FullName === selectedCashier);
      
      if (!selectedCashierObj) {
        throw new Error("Selected cashier not found in available cashiers list");
      }
      
      const cashierUsername = selectedCashierObj.Username;
      
      const response = await fetch(
        `http://localhost:9003/wastelogs/products-sold?spillage_date=${selectedDate}&cashier_name=${encodeURIComponent(cashierUsername)}`,
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
          productType: "No products were processed by this cashier on this date",
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
        productType: error.message || "Error loading products for this date and cashier",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    let newErrors = {};

    if (!cashierName.trim()) newErrors.cashierName = "Cashier name is required";
    if (!date.trim()) newErrors.date = "Date is required";
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
      
      const selectedCashierObj = availableCashiers.find(c => c.FullName === cashierName);
      
      if (!selectedCashierObj) {
        throw new Error("Selected cashier not found");
      }
      
      const cashierUsername = selectedCashierObj.Username;
      
      const spillageData = {
        cashier_name: cashierUsername,
        spillage_date: date,
        product_name: productName,
        category: productType,
        quantity: parseInt(quantity),
        reason: reason,
        logged_by: loggedByName
      };

      // Save spillage log - backend handles inventory deduction in background
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
      
      console.log("Spillage logged successfully. Inventory deduction processing in background.");
      
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
                disabled={!date || !cashierName || isLoadingProducts}
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