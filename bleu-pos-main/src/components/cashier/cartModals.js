import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Receipt, CreditCard, Trash2 } from 'lucide-react';
import { HiOutlineCheck } from 'react-icons/hi';
import { faPercent } from '@fortawesome/free-solid-svg-icons';
import { FiMinus, FiPlus } from "react-icons/fi";
import './cartModals.css';

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
          <button className="discPin-btn-cancel" onClick={closeAddonsModal}>Cancel</button>
          <button className="cAddons-save-btn" onClick={saveAddons}>Add</button>
        </div>
      </div>
    </div>
  );
};

export const ManagerPinModal = ({
  show,
  onClose,
  onSubmit,
  isProcessing,
  error,
}) => {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!show) setPin('');
  }, [show]);

  const handlePinChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 6) setPin(value);
  };

  const handleSubmit = () => {
    if (pin.length >= 4) onSubmit(pin);
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
          <button onClick={onClose} disabled={isProcessing} className="discPin-btn-cancel">Cancel</button>
          <button onClick={handleSubmit} disabled={isProcessing || pin.length < 4} className="discPin-btn-confirm">
            {isProcessing ? 'Verifying...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const DiscountsModal = ({
  showDiscountsModal,
  closeDiscountsModal,
  isLoading,
  error,
  availableDiscounts,
  cartItems,
  getSubtotal,
  getTotalAddonsPrice,
  applyDiscountWithItems,
  appliedDiscounts = [],
  removeAllDiscounts,
  autoPromotion,
}) => {
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [selectedItemsQty, setSelectedItemsQty] = useState({});
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [discountData, setDiscountData] = useState(null);

  useEffect(() => {
    if (!showDiscountsModal) {
      setSelectedDiscount(null);
      setSelectedItemsQty({});
      setShowPinModal(false);
      setPinError('');
      setDiscountData(null);
    }
  }, [showDiscountsModal]);

  // ✅ NEW: Helper to get per-item promotion amount
  const getItemPromotionAmount = (itemIndex) => {
    if (!autoPromotion || !autoPromotion.itemPromotions) return 0;
    const itemPromo = autoPromotion.itemPromotions.find(p => p.itemIndex === itemIndex);
    if (!itemPromo) return 0;
    
    const item = cartItems[itemIndex];
    if (!item) return 0;
    
    // Calculate per-item promotion amount
    return itemPromo.promotionAmount / itemPromo.quantity;
  };

  const handleDiscountSelect = (discount) => {
    if (!discount.isEnabled) return;
    
    const subtotal = getSubtotal();
    const isEligible = !discount.minAmount || subtotal >= discount.minAmount;
    if (!isEligible) return;
    
    if (selectedDiscount?.id === discount.id) {
      setSelectedDiscount(null);
      setSelectedItemsQty({});
    } else {
      setSelectedDiscount(discount);
      setSelectedItemsQty({});
    }
  };

  const itemHasDiscount = (itemIndex) => {
    return appliedDiscounts.some(discount => 
      discount.selectedItemsQty && discount.selectedItemsQty[itemIndex] > 0
    );
  };

  const getAvailableQuantity = (itemIndex) => {
    const item = cartItems[itemIndex];
    const discountedQty = appliedDiscounts.reduce((total, discount) => {
      return total + (discount.selectedItemsQty?.[itemIndex] || 0);
    }, 0);
    return item.quantity - discountedQty;
  };

  const handleItemQuantityChange = (itemIndex, change) => {
    setSelectedItemsQty(prev => {
      const currentQty = prev[itemIndex] || 0;
      const availableQty = getAvailableQuantity(itemIndex);
      const newQty = Math.max(0, Math.min(availableQty, currentQty + change));
      
      if (newQty === 0) {
        const updated = { ...prev };
        delete updated[itemIndex];
        return updated;
      }
      return { ...prev, [itemIndex]: newQty };
    });
  };

  const handleSelectAll = () => {
    if (!selectedDiscount) return;
    
    const eligibleItems = cartItems
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => 
        isItemEligible(item, selectedDiscount) && 
        getAvailableQuantity(index) > 0 &&
        isDiscountBetterThanPromotion(item, index, selectedDiscount) // ✅ NEW CHECK
      );
    
    const allSelected = eligibleItems.every(({ index }) => 
      selectedItemsQty[index] === getAvailableQuantity(index)
    );
    
    if (allSelected) {
      setSelectedItemsQty({});
    } else {
      const newSelected = {};
      eligibleItems.forEach(({ index }) => {
        newSelected[index] = getAvailableQuantity(index);
      });
      setSelectedItemsQty(newSelected);
    }
  };

  const isItemEligible = (item, discount) => {
    if (!discount) return false;
    switch (discount.applicationType) {
      case 'all_products': return true;
      case 'specific_products': return discount.applicableProducts?.includes(item.name);
      case 'specific_categories': return discount.applicableCategories?.includes(item.category);
      default: return false;
    }
  };

  // ✅ NEW: Check if discount is better than promotion for this specific item
  const isDiscountBetterThanPromotion = (item, itemIndex, discount) => {
    if (!discount) return false;
    
    const itemPrice = item.price + getTotalAddonsPrice(item.addons);
    let perItemDiscount = 0;
    
    if (discount.type === 'percentage') {
      perItemDiscount = itemPrice * (discount.value / 100);
    } else if (discount.type === 'fixed') {
      perItemDiscount = Math.min(discount.value, itemPrice);
    }
    
    const itemPromotionAmount = getItemPromotionAmount(itemIndex);
    
    return perItemDiscount > itemPromotionAmount;
  };

  const calculateSelectedSubtotal = () => {
    return Object.entries(selectedItemsQty).reduce((total, [itemIndex, qty]) => {
      const item = cartItems[itemIndex];
      const itemPrice = item.price + getTotalAddonsPrice(item.addons);
      return total + (itemPrice * qty);
    }, 0);
  };

  const calculateItemDiscount = (itemIndex) => {
    const qty = selectedItemsQty[itemIndex];
    if (!selectedDiscount || !qty) return 0;
    
    const item = cartItems[itemIndex];
    const itemSubtotal = (item.price + getTotalAddonsPrice(item.addons)) * qty;
    const selectedSubtotal = calculateSelectedSubtotal();
    if (selectedSubtotal === 0) return 0;
    
    let totalDiscountValue = 0;
    if (selectedDiscount.type === 'percentage') {
      totalDiscountValue = selectedSubtotal * (selectedDiscount.value / 100);
    } else if (selectedDiscount.type === 'fixed') {
      totalDiscountValue = Math.min(selectedDiscount.value, selectedSubtotal);
    }
    
    return (itemSubtotal / selectedSubtotal) * totalDiscountValue;
  };

  const calculateTotalDiscount = () => {
    if (!selectedDiscount || Object.keys(selectedItemsQty).length === 0) return 0;
    const selectedSubtotal = calculateSelectedSubtotal();
    
    if (selectedDiscount.type === 'percentage') {
      return selectedSubtotal * (selectedDiscount.value / 100);
    } else if (selectedDiscount.type === 'fixed') {
      return Math.min(selectedDiscount.value, selectedSubtotal);
    }
    return 0;
  };

  const handleApplyDiscount = () => {
    if (!selectedDiscount || Object.keys(selectedItemsQty).length === 0) {
      alert('Please select a discount and at least one item with quantity.');
      return;
    }

    const data = {
      discount: selectedDiscount,
      selectedItemsQty: selectedItemsQty,
      selectedSubtotal: calculateSelectedSubtotal(),
      totalDiscount: calculateTotalDiscount(),
      itemDiscounts: Object.entries(selectedItemsQty).map(([itemIndex, qty]) => ({
        itemIndex: parseInt(itemIndex),
        quantity: qty,
        discountAmount: calculateItemDiscount(parseInt(itemIndex))
      }))
    };

    setDiscountData(data);
    setPinError('');
    setShowPinModal(true);
  };

  const handlePinVerification = async (pin) => {
    setIsVerifyingPin(true);
    setPinError('');
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://127.0.0.1:4000/users/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Invalid Manager PIN.');
      }

      setShowPinModal(false);
      applyDiscountWithItems(discountData);
      closeDiscountsModal();
    } catch (err) {
      setPinError(err.message);
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleRemoveAllDiscounts = () => {
    if (window.confirm('Are you sure you want to remove all applied discounts?')) {
      if (removeAllDiscounts) removeAllDiscounts();
    }
  };

  if (!showDiscountsModal) return null;

  const subtotal = getSubtotal();
  const eligibleItems = cartItems.filter((item, index) => 
    selectedDiscount ? 
      isItemEligible(item, selectedDiscount) && 
      getAvailableQuantity(index) > 0 &&
      isDiscountBetterThanPromotion(item, index, selectedDiscount) // ✅ NEW CHECK
    : false
  );
  
  const allEligibleSelected = eligibleItems.length > 0 && 
    eligibleItems.every((item) => {
      const itemIndex = cartItems.findIndex(ci => ci === item);
      return selectedItemsQty[itemIndex] === getAvailableQuantity(itemIndex);
    });

  const getTotalSelectedQuantity = () => Object.values(selectedItemsQty).reduce((sum, qty) => sum + qty, 0);

  return (
    <>
      <div className="cDiscount-modal-overlay" onClick={closeDiscountsModal}>
        <div className="cDiscount-modal cDiscount-modal-wide" onClick={(e) => e.stopPropagation()}>
          <div className="cDiscount-modal-header">
            <h3>Apply Discount</h3>
            <button className="cDiscount-close-modal" onClick={closeDiscountsModal}>×</button>
          </div>
          
          <div className="cDiscount-content-split">
            <div className="cDiscount-panel cDiscount-panel-left">
              <div className="cDiscount-panel-header">
                <h4 className="cDiscount-panel-title">Select Discount</h4>
                {appliedDiscounts.length > 0 && (
                  <button 
                    className="cDiscount-remove-all-btn"
                    onClick={handleRemoveAllDiscounts}
                    title="Remove all applied discounts"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <div className="cDiscount-list">
                {isLoading && <p>Loading discounts...</p>}
                {error && <p className="cDiscount-error-message">{error}</p>}
                {!isLoading && !error && availableDiscounts.length === 0 && (
                  <p className="cDiscount-placeholder">No discounts available</p>
                )}
                {!isLoading && !error && availableDiscounts.map(discount => {
                  const isSelected = selectedDiscount?.id === discount.id;
                  const isEligible = !discount.minAmount || subtotal >= discount.minAmount;
                  const isClickable = discount.isEnabled !== false && isEligible;
                  const isLowerThanPromo = discount.isEnabled === false;
                  
                  return (
                    <div 
                      key={discount.id} 
                      className={`cDiscount-item ${isSelected ? 'cDiscount-selected' : ''} ${!isClickable ? 'cDiscount-disabled' : ''}`} 
                      onClick={() => isClickable && handleDiscountSelect(discount)}
                      style={{
                        opacity: isClickable ? 1 : 0.5,
                        cursor: isClickable ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <div className="cDiscount-checkbox">
                        <input 
                          type="radio" 
                          checked={isSelected} 
                          onChange={() => isClickable && handleDiscountSelect(discount)} 
                          disabled={!isClickable} 
                        />
                      </div>
                      <div className="cDiscount-info">
                        <div className="cDiscount-name">{discount.name}</div>
                        <div className="cDiscount-description">
                          <span>
                            {discount.type === 'percentage'
                              ? `${discount.value}% off`
                              : `₱${Number(discount.value).toFixed(2)} off`}
                          </span>
                          {discount.minAmount > 0 && (
                            <span className="cDiscount-min-spend">
                              {' | '}Min. Spend: ₱{Number(discount.minAmount).toFixed(2)}
                            </span>
                          )}
                          {discount.potentialDiscount > 0 && (
                            <span className="cDiscount-potential" style={{color: '#666', marginLeft: '8px'}}>
                              (Saves ₱{discount.potentialDiscount.toFixed(2)})
                            </span>
                          )}
                        </div>
                        {isLowerThanPromo && autoPromotion && (
                          <div className="cDiscount-disabled-reason" style={{fontSize: '11px', color: '#ff9800', marginTop: '4px'}}>
                            Lower than "{autoPromotion.name}" promo (₱{autoPromotion.discountAmount?.toFixed(2)})
                          </div>
                        )}
                        {!isEligible && discount.minAmount > 0 && (
                          <div className="cDiscount-min-requirement" style={{fontSize: '11px', color: '#dc3545', marginTop: '4px'}}>
                            Minimum spend not met
                          </div>
                        )}
                      </div>
                      <div className="cDiscount-icon">
                        <FontAwesomeIcon icon={faPercent} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cDiscount-panel cDiscount-panel-right">
              <div className="cDiscount-panel-header">
                {selectedDiscount && eligibleItems.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allEligibleSelected}
                    onChange={handleSelectAll}
                    className="cDiscount-select-all-checkbox"
                  />
                )}
                <h4 className="cDiscount-panel-title">Select Items & Quantity</h4>
              </div>
              
              <div className="cDiscount-items-list">
                {!selectedDiscount && (
                  <p className="cDiscount-placeholder">Select a discount to choose items</p>
                )}
                
                {selectedDiscount && eligibleItems.length === 0 && (
                  <p className="cDiscount-placeholder">No eligible items for this discount</p>
                )}
                
                {selectedDiscount && eligibleItems.length > 0 && cartItems.map((item, index) => {
                  if (!isItemEligible(item, selectedDiscount)) return null;
                  
                  const availableQty = getAvailableQuantity(index);
                  if (availableQty === 0) return null;
                  
                  // ✅ NEW: Check if discount is better than promotion for this item
                  const canApplyDiscount = isDiscountBetterThanPromotion(item, index, selectedDiscount);
                  
                  if (!canApplyDiscount) return null; // ✅ Don't show items where promo is better
                  
                  const selectedQty = selectedItemsQty[index] || 0;
                  const itemPrice = item.price + getTotalAddonsPrice(item.addons);
                  const itemSubtotal = itemPrice * selectedQty;
                  const itemDiscount = calculateItemDiscount(index);
                  
                  const hasOtherDiscounts = appliedDiscounts.some(discount => 
                    discount.selectedItemsQty && discount.selectedItemsQty[index] > 0
                  );
                  
                  return (
                    <div 
                      key={index}
                      className={`cDiscount-cart-item ${selectedQty > 0 ? 'cDiscount-item-selected' : ''}`}
                    >
                      <img src={item.image} alt={item.name} className="cDiscount-item-image" />
                      
                      <div className="cDiscount-item-details">
                        <div className="cDiscount-item-name">{item.name}</div>
                        <div className="cDiscount-item-meta">
                          Available: {availableQty} × ₱{itemPrice.toFixed(2)}
                          {hasOtherDiscounts && (
                            <span style={{color: '#ff9800', marginLeft: '8px'}}>
                              ({item.quantity - availableQty} already discounted)
                            </span>
                          )}
                        </div>
                        {selectedQty > 0 && (
                          <>
                            <div className="cDiscount-item-subtotal">Subtotal: ₱{itemSubtotal.toFixed(2)}</div>
                            {itemDiscount > 0 && (
                              <div className="cDiscount-item-discount">Discount: -₱{itemDiscount.toFixed(2)}</div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="cDiscount-qty-controls">
                        <button onClick={() => handleItemQuantityChange(index, -1)} disabled={selectedQty === 0}>
                          <FiMinus />
                        </button>
                        <span className="cDiscount-qty-display">{selectedQty}</span>
                        <button onClick={() => handleItemQuantityChange(index, 1)} disabled={selectedQty >= availableQty}>
                          <FiPlus />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="cDiscount-modal-footer">
            <div className="cDiscount-summary">
              <div className="cDiscount-summary-row">
                <span>Selected Quantity:</span>
                <span>{getTotalSelectedQuantity()}</span>
              </div>
              <div className="cDiscount-summary-row">
                <span>Selected Subtotal:</span>
                <span>₱{calculateSelectedSubtotal().toFixed(2)}</span>
              </div>
              <div className="cDiscount-summary-row cDiscount-summary-total">
                <span>Total Discount:</span>
                <span>-₱{calculateTotalDiscount().toFixed(2)}</span>
              </div>
            </div>
            <button 
              className="cDiscount-apply-btn" 
              onClick={handleApplyDiscount}
              disabled={!selectedDiscount || Object.keys(selectedItemsQty).length === 0}
            >
              Apply Discount
            </button>
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

export const TransactionSummaryModal = ({
  showTransactionSummary,
  setShowTransactionSummary,
  cartItems,
  orderType,
  paymentMethod,
  appliedDiscounts = [],
  getTotalAddonsPrice,
  getSubtotal,
  promotionalDiscountValue,
  manualDiscountValue,
  autoPromotion,
  getTotal,
  confirmTransaction,
  isProcessing,
  getItemDiscount,
  getItemDiscountedQty,
  getItemPromotion,
  getItemPromotionQty
}) => {
  if (!showTransactionSummary) return null;

  const getCombinedDiscountsForItem = (itemIndex) => {
    const discountGroups = {};
    
    appliedDiscounts.forEach((discountData) => {
      const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === itemIndex);
      if (!itemDiscountInfo || itemDiscountInfo.discountAmount === 0) return;
      
      const discountName = discountData.discount?.name || 'Discount';
      
      if (!discountGroups[discountName]) {
        discountGroups[discountName] = {
          name: discountName,
          totalQuantity: 0,
          totalAmount: 0
        };
      }
      
      discountGroups[discountName].totalQuantity += itemDiscountInfo.quantity;
      discountGroups[discountName].totalAmount += itemDiscountInfo.discountAmount;
    });
    
    return Object.values(discountGroups);
  };

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
          
          <div className="trnsSummary-order-items">
            <h4>Order Items</h4>
            <div className="trnsSummary-items-scrollable">
              {cartItems.map((item, index) => {
                const itemDiscount = getItemDiscount ? getItemDiscount(index) : 0;
                const itemPromotion = getItemPromotion ? getItemPromotion(index) : 0;
                const itemTotal = (item.price + getTotalAddonsPrice(item.addons)) * item.quantity;
                const combinedDiscounts = getCombinedDiscountsForItem(index);
                const itemPromotionQty = getItemPromotionQty ? getItemPromotionQty(index) : 0;
                
                return (
                <div key={index} className="trnsSummary-summary-item">
                  <div className="trnsSummary-item-row">
                    <div className="trnsSummary-left">
                      <div className="trnsSummary-item-name-row">
                        <span className="trnsSummary-item-name">{item.name}</span>
                        <span className="trnsSummary-quantity">x{item.quantity}</span>
                      </div>

                      <div className="trnsSummary-item-details">
                        {item.addons?.length > 0 && (
                          <div className="trnsSummary-item-addons">
                            {item.addons.map(addon => (
                              <div key={addon.addonId} className="trnsSummary-addon-line">
                                +₱{(addon.price * addon.quantity * item.quantity).toFixed(2)} : {addon.addonName} (x{addon.quantity * item.quantity})
                              </div>
                            ))}
                          </div>
                        )}

                        {combinedDiscounts.length > 0 && (
                          <div className="trnsSummary-item-discount">
                            {combinedDiscounts.map((discount, discIdx) => (
                              <div key={discIdx} className="trnsSummary-discount-line">
                                -₱{discount.totalAmount.toFixed(2)} : {discount.name}
                                <span className="trnsSummary-discount-qty"> (x{discount.totalQuantity})</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {itemPromotion > 0 && autoPromotion?.itemPromotions && (
                          <div className="trnsSummary-item-promotion">
                            <div className="trnsSummary-promotion-line">
                              -₱{itemPromotion.toFixed(2)} :{" "}
                              {autoPromotion.itemPromotions.find(p => p.itemIndex === index)?.promotionName || autoPromotion.name}
                              <span className="trnsSummary-promotion-qty"> (x{itemPromotionQty})</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT SIDE: total (top) and unit price (below) */}
                    <div className="trnsSummary-right">
                      <span className="trnsSummary-item-total">
                        ₱{(itemTotal - itemDiscount - itemPromotion).toFixed(2)}
                      </span>

                      <span className="trnsSummary-unit-price">
                        ₱{item.price.toFixed(2)} each
                      </span>
                    </div>

                  </div>
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
                <span>{autoPromotion?.name || 'Promotion'}:</span>
                <span>-₱{promotionalDiscountValue.toFixed(2)}</span>
              </div>
            )}
            {manualDiscountValue > 0 && (
              <div className="trnsSummary-breakdown-row trnsSummary-discount">
                <span>Discount:</span>
                <span>-₱{manualDiscountValue.toFixed(2)}</span>
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
            <button className="trnsSummary-cancel-btn" onClick={() => setShowTransactionSummary(false)}>Review Order</button>
            <button className="trnsSummary-confirm-btn" onClick={confirmTransaction} disabled={isProcessing}>
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
    if (!showGCashReference) setReferenceNumber("");
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
    <div className="discPin-modal-overlay" onClick={() => setShowGCashReference(false)}>
      <div className="discPin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="discPin-modal-header">
          <h3>GCash Payment</h3>
          <button className="discPin-close-modal" onClick={() => setShowGCashReference(false)}>×</button>
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
          <button onClick={() => setShowGCashReference(false)} disabled={isProcessing} className="discPin-btn-cancel">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!referenceNumber.trim() || isProcessing} className="discPin-btn-confirm">
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