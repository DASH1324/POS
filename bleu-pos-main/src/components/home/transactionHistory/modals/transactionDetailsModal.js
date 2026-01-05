import React, { useState } from "react";
import { FaRegUser } from "react-icons/fa";
import { IoMdTimer } from "react-icons/io";
import { TbPaperBag } from "react-icons/tb";
import { MdOutlinePayments } from "react-icons/md";
import "./transactionDetailsModal.css";

// Helper: Get user role from local storage
const getIsUserAdmin = () => {
  return localStorage.getItem("userRole") === "admin";
}

const TransHisModal = ({ 
  show, 
  transaction, 
  onClose, 
  onCancelOrder, 
  onRefundOrder, 
  onPartialRefund,
  cashiersMap 
}) => {

  const [refundMode, setRefundMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  
  const isUserAdmin = getIsUserAdmin(); 

  // Get refund info from backend
  const totalRefundedAmount = transaction?.refundInfo?.totalRefundAmount || 0;

  if (!show || !transaction) return null;

  // Check if this is a full refund
  const isFullRefund = () => {
    if (!transaction.items) return false;
    
    const totalOrderQty = transaction.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalRefundedQty = transaction.items.reduce((sum, item) => sum + (item.refundedQuantity || 0), 0);
    
    return totalRefundedQty === totalOrderQty && totalOrderQty > 0;
  };

  // Calculate the correct refund amount to display
  const getDisplayRefundAmount = () => {
    if (totalRefundedAmount === 0) return 0;
    
    if (isFullRefund()) {
      // For full refunds, return the actual total paid (subtotal - discounts - promotions)
      const actualTotal = transaction.subtotal - (transaction.discount || 0) - (transaction.promotionalDiscount || 0);
      return Math.max(0, actualTotal);
    }
    
    // For partial refunds, use backend's calculation
    return totalRefundedAmount;
  };

  // Calculate the final total to display
  const calculateFinalTotal = () => {
    let total = transaction.subtotal || 0;
    total -= (transaction.discount || 0);
    total -= (transaction.promotionalDiscount || 0);
    
    // Subtract the correct refund amount
    total -= getDisplayRefundAmount();
    
    return Math.max(0, total);
  };

  const handleRefundOrder = () => {
    if (refundMode) {
      // Partial refund logic...
      const itemsToRefund = transaction.items
        .map((item, index) => {
          const refundQty = selectedItems[index] || 0;
          const availableQty = item.quantity - (item.refundedQuantity || 0);
          if (refundQty > 0 && availableQty > 0) {
            return {
              saleItemId: item.saleItemId || item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              refundQuantity: Math.min(refundQty, availableQty)
            };
          }
          return null;
        })
        .filter(item => item !== null);

      if (itemsToRefund.length === 0) {
        alert("Please select at least one item to refund");
        return;
      }

      if (onPartialRefund) {
        onPartialRefund(transaction, itemsToRefund);
      }
    } else {
      // Full refund logic...
      if (onRefundOrder) {
        onRefundOrder(transaction);
      }
    }
  };

  const toggleRefundMode = () => {
    setRefundMode(!refundMode);
    setSelectedItems({});
  };

  const updateItemQuantity = (index, quantity) => {
    const item = transaction.items[index];
    const availableQty = item.quantity - (item.refundedQuantity || 0);
    const validQty = Math.max(0, Math.min(quantity, availableQty));
    setSelectedItems(prev => ({
      ...prev,
      [index]: validQty
    }));
  };

  // Calculate accurate refund total accounting for discounts & promotions
  const calculateRefundTotal = () => {
    let total = 0;
    
    transaction.items.forEach((item, index) => {
      const qty = selectedItems[index] || 0;
      if (qty <= 0) return;

      // Calculate base item cost for ALL items
      let itemTotal = item.price * item.quantity;

      // Add addon costs
      if (item.addons && item.addons.length > 0) {
        const addonTotal = item.addons.reduce((sum, addon) => 
          sum + (addon.price * addon.quantity), 0
        );
        itemTotal += addonTotal;
      }

      // Subtract item-level discounts
      if (item.itemDiscounts && item.itemDiscounts.length > 0) {
        const discountTotal = item.itemDiscounts.reduce((sum, discount) => 
          sum + (discount.discountAmount || 0), 0
        );
        itemTotal -= discountTotal;
      }

      // Subtract item-level promotions
      if (item.itemPromotions && item.itemPromotions.length > 0) {
        const promoTotal = item.itemPromotions.reduce((sum, promo) => 
          sum + (promo.promotionAmount || 0), 0
        );
        itemTotal -= promoTotal;
      }

      // Calculate net price per unit
      const netPricePerUnit = itemTotal / item.quantity;
      
      // Calculate refund for selected quantity
      total += netPricePerUnit * qty;
    });

    return total;
  };

  const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);
  const hasRefundedItems = transaction.items?.some(item => 
    item.refundedQuantity && item.refundedQuantity > 0
  );
  
  const isRefunded = transaction.status.toLowerCase() === 'refunded' || totalRefundedAmount > 0;
  
  // Check if transaction is from today
  const isToday = () => {
    const transactionDate = new Date(transaction.date);
    const today = new Date();
    
    return transactionDate.getDate() === today.getDate() &&
           transactionDate.getMonth() === today.getMonth() &&
           transactionDate.getFullYear() === today.getFullYear();
  };

  const displayRefundAmount = getDisplayRefundAmount();
  const finalTotal = calculateFinalTotal();

  return (
    <div className="transHis-modal-overlay" onClick={onClose}>
      <div className="transHis-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="transHis-modal-header">
          <h3>Transaction Details</h3>
          <div className="transHis-modal-header-right">
            {hasRefundedItems && transaction.status.toLowerCase() !== 'refunded' ? (
              <span className="transHis-modal-status partially-refunded">
                Part-Refund
              </span>
            ) : (
              <span className={`transHis-modal-status ${transaction.status.toLowerCase()}`}>
                {transaction.status}
              </span>
            )}
            <button className="transHis-modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Content */}
        <div className="transHis-modal-content">
          {/* Transaction Info Grid */}
          <div className="transHis-modal-info-grid">
             <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">
                <IoMdTimer size={18} className="transHis-modal-icon" />
                DATE & TIME
              </span>
              <div className="transHis-modal-value">
                <div>{new Date(transaction.date).toLocaleDateString()}</div>
                <div className="transHis-modal-time">
                  {new Date(transaction.date).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">
                <TbPaperBag size={18} className="transHis-modal-icon" />
                ORDER TYPE
              </span>
              <div className="transHis-modal-value">
                <div>{transaction.orderType}</div>
              </div>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">
                <MdOutlinePayments size={18} className="transHis-modal-icon" />
                PAYMENT
              </span>
              <div className="transHis-modal-value">
                <div>{transaction.paymentMethod}</div>
                {transaction.paymentMethod && transaction.paymentMethod.toLowerCase() === "gcash" && transaction.GCashReferenceNumber && (
                  <div className="transHis-modal-time">
                    Ref No. <span className="gcash-ref">{transaction.GCashReferenceNumber}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">
                <FaRegUser size={16} className="transHis-modal-icon" />
                CASHIER
              </span>
              <div className="transHis-modal-value">
                <div>{cashiersMap[transaction.cashierName] || transaction.cashierName || "—"}</div>
              </div>
            </div>
          </div>

          {/* Refund Reason */}
          {(isRefunded || hasRefundedItems) && transaction.refundInfo?.reason && (
            <div className="transHis-modal-refund-reason-section">
              <div className="transHis-modal-refund-reason-label">
                Refund Reason:
              </div>
              <div className="transHis-modal-refund-reason-text">
                {transaction.refundInfo.reason}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="transHis-modal-order-items">
            <div className="transHis-modal-items-header">
              <h4>Order Items</h4>
              <span className="transHis-modal-item-count">{transaction.items.length} items</span>
              {refundMode && (
                <span className="transHis-modal-refund-mode-indicator">
                  Select items to refund
                </span>
              )}
            </div>
            <div className="transHis-modal-items-scrollable">
              {(() => {
                const groupedItems = [];
                const processedIndices = new Set();
                const promotionGroups = new Map();
                
                // Group items by BOGO promotions
                transaction.items.forEach((item, idx) => {
                  if (processedIndices.has(idx)) return;
                  
                  const itemPromotions = (item.itemPromotions || []);
                  const promotion = itemPromotions.length > 0 ? itemPromotions[0] : null;
                  
                  if (promotion && promotion.promotionName) {
                    const promoName = promotion.promotionName;
                    
                    if (!promotionGroups.has(promoName)) {
                      const bogoGroup = {
                        type: 'bogo',
                        promoName: promoName,
                        items: []
                      };
                      
                      transaction.items.forEach((otherItem, otherIdx) => {
                        if (processedIndices.has(otherIdx)) return;
                        
                        const otherPromotions = (otherItem.itemPromotions || []);
                        const hasSamePromo = otherPromotions.some(p => 
                          p.promotionName === promoName
                        );
                        
                        if (hasSamePromo) {
                          bogoGroup.items.push({ item: otherItem, index: otherIdx });
                          processedIndices.add(otherIdx);
                        }
                      });
                      
                      promotionGroups.set(promoName, bogoGroup);
                      groupedItems.push(bogoGroup);
                    }
                  } else if (!processedIndices.has(idx)) {
                    groupedItems.push({
                      type: 'regular',
                      item: item,
                      index: idx
                    });
                    processedIndices.add(idx);
                  }
                });
                
                return groupedItems.map((group, groupIdx) => {
                  if (group.type === 'bogo') {
                    // BOGO Group Display
                    const totalPromoAmount = group.items.reduce((sum, { item }) => {
                      const itemPromotions = (item.itemPromotions || []);
                      return sum + itemPromotions.reduce((pSum, p) => pSum + p.promotionAmount, 0);
                    }, 0);
                    
                    return (
                      <div key={`bogo-group-${groupIdx}`} className="transHis-modal-bogo-group">
                        
                        <div className="transHis-modal-bogo-items">
                          {group.items.map(({ item, index: idx }) => {
                            const availableQty = item.quantity - (item.refundedQuantity || 0);
                            const isFullyRefunded = item.isFullyRefunded || availableQty <= 0;
                            const isPartiallyRefunded = item.refundedQuantity > 0 && !isFullyRefunded;

                            return (
                              <div 
                                key={idx} 
                                className={`transHis-modal-item transHis-modal-bogo-item ${isFullyRefunded ? 'fully-refunded' : ''} ${isPartiallyRefunded ? 'partially-refunded' : ''}`}
                              >
                                <div className="transHis-modal-item-content">
                                  <div className="transHis-modal-item-header">
                                    <div className="transHis-modal-item-left">
                                      <div className="transHis-modal-item-name-container">
                                        <span className="transHis-modal-item-name">{item.name}</span>
                                        <span className="transHis-modal-quantity">x{item.quantity}</span>
                                      </div>
                                      
                                      {item.addons && item.addons.length > 0 && (
                                        <div className="transHis-modal-item-addons">
                                          {item.addons.map((addon, addonIdx) => (
                                            <div key={addonIdx} className="transHis-modal-addon-detail">
                                              + ₱{(addon.price * addon.quantity).toFixed(2)} : {addon.addonName} (x{addon.quantity})
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {item.itemDiscounts && item.itemDiscounts.length > 0 && (
                                        <div className="transHis-modal-item-discount-applied">
                                          {(() => {
                                            const combinedDiscounts = {};
                                            item.itemDiscounts.forEach(discount => {
                                              if (!combinedDiscounts[discount.discountName]) {
                                                combinedDiscounts[discount.discountName] = { name: discount.discountName, totalQuantity: 0, totalAmount: 0 };
                                              }
                                              combinedDiscounts[discount.discountName].totalQuantity += discount.quantityDiscounted;
                                              combinedDiscounts[discount.discountName].totalAmount += discount.discountAmount;
                                            });
                                            
                                            return Object.values(combinedDiscounts).map((discount, discIdx) => (
                                              <div key={discIdx} className="transHis-modal-discount-info">
                                                - ₱{discount.totalAmount.toFixed(2)} : {discount.name} (x{discount.totalQuantity})
                                              </div>
                                            ));
                                          })()}
                                        </div>
                                      )}

                                      {item.itemPromotions && item.itemPromotions.length > 0 && (
                                        <div className="transHis-modal-item-discount-applied">
                                          {(() => {
                                            const combinedPromotions = {};
                                            item.itemPromotions.forEach(promo => {
                                              if (!combinedPromotions[promo.promotionName]) {
                                                combinedPromotions[promo.promotionName] = { name: promo.promotionName, totalQuantity: 0, totalAmount: 0 };
                                              }
                                              combinedPromotions[promo.promotionName].totalQuantity += promo.quantityPromoted;
                                              combinedPromotions[promo.promotionName].totalAmount += promo.promotionAmount;
                                            });
                                            
                                            return Object.values(combinedPromotions).map((promo, promoIdx) => (
                                              <div key={promoIdx} className="transHis-modal-discount-info">
                                                - ₱{promo.totalAmount.toFixed(2)} : {promo.name} (x{promo.totalQuantity})
                                              </div>
                                            ));
                                          })()}
                                        </div>
                                      )}
                                      
                                      {item.refundedQuantity > 0 && (
                                        <div className="transHis-modal-refunded-indicator">
                                          <span className="refunded-qty-badge">{item.refundedQuantity} Refunded</span>
                                        </div>
                                      )}
                                    </div>

                                    {refundMode && !isFullyRefunded && (
                                      <div className="transHis-modal-qty-price">
                                        <button onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) - 1)} disabled={!selectedItems[idx] || selectedItems[idx] <= 0}>-</button>
                                        <span>{selectedItems[idx] || 0}</span>
                                        <button onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) + 1)} disabled={selectedItems[idx] >= availableQty}>+</button>
                                      </div>
                                    )}

                                    <div className="transHis-modal-item-right">
                                      <span className="transHis-modal-item-total-price">
                                        ₱{(() => {
                                          const baseTotal = item.price * item.quantity;
                                          let addonTotal = (item.addons || []).reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
                                          let itemDiscountTotal = (item.itemDiscounts || []).reduce((sum, d) => sum + d.discountAmount, 0);
                                          let itemPromotionTotal = (item.itemPromotions || []).reduce((sum, p) => sum + p.promotionAmount, 0);
                                          return (baseTotal + addonTotal - itemDiscountTotal - itemPromotionTotal).toFixed(2);
                                        })()}
                                      </span>
                                      <span className="transHis-modal-item-unit-price">
                                        ₱{item.price.toFixed(2)} each
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  } else {
                    // Regular Item Display
                    const item = group.item;
                    const idx = group.index;
                    const availableQty = item.quantity - (item.refundedQuantity || 0);
                    const isFullyRefunded = item.isFullyRefunded || availableQty <= 0;
                    const isPartiallyRefunded = item.refundedQuantity > 0 && !isFullyRefunded;
                    const regularPromotions = (item.itemPromotions || []);

                    return (
                      <div 
                        key={idx} 
                        className={`transHis-modal-item ${isFullyRefunded ? 'fully-refunded' : ''} ${isPartiallyRefunded ? 'partially-refunded' : ''}`}
                      >
                        <div className="transHis-modal-item-content">
                          <div className="transHis-modal-item-header">
                            <div className="transHis-modal-item-left">
                              <div className="transHis-modal-item-name-container">
                               <span className="transHis-modal-item-name">
                                  {item.name}
                                </span>
                                <span className="transHis-modal-quantity">x{item.quantity}</span>
                              </div>
                              
                              {item.addons && item.addons.length > 0 && (
                                <div className="transHis-modal-item-addons">
                                  {item.addons.map((addon, addonIdx) => (
                                    <div key={addonIdx} className="transHis-modal-addon-detail">
                                      + ₱{(addon.price * addon.quantity).toFixed(2)} : {addon.addonName} (x{addon.quantity})
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {item.itemDiscounts && item.itemDiscounts.length > 0 && (
                                <div className="transHis-modal-item-discount-applied">
                                  {(() => {
                                    const combinedDiscounts = {};
                                    item.itemDiscounts.forEach(discount => {
                                      if (!combinedDiscounts[discount.discountName]) {
                                        combinedDiscounts[discount.discountName] = { name: discount.discountName, totalQuantity: 0, totalAmount: 0 };
                                      }
                                      combinedDiscounts[discount.discountName].totalQuantity += discount.quantityDiscounted;
                                      combinedDiscounts[discount.discountName].totalAmount += discount.discountAmount;
                                    });
                                    
                                    return Object.values(combinedDiscounts).map((discount, discIdx) => (
                                      <div key={discIdx} className="transHis-modal-discount-info">
                                        - ₱{discount.totalAmount.toFixed(2)} : {discount.name} (x{discount.totalQuantity})
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}
                              
                              {regularPromotions.length > 0 && (
                                <div className="transHis-modal-item-discount-applied">
                                  {(() => {
                                    const combinedPromotions = {};
                                    regularPromotions.forEach(promo => {
                                      if (!combinedPromotions[promo.promotionName]) {
                                        combinedPromotions[promo.promotionName] = { name: promo.promotionName, totalQuantity: 0, totalAmount: 0 };
                                      }
                                      combinedPromotions[promo.promotionName].totalQuantity += promo.quantityPromoted;
                                      combinedPromotions[promo.promotionName].totalAmount += promo.promotionAmount;
                                    });
                                    
                                    return Object.values(combinedPromotions).map((promo, promoIdx) => (
                                      <div key={promoIdx} className="transHis-modal-discount-info">
                                        - ₱{promo.totalAmount.toFixed(2)} : {promo.name} (x{promo.totalQuantity})
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}
                              
                              {item.refundedQuantity > 0 && (
                                <div className="transHis-modal-refunded-indicator">
                                  <span className="refunded-qty-badge">{item.refundedQuantity} Refunded</span>
                                </div>
                              )}
                            </div>

                            {refundMode && !isFullyRefunded && (
                              <div className="transHis-modal-qty-price">
                                <button onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) - 1)} disabled={!selectedItems[idx] || selectedItems[idx] <= 0}>-</button>
                                <span>{selectedItems[idx] || 0}</span>
                                <button onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) + 1)} disabled={selectedItems[idx] >= availableQty}>+</button>
                              </div>
                            )}

                            <div className="transHis-modal-item-right">
                              <span className="transHis-modal-item-total-price">
                                ₱{(() => {
                                  const baseTotal = item.price * item.quantity;
                                  let addonTotal = (item.addons || []).reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
                                  let itemDiscountTotal = (item.itemDiscounts || []).reduce((sum, d) => sum + d.discountAmount, 0);
                                  let itemPromotionTotal = (item.itemPromotions || []).reduce((sum, p) => sum + p.promotionAmount, 0);
                                  return (baseTotal + addonTotal - itemDiscountTotal - itemPromotionTotal).toFixed(2);
                                })()}
                              </span>
                              <span className="transHis-modal-item-unit-price">
                                ₱{item.price.toFixed(2)} each
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                });
              })()}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="transHis-modal-price-breakdown">
            <div className="transHis-modal-breakdown-row">
              <span>Subtotal:</span>
              <span>₱{(transaction.subtotal || 0).toFixed(2)}</span>
            </div>
            
            {transaction.discount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-discount">
                <span>Discount:</span>
                <span>-₱{transaction.discount.toFixed(2)}</span>
              </div>
            )}
            
            {transaction.promotionalDiscount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-discount">
                <span>Promotion:</span>
                <span>-₱{transaction.promotionalDiscount.toFixed(2)}</span>
              </div>
            )} 

            {displayRefundAmount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-refund-row">
                <span>Refund:</span>
                <span>-₱{displayRefundAmount.toFixed(2)}</span>
              </div>
            )}   
            
            {refundMode && hasSelectedItems && (
              <div className="transHis-modal-breakdown-row transHis-modal-refund-total">
                <span>Refund Amount (After Discounts):</span>
                <span>₱{calculateRefundTotal().toFixed(2)}</span>
              </div>
            )}
            
            <div className="transHis-modal-breakdown-row transHis-modal-total">
              <span>Total:</span>
              <span>₱{finalTotal.toFixed(2)}</span>
            </div>
          </div>
        
          {/* Action Buttons */}
          {transaction.status.toLowerCase() === "completed" && isToday() && (
            <div className="transHis-modal-actions">
              {isUserAdmin ? (
                <div className="transHis-admin-message"></div>
              ) : (
                <>
                  {!refundMode ? (
                    <>
                      <button 
                        className="transHis-modal-action-btn transHis-modal-refund-btn"
                        onClick={handleRefundOrder}
                        disabled={hasRefundedItems && transaction.items.every(item => item.isFullyRefunded)}
                      >
                        Full Refund
                      </button>
                      {(() => {
                        const hasMultipleItems = transaction.items.length > 1;
                        const hasItemWithMultipleQuantity = transaction.items.some(item => {
                          const availableQty = item.quantity - (item.refundedQuantity || 0);
                          return availableQty > 1;
                        });
                        
                        const showRefundItemButton = hasMultipleItems || hasItemWithMultipleQuantity;
                        
                        return showRefundItemButton && (
                          <button 
                            className="transHis-modal-action-btn transHis-modal-partial-refund-btn"
                            onClick={toggleRefundMode}
                            disabled={transaction.items.every(item => item.isFullyRefunded)}
                          >
                            Refund Item
                          </button>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <button 
                        className="transHis-modal-action-btn transHis-modal-cancel-refund-btn"
                        onClick={toggleRefundMode}
                      >
                        Cancel
                      </button>
                      <button 
                        className={`transHis-modal-action-btn transHis-modal-refund-btn ${!hasSelectedItems ? 'disabled' : ''}`}
                        onClick={handleRefundOrder}
                        disabled={!hasSelectedItems}
                      >
                        Refund Selected Items
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransHisModal;