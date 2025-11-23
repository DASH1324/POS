import React, { useState, useMemo } from "react";
import { Clock, Receipt, CreditCard, User } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPercent } from '@fortawesome/free-solid-svg-icons';
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

  // We now trust the backend to send the correct total and refund amounts.
  const totalRefundedAmount = transaction?.refundInfo?.totalRefundAmount || 0;

  if (!show || !transaction) return null;

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

  // This function is now only for displaying an *estimated* refund total in the UI
  const calculateRefundTotal = () => {
    let total = 0;
    transaction.items.forEach((item, index) => {
      const qty = selectedItems[index] || 0;
      if (qty > 0) {
        let pricePerUnit = item.price;
        if (item.addons && item.quantity > 0) {
            item.addons.forEach(addon => {
                pricePerUnit += (addon.price * addon.quantity) / item.quantity;
            });
        }
        total += pricePerUnit * qty;
      }
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
    
    // DEBUG: Check what values we're comparing
    console.log("Transaction date:", transaction.date);
    console.log("Transaction Date object:", transactionDate);
    console.log("Today Date object:", today);
    console.log("Is today?", 
      transactionDate.getDate() === today.getDate() &&
      transactionDate.getMonth() === today.getMonth() &&
      transactionDate.getFullYear() === today.getFullYear()
    );
    
    return transactionDate.getDate() === today.getDate() &&
           transactionDate.getMonth() === today.getMonth() &&
           transactionDate.getFullYear() === today.getFullYear();
  };

  return (
    <div className="transHis-modal-overlay" onClick={onClose}>
      <div className="transHis-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="transHis-modal-header">
          <h3>Transaction Details</h3>
          <div className="transHis-modal-header-right">
            <span className={`transHis-modal-status ${transaction.status.toLowerCase()}`}>
              {transaction.status}
            </span>
            {hasRefundedItems && transaction.status.toLowerCase() !== 'refunded' && (
              <span className="transHis-modal-status partially-refunded">
                Partially Refunded
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
                <Clock size={16} className="transHis-modal-icon" />
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
                <Receipt size={16} className="transHis-modal-icon" />
                ORDER TYPE
              </span>
              <div className="transHis-modal-value">
                <div>{transaction.orderType}</div>
              </div>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">
                <CreditCard size={16} className="transHis-modal-icon" />
                PAYMENT
              </span>
              <div className="transHis-modal-value">
                <div>{transaction.paymentMethod}</div>
              </div>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">
                <User size={16} className="transHis-modal-icon" />
                CASHIER
              </span>
              <div className="transHis-modal-value">
                <div>{cashiersMap[transaction.cashierName] || transaction.cashierName || "—"}</div>
              </div>
            </div>
          </div>

          {/* GCash Reference */}
          {transaction.paymentMethod && transaction.paymentMethod.toLowerCase() === "gcash" && transaction.GCashReferenceNumber && (
            <div className="transHis-modal-reference">
              <span className="transHis-modal-label">GCash Reference #:</span>
              <span className="transHis-modal-value">{transaction.GCashReferenceNumber}</span>
            </div>
          )}

          {/* Discount & Promotion Section */}
          {(transaction.discount > 0 || transaction.promotionalDiscount > 0) && (
            <div className="transHis-modal-applied-discounts">
              <h4>Applied Discounts & Promotions</h4>
              {transaction.discount > 0 && (
                <div className="transHis-modal-discount-item">
                  <FontAwesomeIcon icon={faPercent} />
                  <span>
                    Discount: {transaction.discountName || "Unnamed Discount"} (-₱{transaction.discount.toFixed(2)})
                  </span>
                </div>
              )}
              {transaction.promotionalDiscount > 0 && (
                <div className="transHis-modal-discount-item" style={{ marginTop: '8px' }}>
                  <FontAwesomeIcon icon={faPercent} />
                  <span>
                    Promotion: {
                      Array.isArray(transaction.promotionNames) 
                        ? transaction.promotionNames.join(", ") 
                        : transaction.promotionNames
                    } (-₱{transaction.promotionalDiscount.toFixed(2)})
                  </span>
                </div>
              )}
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
              {transaction.items.map((item, index) => {
                const availableQty = item.quantity - (item.refundedQuantity || 0);
                const isFullyRefunded = item.isFullyRefunded || availableQty <= 0;
                
                return (
                  <div 
                    key={index} 
                    className={`transHis-modal-item ${isFullyRefunded ? 'fully-refunded' : ''}`}
                  >
                    <div className="transHis-modal-item-content">
                      <div className="transHis-modal-item-header">
                        <div className="transHis-modal-item-left">
                          <div className="transHis-modal-item-name-container">
                            <span className="transHis-modal-item-name">{item.name}</span>
                          </div>
                          <span className="transHis-modal-quantity">
                            Qty: {item.quantity}
                          </span>
                          
                          {item.addons && item.addons.length > 0 && (
                            <div className="transHis-modal-item-addons">
                              {item.addons.map((addon, addonIdx) => (
                                <div key={addonIdx} className="transHis-modal-addon-detail">
                                  + {addon.addonName} (x{addon.quantity}) - ₱{(addon.price * addon.quantity).toFixed(2)}
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
                                    {discount.totalQuantity} {item.name} • {discount.name}: -₱{discount.totalAmount.toFixed(2)}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                          
                          {item.itemPromotions && item.itemPromotions.length > 0 && (
                            <div className="transHis-modal-item-promotion-applied">
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
                                  <div key={promoIdx} className="transHis-modal-promotion-info">
                                    {promo.totalQuantity} {item.name} • {promo.name}: -₱{promo.totalAmount.toFixed(2)}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                          
                          {item.refundedQuantity > 0 && (
                            <div className="transHis-modal-refunded-indicator">
                              <span className="refunded-qty-badge">Refunded: {item.refundedQuantity}</span>
                            </div>
                          )}
                        </div>

                        {refundMode && !isFullyRefunded && (
                          <div className="transHis-modal-qty-price">
                            <button onClick={() => updateItemQuantity(index, (selectedItems[index] || 0) - 1)} disabled={!selectedItems[index] || selectedItems[index] <= 0}>-</button>
                            <span>{selectedItems[index] || 0}</span>
                            <button onClick={() => updateItemQuantity(index, (selectedItems[index] || 0) + 1)} disabled={selectedItems[index] >= availableQty}>+</button>
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

          {/* Price Breakdown */}
          <div className="transHis-modal-price-breakdown">
            <div className="transHis-modal-breakdown-row">
              <span>Subtotal:</span>
              <span>₱{(transaction.subtotal || 0).toFixed(2)}</span>
            </div>
            
            {totalRefundedAmount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-refund-row">
                <span>Refund:</span>
                <span>-₱{totalRefundedAmount.toFixed(2)}</span>
              </div>
            )}
            
            {transaction.discount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-discount">
                <span>Discount{transaction.discountName ? ` (${transaction.discountName})` : ''}:</span>
                <span>-₱{transaction.discount.toFixed(2)}</span>
              </div>
            )}
            
            {transaction.promotionalDiscount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-discount">
                <span>Promotion ({
                  Array.isArray(transaction.promotionNames) 
                    ? transaction.promotionNames.join(", ") 
                    : transaction.promotionNames
                }):</span>
                <span>-₱{transaction.promotionalDiscount.toFixed(2)}</span>
              </div>
            )}    
            
            <div className="transHis-modal-breakdown-row transHis-modal-total">
              <span>Total:</span>
              <span>₱{(transaction.total || 0).toFixed(2)}</span>
            </div>
            
            {refundMode && hasSelectedItems && (
              <div className="transHis-modal-breakdown-row transHis-modal-refund-total">
                <span>Est. Refund Amount:</span>
                <span>₱{calculateRefundTotal().toFixed(2)}</span>
              </div>
            )}
          </div>

          {isRefunded && transaction.refundInfo && (
            <div className="transHis-modal-refund-info">
              {/* Refund info display */}
            </div>
          )}
        
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
                        // Check if there's any item with quantity > 1 that's not fully refunded
                        const hasPartialRefundableItems = transaction.items.some(item => {
                          const availableQty = item.quantity - (item.refundedQuantity || 0);
                          return availableQty > 1;
                        });
                        
                        return hasPartialRefundableItems && (
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