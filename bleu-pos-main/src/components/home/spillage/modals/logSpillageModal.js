import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./sharedSpillageModal.css";

function LogSpillageModal({ show, onClose, onSave }) {
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

  // Reset form when modal closes
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

  // Fetch cashiers when modal opens
  useEffect(() => {
    if (show) {
      fetchCashiers();
    }
  }, [show]);

  // Fetch products when BOTH date AND cashierName change
  useEffect(() => {
    if (date && cashierName && show) {
      fetchProductsSoldByCashierOnDate(date, cashierName);
    } else {
      setAvailableProducts([]);
      setProductType("");
      setProductName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Find the selected cashier object to get their username
      const selectedCashierObj = availableCashiers.find(c => c.FullName === selectedCashier);
      
      if (!selectedCashierObj) {
        throw new Error("Selected cashier not found in available cashiers list");
      }
      
      const cashierUsername = selectedCashierObj.Username;
      
      console.log("Fetching products with token:", token.substring(0, 20) + "...");
      console.log("Using cashier username:", cashierUsername);
      
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
        // Clear any previous error if products are found
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

  // Get unique categories from available products
  const categories = [...new Set(availableProducts.map((p) => p.category))];

  // Filter products by selected category
  const filteredProducts = productType
    ? availableProducts.filter((p) => p.category === productType)
    : [];

  // NEW: Function to deduct from IMS using spillage endpoints
  const deductFromIMS = async (spillageData, token) => {
    const spillageItem = {
      product_name: spillageData.product_name,
      category: spillageData.category,
      quantity: spillageData.quantity
    };

    try {
      // Deduct ingredients using spillage endpoint
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

      const ingredientsResult = await ingredientsResponse.json();
      console.log("Ingredients deduction result:", ingredientsResult);

      // Deduct materials using spillage endpoint
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

      const materialsResult = await materialsResponse.json();
      console.log("Materials deduction result:", materialsResult);

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
      
      // Find the selected cashier object to get their username for saving
      const selectedCashierObj = availableCashiers.find(c => c.FullName === cashierName);
      
      if (!selectedCashierObj) {
        throw new Error("Selected cashier not found");
      }
      
      const cashierUsername = selectedCashierObj.Username;
      
      const spillageData = {
        cashier_name: cashierUsername, // Use username instead of full name
        spillage_date: date,
        product_name: productName,
        category: productType,
        quantity: parseInt(quantity),
        reason: reason,
      };

      // Save spillage log
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
      
      // NEW: Deduct from IMS after successful spillage save
      try {
        await deductFromIMS(spillageData, token);
        console.log("Spillage logged and inventory deducted successfully");
      } catch (imsError) {
        console.error("Warning: Spillage saved but IMS deduction failed:", imsError);
        // Show warning but don't fail the whole operation
        setErrors({
          submit: "Spillage saved, but inventory deduction may have failed. Please verify inventory levels.",
        });
        // Still call onSave and onClose since spillage was logged
        onSave(savedSpillage);
        onClose();
        return;
      }

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
    <div className="logSpillage-modal-overlay">
      <div className="logSpillage-modal-container">
        <div className="logSpillage-modal-header">
          <h2>Log New Spillage</h2>
          <span className="logSpillage-close-button" onClick={onClose}>
            ×
          </span>
        </div>

        <form className="logSpillage-modal-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Cashier Name: <span className="required">*</span>
              <select
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                onFocus={() => handleFocus("cashierName")}
                className={errors.cashierName ? "error-field" : ""}
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
                <p className="error-message">{errors.cashierName}</p>
              )}
            </label>

            <label>
              Date: <span className="required">*</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onFocus={() => handleFocus("date")}
                className={errors.date ? "error-field" : ""}
                max={new Date().toLocaleDateString('en-CA')}  
              />

              {errors.date && <p className="error-message">{errors.date}</p>}
            </label>
          </div>

          <div className="form-row">
            <label>
              Product Type: <span className="required">*</span>
              <select
                value={productType}
                onChange={(e) => {
                  setProductType(e.target.value);
                  setProductName("");
                }}
                onFocus={() => handleFocus("productType")}
                className={errors.productType ? "error-field" : ""}
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
                <p className="error-message">{errors.productType}</p>
              )}
            </label>

            <label>
              Product Name: <span className="required">*</span>
              <select
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onFocus={() => handleFocus("productName")}
                className={errors.productName ? "error-field" : ""}
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
                <p className="error-message">{errors.productName}</p>
              )}
            </label>
          </div>

          <div className="form-row">
            <label>
              Quantity: <span className="required">*</span>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onFocus={() => handleFocus("quantity")}
                className={errors.quantity ? "error-field" : ""}
                placeholder="Enter quantity"
              />
              {errors.quantity && (
                <p className="error-message">{errors.quantity}</p>
              )}
            </label>
          </div>

          <div className="form-row full-width">
            <label>
              Reason: <span className="required">*</span>
              <textarea
                rows="3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onFocus={() => handleFocus("reason")}
                className={errors.reason ? "error-field" : ""}
                placeholder="Describe what happened..."
              />
              {errors.reason && (
                <p className="error-message">{errors.reason}</p>
              )}
            </label>
          </div>

          {errors.submit && (
            <div className="form-row full-width">
              <p className="error-message">{errors.submit}</p>
            </div>
          )}

          <div className="logSpillage-button-container">
            <button
              type="submit"
              className="logSpillage-submit-button"
              disabled={isSaving || isLoadingProducts || isLoadingCashiers}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="logSpillage-cancel-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
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
};

export default LogSpillageModal;