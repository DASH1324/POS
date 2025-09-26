import React, { useState } from "react";
import PropTypes from "prop-types";
import "./sharedSpillageModal.css";

function LogSpillageModal({ show, onClose, onSave }) {
  const [productType, setProductType] = useState("");
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [size, setSize] = useState("");
  const [loggedBy, setLoggedBy] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  if (!show) return null;

  const handleFocus = (field) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let newErrors = {};

    if (!productType.trim()) newErrors.productType = "Product type is required";
    if (!productName.trim()) newErrors.productName = "Product name is required";
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) {
      newErrors.amount = "Enter a valid amount";
    }
    if (!size.trim()) newErrors.size = "Size is required";
    if (!loggedBy.trim()) newErrors.loggedBy = "Spilled by is required";
    if (!date.trim()) newErrors.date = "Date is required";
    if (!reason.trim()) newErrors.reason = "Reason is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);

    const newSpillage = {
      productName,
      type: productType,
      amount: parseInt(amount),
      size,
      loggedBy,
      reason,
      date,
    };

    onSave(newSpillage);
    setIsSaving(false);
    onClose();
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
              Product Type: <span className="required">*</span>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                onFocus={() => handleFocus("productType")}
                className={errors.productType ? "error-field" : ""}
              >
                <option value="">Select type</option>
                <option value="Drink">Drink</option>
                <option value="Food">Food</option>
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
              >
                <option value="">Select product</option>
                <option value="Cappuccino">Cappuccino</option>
                <option value="Latte">Latte</option>
                <option value="Cheeseburger">Cheeseburger</option>
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
              />
              {errors.amount && <p className="error-message">{errors.amount}</p>}
            </label>

            <label>
              Size: <span className="required">*</span>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                onFocus={() => handleFocus("size")}
                className={errors.size ? "error-field" : ""}
              >
                <option value="">Select size</option>
                <option value="12oz">12oz</option>
                <option value="22oz">22oz</option>
                <option value="Solo">Solo</option>
                <option value="Regular">Regular</option>
              </select>
              {errors.size && <p className="error-message">{errors.size}</p>}
            </label>
          </div>

          <div className="form-row">
            <label>
              Spilled By: <span className="required">*</span>
              <select
                value={loggedBy}
                onChange={(e) => setLoggedBy(e.target.value)}
                onFocus={() => handleFocus("loggedBy")}
                className={errors.loggedBy ? "error-field" : ""}
              >
                <option value="">Select staff</option>
                <option value="Cashier A">Cashier A</option>
                <option value="Cashier B">Cashier B</option>
                <option value="Cashier C">Cashier C</option>
              </select>
              {errors.loggedBy && (
                <p className="error-message">{errors.loggedBy}</p>
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
              />
              {errors.date && <p className="error-message">{errors.date}</p>}
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
              />
              {errors.reason && (
                <p className="error-message">{errors.reason}</p>
              )}
            </label>
          </div>

          <div className="logSpillage-button-container">
            <button
              type="submit"
              className="logSpillage-submit-button"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="logSpillage-cancel-button"
              onClick={onClose}
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
