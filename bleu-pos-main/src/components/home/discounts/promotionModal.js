import React from "react";
import "./discountModal.css";

const PromotionModal = ({
  showModal,
  onClose,
  editingId,
  form,
  onChange,
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

  // Check if BOGO type is selected
  const isBogoType = form.promotionType === "bogo";

  return (
    <div className="mngDiscounts-modal-overlay" onClick={onClose}>
      <div className="mngDiscounts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mngDiscounts-modal-header">
          <h3>{editingId ? "Edit Promotion" : "Add Promotion"}</h3>
          <button className="mngDiscounts-close-modal" onClick={onClose}>×</button>
        </div>
        
        <form className="mngDiscounts-modal-body" onSubmit={handleSubmit}>
          {/* Promotion Type - Moved to Top */}
          <div className="mngDiscounts-form-group">
            <label>Promotion Type</label>
            <select
              name="promotionType"
              value={form.promotionType}
              onChange={onChange}
              required
            >
              <option value="percentage">Percentage Discount</option>
              <option value="fixed">Fixed Amount Discount</option>
              <option value="bogo">Buy One Get One</option>
            </select>
          </div>

          {/* Application Type - Hidden for BOGO */}
          {!isBogoType && (
            <div className="mngDiscounts-form-group">
              <label>Application</label>
              <div className="mngDiscounts-radio-group">
                <label className="mngDiscounts-radio-label">
                  <input
                    type="radio"
                    name="applicationType"
                    value="all_products"
                    checked={form.applicationType === "all_products"}
                    onChange={onChange}
                  />
                  All Products
                </label>
                <label className="mngDiscounts-radio-label">
                  <input
                    type="radio"
                    name="applicationType"
                    value="specific_categories"
                    checked={form.applicationType === "specific_categories"}
                    onChange={onChange}
                  />
                  Specific Categories
                </label>
                <label className="mngDiscounts-radio-label">
                  <input
                    type="radio"
                    name="applicationType"
                    value="specific_products"
                    checked={form.applicationType === "specific_products"}
                    onChange={onChange}
                  />
                  Individual Products
                </label>
              </div>
            </div>
          )}
          
          {/* Promotion Name */}
          <div className="mngDiscounts-form-group">
            <label>Promotion Name</label>
            <input
              name="promotionName"
              value={form.promotionName || ''}
              onChange={onChange}
              required
              placeholder="Enter promotion name"
            />
          </div>

          {/* Description */}
          <div className="mngDiscounts-form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={form.description || ''}
              onChange={onChange}
              placeholder="Enter promotion description"
              rows="3"
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1a1a1a',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Loading/Error States */}
          {isLoadingChoices && (
            <div className="mngDiscounts-loading">Loading choices...</div>
          )}
          {errorChoices && (
            <div className="mngDiscounts-error">{errorChoices}</div>
          )}

          {/* BOGO Product Selection - Always Shows for BOGO */}
          {isBogoType && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>
                Select Products for BOGO
                <span style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                  Select 1 product for "Buy 1 Take 1 Same Product" or 2 products for "Buy Product A, Get Product B"
                </span>
              </label>
              <div className="mngDiscounts-checkbox-group">
                {availableProducts.map(product => (
                  <label key={product.ProductName} className="mngDiscounts-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(form.selectedProducts || []).includes(product.ProductName)}
                      onChange={(e) => handleCheckboxChange(e, product.ProductName, 'selectedProducts', form.selectedProducts || [])}
                      disabled={(form.selectedProducts || []).length >= 2 && !(form.selectedProducts || []).includes(product.ProductName)}
                    />
                    {product.ProductName}
                  </label>
                ))}
              </div>
              {(form.selectedProducts || []).length === 1 && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '13px' }}>
                  ℹ️ Buy 1 Take 1 Same Product: {form.selectedProducts[0]}
                </div>
              )}
              {(form.selectedProducts || []).length === 2 && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '4px', fontSize: '13px' }}>
                  ℹ️ Buy {form.selectedProducts[0]}, Get {form.selectedProducts[1]}
                </div>
              )}
            </div>
          )}

          {/* Category Selection - Only for non-BOGO */}
          {!isBogoType && form.applicationType === "specific_categories" && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>Select Categories</label>
              <div className="mngDiscounts-checkbox-group">
                {categories.map(category => (
                  <label key={category.id} className="mngDiscounts-checkbox-label">
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

          {/* Product Selection - Only for non-BOGO */}
          {!isBogoType && form.applicationType === "specific_products" && !isLoadingChoices && (
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

          {/* Percentage Discount */}
          {form.promotionType === "percentage" && (
            <div className="mngDiscounts-form-group">
              <label>Discount Percentage (%)</label>
              <input
                name="promotionValue"
                type="number"
                min="0.1"
                max="99.9"
                step="0.1"
                value={form.promotionValue || ''}
                onChange={onChange}
                required
                placeholder="Enter percentage"
              />
            </div>
          )}

          {/* Fixed Amount Discount */}
          {form.promotionType === "fixed" && (
            <div className="mngDiscounts-form-group">
              <label>Fixed Discount Amount (₱)</label>
              <input
                name="promotionValue"
                type="number"
                min="0.01"
                step="0.01"
                value={form.promotionValue || ''}
                onChange={onChange}
                required
                placeholder="Enter fixed amount"
              />
            </div>
          )}

          {/* BOGO Configuration */}
          {form.promotionType === "bogo" && (
            <>
              <div className="mngDiscounts-form-row">
                <div className="mngDiscounts-form-group">
                  <label>Buy Quantity</label>
                  <input
                    name="buyQuantity"
                    type="number"
                    min="1"
                    value={form.buyQuantity || 1}
                    onChange={onChange}
                    required
                  />
                </div>
                <div className="mngDiscounts-form-group">
                  <label>Get Quantity</label>
                  <input
                    name="getQuantity"
                    type="number"
                    min="1"
                    value={form.getQuantity || 1}
                    onChange={onChange}
                    required
                  />
                </div>
              </div>

              {/* BOGO Discount Type */}
              <div className="mngDiscounts-form-group">
                <label>Discount on Free Items</label>
                <select
                  name="bogoDiscountType"
                  value={form.bogoDiscountType || "percentage"}
                  onChange={onChange}
                  required
                >
                  <option value="percentage">Percentage Discount</option>
                  <option value="fixed_amount">Fixed Amount Discount</option>
                </select>
              </div>

              {/* BOGO Discount Value */}
              {form.bogoDiscountType === "percentage" ? (
                <div className="mngDiscounts-form-group">
                  <label>Discount Percentage on Free Items (%)</label>
                  <input
                    name="bogoDiscountValue"
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={form.bogoDiscountValue || ''}
                    onChange={onChange}
                    required
                    placeholder="Enter percentage (e.g., 50 for 50% off, 100 for free)"
                  />
                </div>
              ) : (
                <div className="mngDiscounts-form-group">
                  <label>Fixed Discount Amount on Free Items (₱)</label>
                  <input
                    name="bogoDiscountValue"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.bogoDiscountValue || ''}
                    onChange={onChange}
                    required
                    placeholder="Enter fixed amount"
                  />
                </div>
              )}
            </>
          )}

          {/* Minimum Quantity - Only for non-BOGO */}
          {!isBogoType && (
            <div className="mngDiscounts-form-group">
              <label>Minimum Quantity</label>
              <input
                name="minQuantity"
                type="number"
                min="1"
                value={form.minQuantity || ''}
                onChange={onChange}
                placeholder="Optional minimum quantity"
              />
            </div>
          )}

          {/* Date Range */}
          <div className="mngDiscounts-form-row">
            <div className="mngDiscounts-form-group">
              <label>Valid From</label>
              <input
                name="validFrom"
                type="date"
                value={form.validFrom || ''}
                onChange={onChange}
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
                onChange={onChange}
                min={form.validFrom || today}
                required
              />
            </div>
          </div>

          {/* Status */}
          <div className="mngDiscounts-form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={onChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </form>

        {/* Action Buttons */}
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
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Promotion"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromotionModal;