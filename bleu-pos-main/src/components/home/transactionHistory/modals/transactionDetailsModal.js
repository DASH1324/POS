import React, { useState } from "react";
import { Clock, Receipt, CreditCard, User } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPercent } from '@fortawesome/free-solid-svg-icons';
import "./transactionDetailsModal.css";

// NEW HELPER: Get user role from local storage
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
  
  // Check the role on component render
  const isUserAdmin = getIsUserAdmin(); 

  if (!show || !transaction) return null;

  const handleRefundOrder = () => {
    if (refundMode) {
      // Partial refund
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
      // Full refund
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

  const calculateRefundTotal = () => {
    let total = 0;
    transaction.items.forEach((item, index) => {
      const qty = selectedItems[index] || 0;
      total += item.price * qty;
      
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(addon => {
          const addonCostPerUnit = (addon.price * addon.quantity) / item.quantity;
          total += addonCostPerUnit * qty;
        });
      }
    });
    return total;
  };

  const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);
  
  // Check if any items have been refunded
  const hasRefundedItems = transaction.items?.some(item => 
    item.refundedQuantity && item.refundedQuantity > 0
  );

  // Calculate actual totals
  const calculateActualTotals = () => {
    let actualSubtotal = 0;
    let totalRefunded = 0;

    transaction.items.forEach(item => {
      const effectiveQty = item.quantity - (item.refundedQuantity || 0);
      actualSubtotal += item.price * effectiveQty;
      totalRefunded += (item.refundAmount || 0);

      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(addon => {
          const addonTotal = addon.price * addon.quantity;
          const refundRatio = (item.refundedQuantity || 0) / item.quantity;
          const refundedAddonAmount = addonTotal * refundRatio;
          actualSubtotal += addonTotal - refundedAddonAmount;
          totalRefunded += refundedAddonAmount;
        });
      }
    });

    return { actualSubtotal, totalRefunded };
  };

  const { actualSubtotal, totalRefunded } = calculateActualTotals();
  const actualTotal = actualSubtotal - transaction.discount;
  const isRefunded = transaction.status.toLowerCase() === 'refunded' || totalRefunded > 0;

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
          {transaction.paymentMethod === "GCash" && transaction.GCashReferenceNumber && (
            <div className="transHis-modal-reference">
              <span className="transHis-modal-label">GCash Reference #:</span>
              <span className="transHis-modal-value">{transaction.GCashReferenceNumber}</span>
            </div>
          )}

          {/* Discount Section */}
          {transaction.discountsAndPromotions && transaction.discountsAndPromotions !== "None" && (
            <div className="transHis-modal-applied-discounts">
              <h4>Applied Discounts & Promotions</h4>
              <div className="transHis-modal-discount-item">
                <FontAwesomeIcon icon={faPercent} />
                <span>{transaction.discountName || transaction.discountsAndPromotions}</span>
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
                          {item.refundedQuantity > 0 && (
                            <div className="transHis-modal-refunded-indicator">
                              <span className="refunded-qty-badge">Refunded: {item.refundedQuantity}</span>
                            </div>
                          )}
                        </div>

                        {/* Refund quantity controls */}
                        {refundMode && !isFullyRefunded && (
                          <div className="transHis-modal-qty-price">
                            <button 
                              onClick={() => updateItemQuantity(index, (selectedItems[index] || 0) - 1)}
                              disabled={!selectedItems[index] || selectedItems[index] <= 0}
                            >
                              -
                            </button>
                            <span>{selectedItems[index] || 0}</span>
                            <button 
                              onClick={() => updateItemQuantity(index, (selectedItems[index] || 0) + 1)}
                              disabled={selectedItems[index] >= availableQty}
                            >
                              +
                            </button>
                            <span className="transHis-modal-item-price">
                              ₱{(() => {
                                const basePrice = (item.price || 0) * (selectedItems[index] || 0);
                                let addonPrice = 0;
                                if (item.addons && item.addons.length > 0) {
                                  item.addons.forEach(addon => {
                                    const addonCostPerUnit = (addon.price * addon.quantity) / item.quantity;
                                    addonPrice += addonCostPerUnit * (selectedItems[index] || 0);
                                  });
                                }
                                return (basePrice + addonPrice).toFixed(2);
                              })()}
                            </span>
                          </div>
                        )}

                        <div className="transHis-modal-item-right">
                          <span className="transHis-modal-item-unit-price">
                            ₱{item.price.toFixed(2)} each
                          </span>
                          <span className="transHis-modal-item-total-price">
                            ₱{(() => {
                              const baseTotal = item.price * item.quantity;
                              let addonTotal = 0;
                              if (item.addons && item.addons.length > 0) {
                                item.addons.forEach(addon => {
                                  addonTotal += addon.price * addon.quantity;
                                });
                              }
                              return (baseTotal + addonTotal).toFixed(2);
                            })()}
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
            {/* Original Subtotal */}
            <div className="transHis-modal-breakdown-row">
              <span>Subtotal:</span>
              <span>₱{transaction.subtotal.toFixed(2)}</span>
            </div>
            
            {/* Show refund amount if there are any refunds */}
            {totalRefunded > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-refund-row">
                <span>Refund:</span>
                <span>-₱{totalRefunded.toFixed(2)}</span>
              </div>
            )}
            
            {/* Show discount if exists */}
            {transaction.discount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-discount">
                <span>Discount:</span>
                <span>-₱{transaction.discount.toFixed(2)}</span>
              </div>
            )}
            
            {/* Total Amount */}
            <div className="transHis-modal-breakdown-row transHis-modal-total">
              <span>Total:</span>
              <span>₱{actualTotal.toFixed(2)}</span>
            </div>
            
            {/* Show refund total when in refund mode */}
            {refundMode && hasSelectedItems && (
              <div className="transHis-modal-breakdown-row transHis-modal-refund-total">
                <span>Refund Amount:</span>
                <span>₱{calculateRefundTotal().toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Refund Info Display */}
          {isRefunded && transaction.refundInfo && (
            <div className="transHis-modal-refund-info">
              <h4>Refund Information</h4>
              <div className="transHis-modal-refund-details">
                <div className="refund-detail-row">
                  <span>Refund Type:</span>
                  <span className="refund-type-badge">
                    {transaction.refundInfo.refundType || 'partial'}
                  </span>
                </div>
                {transaction.refundInfo.refundReason && (
                  <div className="refund-detail-row">
                    <span>Reason:</span>
                    <span>{transaction.refundInfo.refundReason}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {transaction.status.toLowerCase() === "completed" && (
            <div className="transHis-modal-actions">
              
              {/* Conditional rendering based on role */}
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
                      <button 
                        className="transHis-modal-action-btn transHis-modal-partial-refund-btn"
                        onClick={toggleRefundMode}
                        disabled={transaction.items.every(item => item.isFullyRefunded)}
                      >
                        Refund Per Item
                      </button>
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