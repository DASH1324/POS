import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./editSpillageModal.css";

function EditSpillageModal({ spillage, onClose, onUpdate }) {
  const [productName, setProductName] = useState("");
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [size, setSize] = useState("");
  const [loggedBy, setLoggedBy] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (spillage) {
      setProductName(spillage.productName || "");
      setType(spillage.type || "");
      setAmount(spillage.amount || "");
      setSize(spillage.size || "");
      setLoggedBy(spillage.loggedBy || "");
      setReason(spillage.reason || "");
      setDate(spillage.date || "");
    }
  }, [spillage]);

  const handleFocus = (field) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let newErrors = {};

    if (!productName.trim()) newErrors.productName = "Product name is required";
    if (!type.trim()) newErrors.type = "Type is required";
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) {
      newErrors.amount = "Enter a valid amount";
    }
    if (!size.trim()) newErrors.size = "Size is required";
    if (!loggedBy.trim()) newErrors.loggedBy = "Logged By is required";
    if (!reason.trim()) newErrors.reason = "Reason is required";
    if (!date.trim()) newErrors.date = "Date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    const updatedSpillage = {
      ...spillage,
      productName,
      type,
      amount: parseInt(amount),
      size,
      loggedBy,
      reason,
      date,
    };
    onUpdate(updatedSpillage);
    setIsSaving(false);
    onClose();
  };

  if (!spillage) return null;

  return (
    <div className="editSpillage-modal-overlay">
      <div className="editSpillage-modal-container">
        <div className="editSpillage-modal-header">
          <h2>Edit Spillage</h2>
          <span className="editSpillage-close-button" onClick={onClose}>
            ×
          </span>
        </div>

        <form className="editSpillage-modal-form" onSubmit={handleSubmit}>
          <label>
            Product Name: <span className="required">*</span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              onFocus={() => handleFocus("productName")}
              className={errors.productName ? "error-field" : ""}
            />
            {errors.productName && <p className="error-message">{errors.productName}</p>}
          </label>

          <label>
            Type: <span className="required">*</span>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              onFocus={() => handleFocus("type")}
              className={errors.type ? "error-field" : ""}
            />
            {errors.type && <p className="error-message">{errors.type}</p>}
          </label>

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
            <input
              type="text"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              onFocus={() => handleFocus("size")}
              className={errors.size ? "error-field" : ""}
            />
            {errors.size && <p className="error-message">{errors.size}</p>}
          </label>

          <label>
            Logged By: <span className="required">*</span>
            <input
              type="text"
              value={loggedBy}
              onChange={(e) => setLoggedBy(e.target.value)}
              onFocus={() => handleFocus("loggedBy")}
              className={errors.loggedBy ? "error-field" : ""}
            />
            {errors.loggedBy && <p className="error-message">{errors.loggedBy}</p>}
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

          <label>
            Reason: <span className="required">*</span>
            <textarea
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onFocus={() => handleFocus("reason")}
              className={errors.reason ? "error-field" : ""}
            />
            {errors.reason && <p className="error-message">{errors.reason}</p>}
          </label>

          <div className="editSpillage-button-container">
            <button
              type="submit"
              className="editSpillage-submit-button"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="editSpillage-cancel-button"
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

EditSpillageModal.propTypes = {
  spillage: PropTypes.shape({
    id: PropTypes.number,
    productName: PropTypes.string,
    type: PropTypes.string,
    amount: PropTypes.number,
    size: PropTypes.string,
    loggedBy: PropTypes.string,
    reason: PropTypes.string,
    date: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

export default EditSpillageModal;
