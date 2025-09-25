import React, { useState } from "react";
import "./logSpillageModal.css";

function LogSpillageModal({ show, onClose, onSave }) {
  const [formData, setFormData] = useState({
    type: "",
    productName: "",
    amount: "",
    size: "",
    loggedBy: "",
    spilledBy: "",
    reason: "",
    date: "",
  });

  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    for (const key in formData) {
      if (!formData[key]) {
        alert("Please fill in all required fields.");
        return;
      }
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="logSpillage-modal-backdrop" onClick={onClose}>
      <div
        className="logSpillage-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="logSpillage-modal-header">
          <h2>Log New Spillage</h2>
          <button className="logSpillage-close-button" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Form */}
        <form className="logSpillage-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>
                Product Type<span className="logSpillage-required-asterisk">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
              >
                <option value="">Select Type</option>
                <option value="Drink">Drink</option>
                <option value="Food">Food</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                Product Name<span className="logSpillage-required-asterisk">*</span>
              </label>
              <select
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                required
              >
                <option value="">Select Product</option>
                <option value="Cappuccino">Cappuccino</option>
                <option value="Latte">Latte</option>
                <option value="Cheeseburger">Cheeseburger</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Amount<span className="logSpillage-required-asterisk">*</span>
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                min="1"
                required
              />
            </div>
            <div className="form-group">
              <label>
                Size<span className="logSpillage-required-asterisk">*</span>
              </label>
              <select
                name="size"
                value={formData.size}
                onChange={handleChange}
                required
              >
                <option value="">Select Size</option>
                <option value="12oz">12oz</option>
                <option value="16oz">16oz</option>
                <option value="22oz">22oz</option>
                <option value="Solo">Solo</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Logged By<span className="logSpillage-required-asterisk">*</span>
              </label>
              <select
                name="loggedBy"
                value={formData.loggedBy}
                onChange={handleChange}
                required
              >
                <option value="">Select Staff</option>
                <option value="Cashier A">Cashier A</option>
                <option value="Cashier B">Cashier B</option>
                <option value="Cashier C">Cashier C</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                Spilled By<span className="logSpillage-required-asterisk">*</span>
              </label>
              <select
                name="spilledBy"
                value={formData.spilledBy}
                onChange={handleChange}
                required
              >
                <option value="">Select Staff</option>
                <option value="Staff A">Staff A</option>
                <option value="Staff B">Staff B</option>
                <option value="Staff C">Staff C</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              Reason<span className="logSpillage-required-asterisk">*</span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows="3"
              required
            />
          </div>

          <div className="form-group">
            <label>
              Date<span className="logSpillage-required-asterisk">*</span>
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Buttons */}
          <div className="logSpillage-button-container">
            <button
              type="button"
              className="logSpillage-cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="logSpillage-submit-button">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LogSpillageModal;
