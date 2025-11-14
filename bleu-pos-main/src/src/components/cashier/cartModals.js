import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Receipt, CreditCard } from 'lucide-react';
import { HiOutlineCheck } from 'react-icons/hi';
import { faPercent } from '@fortawesome/free-solid-svg-icons';
import './cartModals.css';

export const ManagerPinModal = ({
  show,
  onClose,
  onSubmit,
  isProcessing,
  error,
}) => {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!show) {
      setPin('');
    }
  }, [show]);

  const handlePinChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 6) {
      setPin(value);
    }
  };

  const handleSubmit = () => {
    if (pin.length >= 4) {
      onSubmit(pin);
    }
  };

  if (!show) return null;

  return (
    <div className="discPin-modal-overlay" onClick={onClose}>
      <div className="discPin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="discPin-modal-header">
          <h3>Manager PIN Required</h3>
          <button className="discPin-close-modal" onClick={onClose}>×</button>
        </div>
        <div className="discPin-modal-content">
          <p>Please ask a manager to enter their PIN to apply discount.</p>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={handlePinChange}
            placeholder="Enter PIN"
            className="discPin-input"
            autoFocus
          />
          {error && <p className="discPin-error-message">{error}</p>}
        </div>
        <div className="discPin-modal-footer">
          <button onClick={onClose} disabled={isProcessing} className="discPin-btn-cancel">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isProcessing || pin.length < 4} className="discPin-btn-confirm">
            {isProcessing ? 'Verifying...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

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

  const getQuantity = (addonId) => {
    const found = addons.find(a => a.addonId === addonId);
    return found ? found.quantity : 0;
  };

  return (
    <div className="cAddons-modal-overlay" onClick={closeAddonsModal}>
      <div className="cAddons-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cAddons-modal-header">
          <h3>Customize Order</h3>
          <button className="cAddons-close-modal" onClick={closeAddonsModal}>×</button>
        </div>

        <div className="cAddons-content">
          {isLoading ? (
            <p className="cAddons-loading">Loading Add-ons...</p>
          ) : availableAddons.length > 0 ? (
            availableAddons.map((availAddon) => {
              const currentQuantity = getQuantity(availAddon.AddOnID);
              return (
                <div key={availAddon.AddOnID} className="cAddons-item">
                  <div className="cAddons-info">
                    <span className="cAddons-name">{availAddon.AddOnName}</span>
                    <span className="cAddons-price">+₱{availAddon.Price.toFixed(2)} each</span>
                  </div>
                  <div className="cAddons-controls">
                    <button onClick={() => updateAddons(availAddon.AddOnID, availAddon.AddOnName, availAddon.Price, Math.max(0, currentQuantity - 1))}>−</button>
                    <span>{currentQuantity}</span>
                    <button onClick={() => updateAddons(availAddon.AddOnID, availAddon.AddOnName, availAddon.Price, currentQuantity + 1)}>+</button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="cAddons-empty">No add-ons available for this item.</p>
          )}
        </div>

        <div className="cAddons-footer">
          <button
            className="discPin-btn-cancel"
            onClick={closeAddonsModal}
          >
            Cancel
          </button>
          <button
            className="cAddons-save-btn"
            onClick={saveAddons}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export const ItemDiscountModal = ({
  showItemDiscountModal,
  closeItemDiscountModal,
  isLoading,
  error,
  availableDiscounts,
  stagedItemDiscounts,
  toggleStagedItemDiscount,
  applyItemDiscounts,
  selectedItem,
  isItemDiscountApplicable,
  calculateItemDiscount
}) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const handleDiscountRequest = () => {
    if (stagedItemDiscounts.length > 0) {
      setPinError(''); 
      setShowPinModal(true);
    } else {
      applyItemDiscounts();
    }
  };

  const handlePinVerification = async (pin) => {
    setIsVerifyingPin(true);
    setPinError('');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://127.0.0.1:4000/users/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Invalid Manager PIN.');
      }

      setShowPinModal(false);
      applyItemDiscounts();

    } catch (err) {
      setPinError(err.message);
    } finally {
      setIsVerifyingPin(false);
    }
  };
  
  useEffect(() => {
    if (!showItemDiscountModal) {
      setShowPinModal(false);
    }
  }, [showItemDiscountModal]);

  if (!showItemDiscountModal) return null;

  return (
    <>
      <div className="cDiscount-modal-overlay" onClick={closeItemDiscountModal}>
        <div className="cDiscount-modal" onClick={(e) => e.stopPropagation()}>
          <div className="cDiscount-modal-header">
            <h3>Item Discount {selectedItem && `- ${selectedItem.name}`}</h3>
            <button className="cDiscount-close-modal" onClick={closeItemDiscountModal}>×</button>
          </div>
          <div className="cDiscount-content">
            {isLoading && <p>Loading discounts...</p>}
            {error && <p className="cDiscount-error-message">{error}</p>}
            {!isLoading && !error && selectedItem && availableDiscounts.map(discount => {
              const isStaged = stagedItemDiscounts.includes(discount.id);
              const isEligible = isItemDiscountApplicable(discount, selectedItem);
              const isDisabled = !isEligible || (stagedItemDiscounts.length > 0 && !isStaged);
              
              return (
                <div 
                  key={discount.id} 
                  className={`cDiscount-item ${isStaged ? 'cDiscount-selected' : ''} ${isDisabled ? 'cDiscount-disabled' : ''}`} 
                  onClick={() => !isDisabled && toggleStagedItemDiscount(discount.id)}
                >
                  <div className="cDiscount-checkbox">
                    <input 
                      type="radio" 
                      checked={isStaged} 
                      onChange={() => !isDisabled && toggleStagedItemDiscount(discount.id)} 
                      disabled={isDisabled} 
                    />
                  </div>
                  <div className="cDiscount-info">
                    <div className="cDiscount-name">{discount.name}</div>
                    <div className="cDiscount-description">
                      <span>
                        {discount.type === 'percentage'
                          ? `Discount: ${discount.value}%`
                          : `Discount: ₱${Number(discount.value).toFixed(2)}`}
                      </span>

                      {discount.minAmount && (
                        <span className="cDiscount-min-spend">
                          {' | '}Min. Spend: ₱{Number(discount.minAmount).toFixed(2)}
                        </span>
                      )}

                      {!isEligible && (
                        <span className="cDiscount-min-requirement"> (Not applicable)</span>
                      )}
                    </div>
                  </div>
                  <div className="cDiscount-icon">
                    <FontAwesomeIcon icon={faPercent} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cDiscount-modal-footer">
            <div className="cDiscount-summary">
              <span>Total Discount: ₱{calculateItemDiscount(stagedItemDiscounts).toFixed(2)}</span>
            </div>
            <button className="cDiscount-apply-btn" onClick={handleDiscountRequest}>Apply</button>
          </div>
        </div>
      </div>

      <ManagerPinModal
        show={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSubmit={handlePinVerification}
        isProcessing={isVerifyingPin}
        error={pinError}
      />
    </>
  );
};

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
  applyDiscounts,
  isDiscountApplicable
}) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const handleDiscountRequest = () => {
    if (stagedDiscounts.length > 0) {
      setPinError(''); 
      setShowPinModal(true);
    } else {
      applyDiscounts();
    }
  };

  const handlePinVerification = async (pin) => {
    setIsVerifyingPin(true);
    setPinError('');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://127.0.0.1:4000/users/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Invalid Manager PIN.');
      }

      setShowPinModal(false);
      applyDiscounts();

    } catch (err) {
      setPinError(err.message);
    } finally {
      setIsVerifyingPin(false);
    }
  };
  
  useEffect(() => {
    if (!showDiscountsModal) {
      setShowPinModal(false);
    }
  }, [showDiscountsModal]);

  if (!showDiscountsModal) return null;

  return (
    <>
      <div className="cDiscount-modal-overlay" onClick={closeDiscountsModal}>
        <div className="cDiscount-modal" onClick={(e) => e.stopPropagation()}>
          <div className="cDiscount-modal-header">
            <h3>Discounts</h3>
            <button className="cDiscount-close-modal" onClick={closeDiscountsModal}>×</button>
          </div>
          <div className="cDiscount-content">
            {isLoading && <p>Loading discounts...</p>}
            {error && <p className="cDiscount-error-message">{error}</p>}
            {!isLoading && !error && availableDiscounts.map(discount => {
              const isStaged = stagedDiscounts.includes(discount.id);
              const subtotal = getSubtotal();
              const isEligible = !discount.minAmount || subtotal >= discount.minAmount;
              
              const isDisabled = !isEligible || (stagedDiscounts.length > 0 && !isStaged);
              
              return (
                <div 
                  key={discount.id} 
                  className={`cDiscount-item ${isStaged ? 'cDiscount-selected' : ''} ${isDisabled ? 'cDiscount-disabled' : ''}`} 
                  onClick={() => !isDisabled && toggleStagedDiscount(discount.id)}
                >
                  <div className="cDiscount-checkbox">
                    <input 
                      type="radio" 
                      checked={isStaged} 
                      onChange={() => !isDisabled && toggleStagedDiscount(discount.id)} 
                      disabled={isDisabled} 
                    />
                  </div>
                  <div className="cDiscount-info">
                    <div className="cDiscount-name">{discount.name}</div>
                    <div className="cDiscount-description">
                      <span>
                        {discount.type === 'percentage'
                          ? `Discount: ${discount.value}%`
                          : `Discount: ₱${Number(discount.value).toFixed(2)}`}
                      </span>

                      {discount.minAmount && (
                        <span className="cDiscount-min-spend">
                          {' | '}Min. Spend: ₱{Number(discount.minAmount).toFixed(2)}
                        </span>
                      )}

                      {!isEligible && discount.minAmount && (
                        <span className="cDiscount-min-requirement"> (Not eligible)</span>
                      )}
                    </div>
                  </div>
                  <div className="cDiscount-icon">
                    <FontAwesomeIcon icon={faPercent} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cDiscount-modal-footer">
            <div className="cDiscount-summary">
              <span>Total Discount: ₱{getStagedDiscount().toFixed(2)}</span>
            </div>
            <button className="cDiscount-apply-btn" onClick={handleDiscountRequest}>Apply</button>
          </div>
        </div>
      </div>

      <ManagerPinModal
        show={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSubmit={handlePinVerification}
        isProcessing={isVerifyingPin}
        error={pinError}
        title="Manager Authorization"
        description="Please enter a manager PIN to apply discounts."
      />
    </>
  );
};

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
  promotionalDiscountValue,
  manualDiscountValue,
  itemDiscountsValue,
  autoPromotion,
  getTotal,
  confirmTransaction,
  isProcessing,
  calculateItemDiscount,
  getItemDiscountsSummary
}) => {
  if (!showTransactionSummary) return null;

  const allAppliedDiscountNames = [];
  if (autoPromotion) {
    allAppliedDiscountNames.push(autoPromotion.name);
  }
  const manualDiscountNames = appliedDiscounts.map(discountId => {
    const discount = availableDiscounts.find(d => d.id === discountId);
    return discount ? discount.name : '';
  }).filter(Boolean);

  allAppliedDiscountNames.push(...manualDiscountNames);

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
              <span className="trnsSummary-label">
                <Receipt size={16} className="trnsSummary-modal-icon" />
                ORDER TYPE
              </span>
              <span className="trnsSummary-value">{orderType}</span>
            </div>
            <div className="trnsSummary-info-item">
              <span className="trnsSummary-label">
                <CreditCard size={16} className="trnsSummary-modal-icon" />
                PAYMENT METHOD
              </span>
              <span className="trnsSummary-value">{paymentMethod}</span>
            </div>
          </div>

          {allAppliedDiscountNames.length > 0 && (
            <div className="trnsSummary-applied-discounts">
              <div className="trnsSummary-applied-discounts-header">
                <h4>Applied Discounts & Promotions</h4>
                <div className="trnsSummary-applied-discounts-list">
                  {autoPromotion && (
                    <div className="trnsSummary-discount-item-summary">
                      <FontAwesomeIcon icon={faPercent} />
                      <span>Promo: {autoPromotion.name}</span>
                    </div>
                  )}
                  {appliedDiscounts.map((discountId, index) => {
                    const discount = availableDiscounts.find(d => d.id === discountId);
                    if (!discount) return null;
                    return (
                      <div key={index} className="trnsSummary-discount-item-summary">
                        <FontAwesomeIcon icon={faPercent} />
                        <span>Discount: {discount.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          <div className="trnsSummary-order-items">
          <h4>Order Items</h4>
          <div className="trnsSummary-items-scrollable">
            {cartItems.map((item, index) => {
              const itemDiscount = calculateItemDiscount ? calculateItemDiscount(item) : 0;
              const itemTotal = (item.price + getTotalAddonsPrice(item.addons)) * item.quantity;
              const itemDiscountSummary = getItemDiscountsSummary ? getItemDiscountsSummary(item) : null;
              
              return (
                <div key={index} className="trnsSummary-summary-item">
                  <div className="trnsSummary-item-header">
                    <span className="trnsSummary-item-name">{item.name}</span>
                    <span className="trnsSummary-item-total">
                      ₱{(itemTotal - itemDiscount).toFixed(2)}
                    </span>
                  </div>
                  <div className="trnsSummary-item-details">
                    <span className="trnsSummary-quantity">Qty: {item.quantity}</span>
                    <span className="trnsSummary-base-price">₱{item.price.toFixed(2)} each</span>
                  </div>
                  {item.addons && item.addons.length > 0 && (
                    <div className="trnsSummary-item-addons">
                      {item.addons.map(addon => (
                        <span key={addon.addonId}>
                          • {addon.quantity} {addon.addonName} (+₱{(addon.price * addon.quantity).toFixed(2)})
                        </span>
                      ))}
                    </div>
                  )}
                  {itemDiscountSummary && itemDiscount > 0 && (
                    <div className="trnsSummary-item-discount">
                      <span>
                        🏷️ {itemDiscountSummary}: -₱{itemDiscount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          
          <div className="trnsSummary-price-breakdown">
            <div className="trnsSummary-breakdown-row">
              <span>Subtotal:</span>
              <span>₱{getSubtotal().toFixed(2)}</span>
            </div>

            {promotionalDiscountValue > 0 && (
              <div className="trnsSummary-breakdown-row trnsSummary-discount">
                <span>Promotion:</span>
                <span>-₱{promotionalDiscountValue.toFixed(2)}</span>
              </div>
            )}

            {manualDiscountValue > 0 && (
              <div className="trnsSummary-breakdown-row trnsSummary-discount">
                <span>Discount:</span>
                <span>-₱{manualDiscountValue.toFixed(2)}</span>
              </div>
            )}

            {itemDiscountsValue > 0 && (
              <div className="trnsSummary-breakdown-row trnsSummary-discount">
                <span>Item Discounts:</span>
                <span>-₱{itemDiscountsValue.toFixed(2)}</span>
              </div>
            )}
            
            <div className="trnsSummary-breakdown-row trnsSummary-total">
              <span>Total Amount:</span>
              <span>₱{getTotal().toFixed(2)}</span>
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

export const GCashReferenceModal = ({
  showGCashReference,
  setShowGCashReference,
  onSubmit,
  isProcessing,
  error
}) => {
  const [referenceNumber, setReferenceNumber] = useState("");

  useEffect(() => {
    if (!showGCashReference) {
      setReferenceNumber("");
    }
  }, [showGCashReference]);

  if (!showGCashReference) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (referenceNumber.trim()) {
      onSubmit(referenceNumber.trim());
      setReferenceNumber("");
    }
  };

  return (
    <div
      className="discPin-modal-overlay"
      onClick={() => setShowGCashReference(false)}
    >
      <div
        className="discPin-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="discPin-modal-header">
          <h3>GCash Payment</h3>
          <button
            className="discPin-close-modal"
            onClick={() => setShowGCashReference(false)}
          >
            ×
          </button>
        </div>

        <div className="discPin-modal-content">
          <p>Please enter GCash reference number:</p>
          <input
            type="text"
            placeholder="Enter reference number"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="discPin-input"
            disabled={isProcessing}
            autoFocus
          />
          {error && <p className="discPin-error-message">{error}</p>}
        </div>

        <div className="discPin-modal-footer">
          <button
            onClick={() => setShowGCashReference(false)}
            disabled={isProcessing}
            className="discPin-btn-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!referenceNumber.trim() || isProcessing}
            className="discPin-btn-confirm"
          >
            {isProcessing ? "Processing..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const OrderConfirmationModal = ({
  showConfirmation,
  setShowConfirmation,
  onClose,
}) => {
  const navigate = useNavigate();

  if (!showConfirmation) return null;

  return (
    <div className="Oconfirm-overlay">
      <div className="Oconfirm-modal">
        <div className="Oconfirm-close" onClick={onClose}>
          &times;
        </div>
        <div className="Oconfirm-icon Oconfirm-success">
          <HiOutlineCheck />
        </div>
        <h1>Order Confirmed!</h1>
        <p>Order has been placed successfully.</p>
        <div className="Oconfirm-button-group">
          <button onClick={onClose}>Stay Here</button>
          <button onClick={() => navigate('/cashier/orders')}>Go to Orders</button>
        </div>
      </div>
    </div>
  );
};