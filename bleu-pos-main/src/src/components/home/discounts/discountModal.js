import React, { useState, useEffect } from "react";
import "./discountModal.css";

const DiscountModal = ({
  showModal,
  onClose,
  editingId,
  form,
  onFormChange,
  onMultiSelectChange,
  onSave,
  isSaving,
  availableProducts,
  categories,
  today,
  isLoadingChoices,
  errorChoices
}) => {
  const [errors, setErrors] = useState({});

  // Clear errors when modal closes
  useEffect(() => {
    if (!showModal) {
      setErrors({});
    }
  }, [showModal]);

  if (!showModal) return null;

  const handleFocus = (field) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    let newErrors = {};

    // Discount Name validation
    if (!form.discountName || !form.discountName.trim()) {
      newErrors.discountName = "Discount name is required";
    }

    // Application type validation
    if (form.applicationType === "specific_categories") {
      if (!form.selectedCategories || form.selectedCategories.length === 0) {
        newErrors.selectedCategories = "Please select at least one category";
      }
    } else if (form.applicationType === "specific_products") {
      if (!form.selectedProducts || form.selectedProducts.length === 0) {
        newErrors.selectedProducts = "Please select at least one product";
      }
    }

    // Discount value validation
    if (!form.discountValue || parseFloat(form.discountValue) <= 0) {
      newErrors.discountValue = "Discount value is required and must be greater than 0";
    } else if (form.discountType === "percentage") {
      if (parseFloat(form.discountValue) >= 100) {
        newErrors.discountValue = "Percentage must be less than 100%";
      }
    }

    // Minimum spend validation (optional but must be valid if provided)
    if (form.minSpend && parseFloat(form.minSpend) < 0) {
      newErrors.minSpend = "Minimum spend cannot be negative";
    }

    // Date validation
    if (!form.validFrom) {
      newErrors.validFrom = "Valid from date is required";
    }
    if (!form.validTo) {
      newErrors.validTo = "Valid until date is required";
    }
    if (form.validFrom && form.validTo && new Date(form.validTo) < new Date(form.validFrom)) {
      newErrors.validTo = "Valid until date must be after valid from date";
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    onSave();
  };

  const handleCheckboxChange = (e, itemName, listName, list) => {
    const updatedList = e.target.checked
      ? [...list, itemName]
      : list.filter(name => name !== itemName);
    onMultiSelectChange(listName, updatedList);
    
    // Clear error for this field when user makes a selection
    setErrors((prev) => ({ ...prev, [listName]: "" }));
  };

  // Handle number input with max length validation
  const handleNumberInput = (e, maxLength) => {
    const value = e.target.value;
    if (value.length > maxLength) {
      e.target.value = value.slice(0, maxLength);
    }
    onFormChange(e);
    handleFocus(e.target.name);
  };

  const handleInputChange = (e) => {
    onFormChange(e);
    handleFocus(e.target.name);
  };

  return (
    <div className="mngDiscounts-modal-overlay" onClick={onClose}>
      <div className="mngDiscounts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mngDiscounts-modal-header">
          <h3>{editingId ? "Edit Discount" : "Add Discount"}</h3>
          <button className="mngDiscounts-close-modal" onClick={onClose}>×</button>
        </div>

        <div className="mngDiscounts-modal-body">
          {/* Application Type */}
          <div className="mngDiscounts-form-group">
            <label>Application</label>
            <div className="mngDiscounts-radio-group">
              <label className="mngDiscounts-radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="all_products"
                  checked={form.applicationType === "all_products"}
                  onChange={handleInputChange}
                />
                All Products
              </label>
              <label className="mngDiscounts-radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="specific_categories"
                  checked={form.applicationType === "specific_categories"}
                  onChange={handleInputChange}
                />
                Specific Categories
              </label>
              <label className="mngDiscounts-radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="specific_products"
                  checked={form.applicationType === "specific_products"}
                  onChange={handleInputChange}
                />
                Individual Products
              </label>
            </div>
          </div>

          {/* Loading/Error States */}
          {isLoadingChoices && (
            <div className="mngDiscounts-loading">Loading choices...</div>
          )}
          {errorChoices && (
            <div className="mngDiscounts-error">{errorChoices}</div>
          )}

          {/* Category Selection */}
          {form.applicationType === "specific_categories" && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>
                Select Categories <span className="mngDiscounts-required">*</span>
              </label>
              <div className={`mngDiscounts-checkbox-group ${errors.selectedCategories ? "mngDiscounts-error-field" : ""}`}>
                {categories.map(category => (
                  <label key={category.id || category.name} className="mngDiscounts-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(form.selectedCategories || []).includes(category.name)}
                      onChange={(e) => handleCheckboxChange(e, category.name, 'selectedCategories', form.selectedCategories || [])}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
              {errors.selectedCategories && (
                <p className="mngDiscounts-error-message">{errors.selectedCategories}</p>
              )}
            </div>
          )}

          {/* Product Selection */}
          {form.applicationType === "specific_products" && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>
                Select Products <span className="mngDiscounts-required">*</span>
              </label>
              <div className={`mngDiscounts-checkbox-group ${errors.selectedProducts ? "mngDiscounts-error-field" : ""}`}>
                {availableProducts.map(product => (
                  <label key={product.ProductName} className="mngDiscounts-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(form.selectedProducts || []).includes(product.ProductName)}
                      onChange={(e) => handleCheckboxChange(e, product.ProductName, 'selectedProducts', form.selectedProducts || [])}
                    />
                    {product.ProductName}
                  </label>
                ))}
              </div>
              {errors.selectedProducts && (
                <p className="mngDiscounts-error-message">{errors.selectedProducts}</p>
              )}
            </div>
          )}

          {/* Discount Name and Type */}
          <div className="mngDiscounts-form-row">
            <div className="mngDiscounts-form-group">
              <label>
                Discount Name <span className="mngDiscounts-required">*</span>
              </label>
              <input
                name="discountName"
                value={form.discountName || ''}
                onChange={handleInputChange}
                onFocus={() => handleFocus("discountName")}
                maxLength={100}
                required
                placeholder="Enter discount name"
                className={errors.discountName ? "mngDiscounts-error-field" : ""}
              />
              {errors.discountName && (
                <p className="mngDiscounts-error-message">{errors.discountName}</p>
              )}
            </div>
            <div className="mngDiscounts-form-group">
              <label>Discount Type</label>
              <select 
                name="discountType" 
                value={form.discountType} 
                onChange={handleInputChange} 
                required
              >
                <option value="percentage">Percentage Discount</option>
                <option value="fixed_amount">Fixed Amount Discount</option>
              </select>
            </div>
          </div>

          {/* Discount Value and Minimum Spend */} 
          <div className="mngDiscounts-form-row">
            {form.discountType === "percentage" ? (
              <div className="mngDiscounts-form-group">
                <label>
                  Discount Percentage (%) <span className="mngDiscounts-required">*</span>
                </label>
                <input
                  name="discountValue"
                  type="number"
                  min="0.1"
                  max="99.9"
                  step="0.1"
                  value={form.discountValue || ''}
                  onInput={(e) => handleNumberInput(e, 5)}
                  onFocus={() => handleFocus("discountValue")}
                  required
                  placeholder="Enter percentage"
                  className={errors.discountValue ? "mngDiscounts-error-field" : ""}
                />
                {errors.discountValue && (
                  <p className="mngDiscounts-error-message">{errors.discountValue}</p>
                )}
              </div>
            ) : (
              <div className="mngDiscounts-form-group">
                <label>
                  Fixed Discount Amount (₱) <span className="mngDiscounts-required">*</span>
                </label>
                <input
                  name="discountValue"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.discountValue || ''}
                  onInput={(e) => handleNumberInput(e, 10)}
                  onFocus={() => handleFocus("discountValue")}
                  required
                  placeholder="Enter fixed amount"
                  className={errors.discountValue ? "mngDiscounts-error-field" : ""}
                />
                {errors.discountValue && (
                  <p className="mngDiscounts-error-message">{errors.discountValue}</p>
                )}
              </div>
            )}
            <div className="mngDiscounts-form-group">
              <label>Minimum Spend (₱)</label>
              <input
                name="minSpend"
                type="number"
                min="0"
                step="0.01"
                value={form.minSpend || ''}
                onInput={(e) => handleNumberInput(e, 10)}
                onFocus={() => handleFocus("minSpend")}
                placeholder="Optional minimum spend"
                className={errors.minSpend ? "mngDiscounts-error-field" : ""}
              />
              {errors.minSpend && (
                <p className="mngDiscounts-error-message">{errors.minSpend}</p>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="mngDiscounts-form-row">
            <div className="mngDiscounts-form-group">
              <label>
                Valid From <span className="mngDiscounts-required">*</span>
              </label>
              <input
                name="validFrom"
                type="date"
                value={form.validFrom || ''}
                onChange={handleInputChange}
                onFocus={() => handleFocus("validFrom")}
                min={today}
                required
                className={errors.validFrom ? "mngDiscounts-error-field" : ""}
              />
              {errors.validFrom && (
                <p className="mngDiscounts-error-message">{errors.validFrom}</p>
              )}
            </div>
            <div className="mngDiscounts-form-group">
              <label>
                Valid Until <span className="mngDiscounts-required">*</span>
              </label>
              <input
                name="validTo"
                type="date"
                value={form.validTo || ''}
                onChange={handleInputChange}
                onFocus={() => handleFocus("validTo")}
                min={form.validFrom || today}
                required
                className={errors.validTo ? "mngDiscounts-error-field" : ""}
              />
              {errors.validTo && (
                <p className="mngDiscounts-error-message">{errors.validTo}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="mngDiscounts-form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={handleInputChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="mngDiscounts-modal-footer">
            <button
              type="button"
              className="mngDiscounts-btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mngDiscounts-btn-save"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Discount"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscountModal;