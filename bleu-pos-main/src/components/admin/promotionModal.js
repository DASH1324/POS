import React from "react";

const PromotionModal = ({
  showModal,
  onClose,
  editingId,
  form,
  onChange,
  onSave,
  isSaving,
  availableProducts,
  today
}) => {
  if (!showModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{editingId ? "Edit Promotion" : "Add Promotion"}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Promotion Name</label>
            <input
              name="promotionName"
              value={form.promotionName}
              onChange={onChange}
              required
              placeholder="Enter promotion name"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={onChange}
              placeholder="Enter promotion description"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Select Products</label>
            <div className="checkbox-group">
              {availableProducts.map(product => (
                <label key={product.ProductID} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.selectedProducts.includes(product.ProductID)}
                    onChange={(e) => {
                      const updatedProducts = e.target.checked
                        ? [...form.selectedProducts, product.ProductID]
                        : form.selectedProducts.filter(id => id !== product.ProductID);
                      onChange({
                        target: {
                          name: 'selectedProducts',
                          value: updatedProducts
                        }
                      });
                    }}
                  />
                  {product.ProductName}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Promotion Type</label>
            <select
              name="promotionType"
              value={form.promotionType}
              onChange={onChange}
              required
            >
              <option value="percentage">Percentage Discount</option>
              <option value="fixed">Fixed Amount Discount</option>
              <option value="bogo">Buy One Get One (BOGO)</option>
            </select>
          </div>

          {form.promotionType === "percentage" && (
            <div className="form-group">
              <label>Discount Percentage (%)</label>
              <input
                name="promotionValue"
                type="number"
                min="0.1"
                max="99.9"
                step="0.1"
                value={form.promotionValue}
                onChange={onChange}
                required
                placeholder="Enter percentage"
              />
            </div>
          )}

          {form.promotionType === "fixed" && (
            <div className="form-group">
              <label>Fixed Discount Amount (₱)</label>
              <input
                name="promotionValue"
                type="number"
                min="0.01"
                step="0.01"
                value={form.promotionValue}
                onChange={onChange}
                required
                placeholder="Enter fixed amount"
              />
            </div>
          )}

          {form.promotionType === "bogo" && (
            <div className="form-group">
              <label>BOGO Configuration</label>
              <div className="bogo-config">
                <label>Buy Quantity</label>
                <input
                  name="buyQuantity"
                  type="number"
                  min="1"
                  value={form.buyQuantity}
                  onChange={onChange}
                  required
                />
                <label>Get Quantity</label>
                <input
                  name="getQuantity"
                  type="number"
                  min="1"
                  value={form.getQuantity}
                  onChange={onChange}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Minimum Quantity</label>
            <input
              name="minQuantity"
              type="number"
              min="1"
              value={form.minQuantity}
              onChange={onChange}
              placeholder="Optional minimum quantity"
            />
          </div>

          <div className="form-group">
            <label>Maximum Uses per Customer</label>
            <input
              name="maxUsesPerCustomer"
              type="number"
              min="1"
              value={form.maxUsesPerCustomer}
              onChange={onChange}
              placeholder="Optional usage limit"
            />
          </div>

          <div className="form-group">
            <label>Valid From</label>
            <input
              name="validFrom"
              type="date"
              value={form.validFrom}
              onChange={onChange}
              min={today}
              required
            />
          </div>

          <div className="form-group">
            <label>Valid Until</label>
            <input
              name="validTo"
              type="date"
              value={form.validTo}
              onChange={onChange}
              min={form.validFrom || today}
              required
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={onChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Promotion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromotionModal;