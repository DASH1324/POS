import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPercent } from '@fortawesome/free-solid-svg-icons';

// --- MODIFICATION: AddonsModal is now fully dynamic ---
export const AddonsModal = ({
  showAddonsModal,
  closeAddonsModal,
  addons,
  availableAddons,
  isLoading,
  updateAddons,
  saveAddons,
}) => {
  if (!showAddonsModal) return null;

  // Helper to find the quantity of a currently selected addon
  const getQuantity = (addonId) => {
    const found = addons.find(a => a.addonId === addonId);
    return found ? found.quantity : 0;
  };

  return (
    <div className="modal-overlay" onClick={closeAddonsModal}>
      <div className="addons-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Customize Order</h3>
          <button className="close-modal" onClick={closeAddonsModal}>×</button>
        </div>
        <div className="addons-content">
          {isLoading ? (
            <p style={{ textAlign: 'center' }}>Loading Add-ons...</p>
          ) : availableAddons.length > 0 ? (
            availableAddons.map((availAddon) => {
              const currentQuantity = getQuantity(availAddon.AddOnID);
              return (
                <div key={availAddon.AddOnID} className="addon-item">
                  <div className="addon-info">
                    <span className="addon-name">{availAddon.AddOnName}</span>
                    <span className="addon-price">+₱{availAddon.Price.toFixed(2)} each</span>
                  </div>
                  <div className="addon-controls">
                    <button onClick={() => updateAddons(availAddon.AddOnID, availAddon.AddOnName, availAddon.Price, Math.max(0, currentQuantity - 1))}>−</button>
                    <span>{currentQuantity}</span>
                    <button onClick={() => updateAddons(availAddon.AddOnID, availAddon.AddOnName, availAddon.Price, currentQuantity + 1)}>+</button>
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ textAlign: 'center', color: '#888' }}>No add-ons available for this item.</p>
          )}
        </div>
        <div className="modal-footer-addons">
          <button className="addon-save-btn" onClick={saveAddons}>Save Add-ons</button>
        </div>
      </div>
    </div>
  );
};


// Discounts Modal Component (No changes needed)
export const DiscountsModal = ({
  showDiscountsModal,
  closeDiscountsModal,
  isLoading,
  error,
  availableDiscounts,
  stagedDiscounts,
  toggleStagedDiscount,
  getSubtotal,
  getStagedDiscount,
  applyDiscounts
}) => {
  if (!showDiscountsModal) return null;

  return (
    <div className="modal-overlay" onClick={closeDiscountsModal}>
      <div className="discounts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Apply Discounts</h3>
          <button className="close-modal" onClick={closeDiscountsModal}>×</button>
        </div>
        <div className="discounts-content">
          {isLoading && <p>Loading discounts...</p>}
          {error && <p className="error-message">{error}</p>}
          {!isLoading && !error && availableDiscounts.map(discount => {
            const isStaged = stagedDiscounts.includes(discount.id);
            const subtotal = getSubtotal();
            const isEligible = !discount.minAmount || subtotal >= discount.minAmount;
            
            return (
              <div 
                key={discount.id} 
                className={`discount-item ${isStaged ? 'selected' : ''} ${!isEligible ? 'disabled' : ''}`} 
                onClick={() => isEligible && toggleStagedDiscount(discount.id)}
              >
                <div className="discount-checkbox">
                  <input 
                    type="checkbox" 
                    checked={isStaged} 
                    onChange={() => isEligible && toggleStagedDiscount(discount.id)} 
                    disabled={!isEligible} 
                  />
                </div>
                <div className="discount-info">
                  <div className="discount-name">{discount.name}</div>
                  <div className="discount-description">
                    {discount.description}
                    {!isEligible && discount.minAmount && (
                      <span className="min-requirement"> (Min. ₱{discount.minAmount})</span>
                    )}
                  </div>
                </div>
                <div className="discount-icon">
                  <FontAwesomeIcon icon={faPercent} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="modal-footer-discount">
          <div className="discount-summary">
            <span>Total Discount: ₱{getStagedDiscount().toFixed(0)}</span>
          </div>
          <button className="apply-btn" onClick={applyDiscounts}>Apply Discounts</button>
        </div>
      </div>
    </div>
  );
};

// --- MODIFICATION: TransactionSummaryModal now renders addons dynamically ---
export const TransactionSummaryModal = ({
  showTransactionSummary,
  setShowTransactionSummary,
  cartItems,
  orderType,
  paymentMethod,
  appliedDiscounts,
  availableDiscounts,
  getTotalAddonsPrice,
  getSubtotal,
  getDiscount,
  getTotal,
  confirmTransaction,
  isProcessing
}) => {
  if (!showTransactionSummary) return null;

  const getAppliedDiscountNames = () => appliedDiscounts.map(discountId => {
    const discount = availableDiscounts.find(d => d.id === discountId);
    return discount ? discount.name : '';
  }).filter(name => name !== '');

  return (
    <div className="trnsSummary-modal-overlay" onClick={() => setShowTransactionSummary(false)}>
      <div className="trnsSummary-transaction-summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trnsSummary-modal-header">
          <h3>Transaction Summary</h3>
          <button className="trnsSummary-close-modal" onClick={() => setShowTransactionSummary(false)}>×</button>
        </div>
        <div className="trnsSummary-summary-content">
          <div className="trnsSummary-order-info-grid">
            <div className="trnsSummary-info-item">
              <span className="trnsSummary-label">Order Type:</span>
              <span className="trnsSummary-value">{orderType}</span>
            </div>
            <div className="trnsSummary-info-item">
              <span className="trnsSummary-label">Payment Method:</span>
              <span className="trnsSummary-value">{paymentMethod}</span>
            </div>
          </div>
          
          <div className="trnsSummary-order-items">
            <h4>Order Items</h4>
            <div className="trnsSummary-items-scrollable">
              {cartItems.map((item, index) => (
                <div key={index} className="trnsSummary-summary-item">
                  <div className="trnsSummary-item-header">
                    <span className="trnsSummary-item-name">{item.name}</span>
                    <span className="trnsSummary-item-total">
                      ₱{((item.price + getTotalAddonsPrice(item.addons)) * item.quantity).toFixed(0)}
                    </span>
                  </div>
                  <div className="trnsSummary-item-details">
                    <span className="trnsSummary-quantity">Qty: {item.quantity}</span>
                    <span className="trnsSummary-base-price">₱{item.price.toFixed(0)} each</span>
                  </div>
                  {/* Updated addon rendering logic */}
                  {item.addons && item.addons.length > 0 && (
                    <div className="trnsSummary-item-addons">
                      {item.addons.map(addon => (
                        <span key={addon.addonId}>
                          • {addon.quantity} {addon.addonName} (+₱{(addon.price * addon.quantity).toFixed(0)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {appliedDiscounts.length > 0 && (
            <div className="trnsSummary-applied-discounts">
              <div className="trnsSummary-applied-discounts-header">
                <h4>Applied Discounts</h4>
                <div className="trnsSummary-applied-discounts-list">
                  {getAppliedDiscountNames().map((discountName, index) => (
                    <div key={index} className="trnsSummary-discount-item-summary">
                      <FontAwesomeIcon icon={faPercent} />
                      <span>{discountName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="trnsSummary-price-breakdown">
            <div className="trnsSummary-breakdown-row">
              <span>Subtotal:</span>
              <span>₱{getSubtotal().toFixed(0)}</span>
            </div>
            {getDiscount() > 0 && (
              <div className="trnsSummary-breakdown-row trnsSummary-discount">
                <span>Discount:</span>
                <span>-₱{getDiscount().toFixed(0)}</span>
              </div>
            )}
            <hr />
            <div className="trnsSummary-breakdown-row trnsSummary-total">
              <span>Total Amount:</span>
              <span>₱{getTotal().toFixed(0)}</span>
            </div>
          </div>
        </div>
        <div className="trnsSummary-confirmation-section">
          <div className="trnsSummary-modal-footer-transaction">
            <button className="trnsSummary-cancel-btn" onClick={() => setShowTransactionSummary(false)}>
              Review Order
            </button>
            <button 
              className="trnsSummary-confirm-btn" 
              onClick={confirmTransaction} 
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Confirm & Process'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// GCash Reference Modal Component (No changes needed)
export const GCashReferenceModal = ({
  showGCashReference,
  setShowGCashReference,
  onSubmit,
  isProcessing
}) => {
  const [referenceNumber, setReferenceNumber] = useState('');

  if (!showGCashReference) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (referenceNumber.trim()) {
      onSubmit(referenceNumber.trim());
      setReferenceNumber('');
    }
  };

  return (
    <div className="gcash-modal-overlay" onClick={() => setShowGCashReference(false)}>
      <div className="gcash-reference-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gcash-modal-header">
          <h3>GCash Payment</h3>
          <button className="gcash-close-modal" onClick={() => setShowGCashReference(false)}>×</button>
        </div>
        <div className="gcash-modal-content">
          <p>Please enter your GCash reference number:</p>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Enter GCash reference number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="gcash-reference-input"
              required
              disabled={isProcessing}
            />
            <div className="gcash-modal-footer">
              <button 
                type="submit" 
                className="gcash-submit-btn"
                disabled={!referenceNumber.trim() || isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Submit Reference'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Order Confirmation Modal Component (No changes needed)
export const OrderConfirmationModal = ({
  showConfirmation,
  setShowConfirmation
}) => {
  const navigate = useNavigate();

  if (!showConfirmation) return null;

  return (
    <div className="order-confirmation-overlay">
      <div className="order-confirmation-modal">
        <div className="order-confirmation-icon">✔</div>
        <div className="order-confirmation-title">Order Confirmed!</div>
        <div className="order-confirmation-subtext">
          Order has been placed successfully.
        </div>
        <div className="order-confirmation-buttons-row">
          <button
            className="order-confirmation-btn secondary"
            onClick={() => setShowConfirmation(false)}
          >
            Stay Here
          </button>
          <button
            className="order-confirmation-btn"
            onClick={() => navigate('/cashier/orders')}
          >
            Go to Orders
          </button>
        </div>
      </div>
    </div>
  );
};