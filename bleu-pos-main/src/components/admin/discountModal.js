import React from "react";

// Correctly destructure the props passed from the parent component
const DiscountModal = ({
  showModal,
  onClose,
  editingId, 
  form,
  onFormChange,          // <-- Use this for simple inputs
  onMultiSelectChange,   // <-- Use this for checkboxes
  onSave,
  isSaving,
  availableProducts,
  categories,
  today,
  isLoadingChoices,      // Added for better UX
  errorChoices           // Added for better UX
}) => {
  if (!showModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  // Simplified handler for checkboxes. It calls the parent's handler directly.
  const handleCheckboxChange = (e, itemName, listName, list) => {
    const updatedList = e.target.checked
      ? [...list, itemName]
      : list.filter(name => name !== itemName);
    
    // Call the dedicated multi-select handler from the parent
    // This is cleaner than creating a fake event object
    onMultiSelectChange(listName, updatedList);
  };


  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{editingId ? "Edit Discount" : "Add Discount"}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Discount Name - uses onFormChange */}
          <div className="form-group">
            <label>Discount Name</label>
            <input
              name="discountName"
              value={form.discountName || ''}
              onChange={onFormChange}
              required
              placeholder="Enter discount name"
            />
          </div>

          {/* Application Type Radios - uses onFormChange */}
          <div className="form-group">
            <label>Application Type</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="all_products"
                  checked={form.applicationType === "all_products"}
                  onChange={onFormChange}
                />
                Apply to All Products
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="specific_categories"
                  checked={form.applicationType === "specific_categories"}
                  onChange={onFormChange}
                />
                Apply to Specific Categories
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="applicationType"
                  value="specific_products"
                  checked={form.applicationType === "specific_products"}
                  onChange={onFormChange}
                />
                Apply to Individual Products
              </label>
            </div>
          </div>
          
          {/* Conditional Sections */}
          {isLoadingChoices && <div className="loading-small">Loading choices...</div>}
          {errorChoices && <div className="error-small">{errorChoices}</div>}

          {form.applicationType === "specific_categories" && !isLoadingChoices && (
            <div className="form-group">
              <label>Select Categories</label>
              <div className="checkbox-group">
                {categories.map(category => (
                  <label key={category.id} className="checkbox-label">
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

          {form.applicationType === "specific_products" && !isLoadingChoices && (
            <div className="form-group">
              <label>Select Products</label>
              <div className="checkbox-group">
                {availableProducts.map(product => (
                  <label key={product.ProductName} className="checkbox-label">
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

          {/* Other simple inputs - use onFormChange */}
          <div className="form-group">
            <label>Discount Type</label>
            <select name="discountType" value={form.discountType} onChange={onFormChange} required>
              <option value="percentage">Percentage Discount</option>
              <option value="fixed_amount">Fixed Amount Discount</option>
            </select>
          </div>

          {form.discountType === "percentage" ? (
            <div className="form-group">
              <label>Discount Percentage (%)</label>
              <input name="discountValue" type="number" min="0.1" max="99.9" step="0.1" value={form.discountValue || ''} onChange={onFormChange} required placeholder="Enter percentage" />
            </div>
          ) : (
            <div className="form-group">
              <label>Fixed Discount Amount (₱)</label>
              <input name="discountValue" type="number" min="0.01" step="0.01" value={form.discountValue || ''} onChange={onFormChange} required placeholder="Enter fixed amount" />
            </div>
          )}

          <div className="form-group">
            <label>Minimum Spend (₱)</label>
            <input name="minSpend" type="number" min="0" step="0.01" value={form.minSpend || ''} onChange={onFormChange} placeholder="Optional minimum spend" />
          </div>

          <div className="form-group">
            <label>Valid From</label>
            <input name="validFrom" type="date" value={form.validFrom || ''} onChange={onFormChange} min={today} required />
          </div>

          <div className="form-group">
            <label>Valid Until</label>
            <input name="validTo" type="date" value={form.validTo || ''} onChange={onFormChange} min={form.validFrom || today} required />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={onFormChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="save-btn" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Discount"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiscountModal;