import React from "react";
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
  if (!showModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  const handleCheckboxChange = (e, itemName, listName, list) => {
    const updatedList = e.target.checked
      ? [...list, itemName]
      : list.filter(name => name !== itemName);
    onMultiSelectChange(listName, updatedList);
  };

  return (
    <div className="mngDiscounts-modal-overlay" onClick={onClose}>
      <div className="mngDiscounts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mngDiscounts-modal-header">
          <h3>{editingId ? "Edit Discount" : "Add Discount"}</h3>
          <button className="mngDiscounts-close-modal" onClick={onClose}>×</button>
        </div>

        <form className="mngDiscounts-modal-body" onSubmit={handleSubmit}>
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
                  onChange={onFormChange}
                />
                All Products
              </label>
              <label className="mngDiscounts-radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="specific_categories"
                  checked={form.applicationType === "specific_categories"}
                  onChange={onFormChange}
                />
                Specific Categories
              </label>
              <label className="mngDiscounts-radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="specific_products"
                  checked={form.applicationType === "specific_products"}
                  onChange={onFormChange}
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
              <label>Select Categories</label>
              <div className="mngDiscounts-checkbox-group">
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
            </div>
          )}

          {/* Product Selection */}
          {form.applicationType === "specific_products" && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>Select Products</label>
              <div className="mngDiscounts-checkbox-group">
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
            </div>
          )}

          {/* Discount Name and Type */}
          <div className="mngDiscounts-form-row">
            <div className="mngDiscounts-form-group">
              <label>Discount Name</label>
              <input
                name="discountName"
                value={form.discountName || ''}
                onChange={onFormChange}
                required
                placeholder="Enter discount name"
              />
            </div>
            <div className="mngDiscounts-form-group">
              <label>Discount Type</label>
              <select name="discountType" value={form.discountType} onChange={onFormChange} required>
                <option value="percentage">Percentage Discount</option>
                <option value="fixed_amount">Fixed Amount Discount</option>
              </select>
            </div>
          </div>

          {/* Discount Value and Minimum Spend */} 
          <div className="mngDiscounts-form-row">
            {form.discountType === "percentage" ? (
              <div className="mngDiscounts-form-group">
                <label>Discount Percentage (%)</label>
                <input
                  name="discountValue"
                  type="number"
                  min="0.1"
                  max="99.9"
                  step="0.1"
                  value={form.discountValue || ''}
                  onChange={onFormChange}
                  required
                  placeholder="Enter percentage"
                />
              </div>
            ) : (
              <div className="mngDiscounts-form-group">
                <label>Fixed Discount Amount (₱)</label>
                <input
                  name="discountValue"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.discountValue || ''}
                  onChange={onFormChange}
                  required
                  placeholder="Enter fixed amount"
                />
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
                onChange={onFormChange}
                placeholder="Optional minimum spend"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="mngDiscounts-form-row">
            <div className="mngDiscounts-form-group">
              <label>Valid From</label>
              <input
                name="validFrom"
                type="date"
                value={form.validFrom || ''}
                onChange={onFormChange}
                min={today}
                required
              />
            </div>
            <div className="mngDiscounts-form-group">
              <label>Valid Until</label>
              <input
                name="validTo"
                type="date"
                value={form.validTo || ''}
                onChange={onFormChange}
                min={form.validFrom || today}
                required
              />
            </div>
          </div>

          {/* Status */}
          <div className="mngDiscounts-form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={onFormChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Action Buttons - FIXED: Now inside form */}
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
              type="submit"
              className="mngDiscounts-btn-save"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Discount"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiscountModal;