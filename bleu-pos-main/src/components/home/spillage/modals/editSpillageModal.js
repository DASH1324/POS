import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./sharedSpillageModal.css";

function EditSpillageModal({ spillage, onClose, onUpdate, loggedByName }) {
  const [productType, setProductType] = useState(spillage.category || "");
  const [productName, setProductName] = useState(spillage.product_name || "");
  const [amount, setAmount] = useState(spillage.quantity || "");
  const [cashierName, setCashierName] = useState(spillage.cashier_name || "");
  const [date, setDate] = useState(
    spillage.spillage_date 
      ? new Date(spillage.spillage_date).toISOString().split('T')[0] 
      : ""
  );
  const [reason, setReason] = useState(spillage.reason || "");
  const [errors, setErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [cashiers, setCashiers] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingCashiers, setIsLoadingCashiers] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Store original values for comparison
  const [originalValues] = useState({
    category: spillage.category || "",
    product_name: spillage.product_name || "",
    quantity: spillage.quantity || 0
  });

  // Fetch cashiers list
  useEffect(() => {
    fetchCashiers();
  }, []);

  // Fetch products when date OR cashierName changes
  useEffect(() => {
    if (date && cashierName) {
      fetchProductsSoldByCashierOnDate(date, cashierName);
    } else {
      setAvailableProducts([]);
    }
  }, [date, cashierName]);

  // Reset fields when spillage changes
  useEffect(() => {
    if (spillage) {
      setProductType(spillage.category || "");
      setProductName(spillage.product_name || "");
      setAmount(spillage.quantity || "");
      setCashierName(spillage.cashier_name || "");
      setDate(
        spillage.spillage_date 
          ? new Date(spillage.spillage_date).toISOString().split('T')[0] 
          : ""
      );
      setReason(spillage.reason || "");
    }
  }, [spillage]);

  if (!spillage) return null;

  const fetchCashiers = async () => {
    setIsLoadingCashiers(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://localhost:4000/users/cashiers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCashiers(data);
      }
    } catch (error) {
      console.error("Error fetching cashiers:", error);
    } finally {
      setIsLoadingCashiers(false);
    }
  };

  const fetchProductsSoldByCashierOnDate = async (selectedDate, selectedCashier) => {
    setIsLoadingProducts(true);
    
    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await fetch(
        `http://localhost:9003/wastelogs/products-sold?spillage_date=${selectedDate}&cashier_name=${encodeURIComponent(selectedCashier)}`,
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

  // Get unique categories from available products
  const categories = [...new Set(availableProducts.map((p) => p.category))];

  // Filter products by selected category
  const filteredProducts = productType
    ? availableProducts.filter((p) => p.category === productType)
    : [];

  // Helper function to call inventory restock/deduct endpoints
  const handleInventoryAdjustment = async (token) => {
    // Check if anything changed that affects inventory
    const categoryChanged = originalValues.category !== productType;
    const productChanged = originalValues.product_name !== productName;
    const quantityChanged = originalValues.quantity !== parseInt(amount);

    if (!categoryChanged && !productChanged && !quantityChanged) {
      console.log("No inventory-affecting changes detected");
      return;
    }

    console.log("Inventory affecting changes detected:", {
      categoryChanged,
      productChanged,
      quantityChanged
    });

    const oldSpillage = {
      product_name: originalValues.product_name,
      category: originalValues.category,
      quantity: originalValues.quantity
    };

    const newSpillage = {
      product_name: productName,
      category: productType,
      quantity: parseInt(amount)
    };

    try {
      // Determine which endpoints to call based on category
      // Treat "All Items" as "Merchandise"
      const oldCategory = (originalValues.category.toLowerCase() === "all items" 
        ? "merchandise" 
        : originalValues.category.toLowerCase());
      const newCategory = (productType.toLowerCase() === "all items" 
        ? "merchandise" 
        : productType.toLowerCase());

      // Handle old spillage restock (always restock the old values if changed)
      if (oldCategory === "merchandise") {
        // Call merchandise restock-and-deduct endpoint
        console.log("Calling merchandise restock-and-deduct endpoint");
        const merchResponse = await fetch(
          "http://localhost:8002/merchandise/restock-and-deduct-spillage-edit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              old_spillage: oldSpillage,
              new_spillage: newSpillage
            }),
          }
        );

        if (!merchResponse.ok) {
          const errorData = await merchResponse.json();
          console.error("Merchandise inventory adjustment failed:", errorData);
          throw new Error(errorData.detail || "Failed to adjust merchandise inventory");
        }

        console.log("Merchandise inventory adjusted successfully");
      } else {
        // It's a product - call both ingredients and materials endpoints
        console.log("Calling ingredients restock-and-deduct endpoint");
        const ingredientsResponse = await fetch(
          "http://127.0.0.1:8002/ingredients/restock-and-deduct-spillage-edit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              old_spillage: oldSpillage,
              new_spillage: newSpillage
            }),
          }
        );

        if (!ingredientsResponse.ok) {
          const errorData = await ingredientsResponse.json();
          console.error("Ingredients inventory adjustment failed:", errorData);
          throw new Error(errorData.detail || "Failed to adjust ingredients inventory");
        }

        console.log("Ingredients inventory adjusted successfully");

        console.log("Calling materials restock-and-deduct endpoint");
        const materialsResponse = await fetch(
          "http://localhost:8002/materials/restock-and-deduct-spillage-edit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              old_spillage: oldSpillage,
              new_spillage: newSpillage
            }),
          }
        );

        if (!materialsResponse.ok) {
          const errorData = await materialsResponse.json();
          console.error("Materials inventory adjustment failed:", errorData);
          throw new Error(errorData.detail || "Failed to adjust materials inventory");
        }

        console.log("Materials inventory adjusted successfully");
      }
    } catch (error) {
      console.error("Error adjusting inventory:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let newErrors = {};

    if (!productType.trim()) newErrors.productType = "Product type is required";
    if (!productName.trim()) newErrors.productName = "Product name is required";
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) {
      newErrors.amount = "Enter a valid amount";
    }
    if (!cashierName.trim()) newErrors.cashierName = "Cashier is required";
    if (!date.trim()) newErrors.date = "Date is required";
    if (!reason.trim()) newErrors.reason = "Reason is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsUpdating(true);

    try {
      const token = localStorage.getItem("authToken");
      
      // STEP 1: Handle inventory adjustment (restock old + deduct new)
      try {
        await handleInventoryAdjustment(token);
        console.log("Inventory adjustment completed successfully");
      } catch (inventoryError) {
        console.error("Inventory adjustment failed:", inventoryError);
        setErrors({
          submit: `Inventory adjustment failed: ${inventoryError.message}. Spillage record not updated.`,
        });
        setIsUpdating(false);
        return; // Don't proceed with spillage update if inventory fails
      }

      // STEP 2: Update spillage record in database
      const response = await fetch(
        `http://localhost:9003/wastelogs/${spillage.spillage_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_name: productName,
            category: productType,
            quantity: parseInt(amount),
            cashier_name: cashierName,
            spillage_date: date,
            reason: reason,
            logged_by: loggedByName,
          }),
        }
      );

      if (response.ok) {
        const updatedData = await response.json();
        onUpdate(updatedData);
        onClose();
      } else {
        const errorData = await response.json();
        alert(`Failed to update spillage: ${errorData.detail || errorData.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error updating spillage:", error);
      alert("An error occurred while updating the spillage");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="logSpillage-modal-overlay">
      <div className="logSpillage-modal-container">
        <div className="logSpillage-modal-header">
          <h2>Edit Spillage</h2>
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
                onChange={(e) => {
                  setCashierName(e.target.value);
                  setProductType("");
                  setProductName("");
                }}
                onFocus={() => handleFocus("cashierName")}
                className={errors.cashierName ? "error-field" : ""}
                disabled={isLoadingCashiers}
              >
                <option value="">
                  {isLoadingCashiers
                    ? "Loading cashiers..."
                    : cashiers.length === 0
                    ? "No cashiers available"
                    : "Select cashier"}
                </option>
                {cashiers.map((cashier) => (
                  <option key={cashier.UserID} value={cashier.Username}>
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
                onChange={(e) => {
                  setDate(e.target.value);
                  setProductType("");
                  setProductName("");
                }}
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
              Amount: <span className="required">*</span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={() => handleFocus("amount")}
                className={errors.amount ? "error-field" : ""}
                placeholder="Enter quantity"
              />
              {errors.amount && <p className="error-message">{errors.amount}</p>}
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
              disabled={isUpdating || isLoadingProducts || isLoadingCashiers}
            >
              {isUpdating ? "Updating..." : "Update"}
            </button>
            <button
              type="button"
              className="logSpillage-cancel-button"
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

EditSpillageModal.propTypes = {
  spillage: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  loggedByName: PropTypes.string.isRequired,
};

export default EditSpillageModal;