import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPercent } from '@fortawesome/free-solid-svg-icons';

// Add-ons Modal Component
export const AddonsModal = ({
  showAddonsModal,
  closeAddonsModal,
  addons,
  updateAddons,
  saveAddons,
  addonPrices
}) => {
  if (!showAddonsModal) return null;

  return (
    <div className="modal-overlay" onClick={closeAddonsModal}>
      <div className="addons-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Customize Order</h3>
          <button className="close-modal" onClick={closeAddonsModal}>×</button>
        </div>
        <div className="addons-content">
          <div className="addon-item">
            <div className="addon-info">
              <span className="addon-name">Espresso Shots</span>
              <span className="addon-price">+₱{addonPrices.espressoShots} each</span>
            </div>
            <div className="addon-controls">
              <button onClick={() => updateAddons('espressoShots', addons.espressoShots - 1)}>−</button>
              <span>{addons.espressoShots}</span>
              <button onClick={() => updateAddons('espressoShots', addons.espressoShots + 1)}>+</button>
            </div>
          </div>
          <div className="addon-item">
            <div className="addon-info">
              <span className="addon-name">Sea Salt Cream</span>
              <span className="addon-price">+₱{addonPrices.seaSaltCream} each</span>
            </div>
            <div className="addon-controls">
              <button onClick={() => updateAddons('seaSaltCream', addons.seaSaltCream - 1)}>−</button>
              <span>{addons.seaSaltCream}</span>
              <button onClick={() => updateAddons('seaSaltCream', addons.seaSaltCream + 1)}>+</button>
            </div>
          </div>
          <div className="addon-item">
            <div className="addon-info">
              <span className="addon-name">Syrups/Sauces</span>
              <span className="addon-price">+₱{addonPrices.syrupSauces} each</span>
            </div>
            <div className="addon-controls">
              <button onClick={() => updateAddons('syrupSauces', addons.syrupSauces - 1)}>−</button>
              <span>{addons.syrupSauces}</span>
              <button onClick={() => updateAddons('syrupSauces', addons.syrupSauces + 1)}>+</button>
            </div>
          </div>
        </div>
        <div className="modal-footer-addons">
          <button className="addon-save-btn" onClick={saveAddons}>Save Add-ons</button>
        </div>
      </div>
    </div>
  );
};

// Discounts Modal Component
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

// Transaction Summary Modal Component
export const TransactionSummaryModal = ({
  showTransactionSummary,
  setShowTransactionSummary,
  cartItems,
  orderType,
  paymentMethod,
  appliedDiscounts,
  availableDiscounts,
  getTotalAddonsPrice,
  addonPrices,
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
                  {item.addons && getTotalAddonsPrice(item.addons) > 0 && (
                    <div className="trnsSummary-item-addons">
                      {item.addons.espressoShots > 0 && (
                        <span>• {item.addons.espressoShots} Espresso Shot(s) (+₱{(addonPrices.espressoShots * item.addons.espressoShots).toFixed(0)})</span>
                      )}
                      {item.addons.seaSaltCream > 0 && (
                        <span>• {item.addons.seaSaltCream} Sea Salt Cream (+₱{(addonPrices.seaSaltCream * item.addons.seaSaltCream).toFixed(0)})</span>
                      )}
                      {item.addons.syrupSauces > 0 && (
                        <span>• {item.addons.syrupSauces} Syrup/Sauce(s) (+₱{(addonPrices.syrupSauces * item.addons.syrupSauces).toFixed(0)})</span>
                      )}
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

// GCash Reference Modal Component
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

// Order Confirmation Modal Component
export const OrderConfirmationModal = ({
  showConfirmation,
  setShowConfirmation
}) => {
  const navigate = useNavigate();

  if (!showConfirmation) return null;

  const handleClose = () => {
    setShowConfirmation(false);
    // Optionally navigate to a different page or refresh
    // navigate('/dashboard');
  };

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