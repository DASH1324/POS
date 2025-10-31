import React, { useState } from "react";
import { Clock, Receipt, CreditCard, User } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPercent } from '@fortawesome/free-solid-svg-icons';
import "./transactionDetailsModal.css";

const TransHisModal = ({ show, transaction, onClose, onCancelOrder, onRefundOrder }) => {
  const [refundMode, setRefundMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});

  if (!show || !transaction) return null;

  console.log("Transaction Discounts:", transaction.discountsAndPromotions);

  const handleCancelOrder = () => {
    if (onCancelOrder) {
      onCancelOrder(transaction);
    }
  };

  const handleRefundOrder = () => {
    if (refundMode) {
      // Partial refund - pass selected items
      const itemsToRefund = transaction.items
        .map((item, index) => ({
          ...item,
          refundQuantity: selectedItems[index] || 0
        }))
        .filter(item => item.refundQuantity > 0);

      if (itemsToRefund.length === 0) {
        alert("Please select at least one item to refund");
        return;
      }

      if (onRefundOrder) {
        onRefundOrder(transaction, itemsToRefund);
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
    const maxQty = transaction.items[index].quantity;
    const validQty = Math.max(0, Math.min(quantity, maxQty));
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
    });
    return total;
  };

  const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);

  return (
    <div className="transHis-modal-overlay" onClick={onClose}>
      <div
        className="transHis-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="transHis-modal-header">
          <h3>Transaction Details</h3>
          <div className="transHis-modal-header-right">
            <span className={`transHis-modal-status ${transaction.status.toLowerCase()}`}>
              {transaction.status}
            </span>
            <button className="transHis-modal-close" onClick={onClose}>
              ×
            </button>
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
                {transaction.orderType !== "Dine in" && transaction.orderType !== "Take out" && (
                  <div className="transHis-modal-subtext">Table service</div>
                )}
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
                <div>{transaction.cashierName}</div>
              </div>
            </div>
          </div>

          {/* GCash Reference Section */}
          {transaction.paymentMethod === "GCash" &&
            transaction.GCashReferenceNumber && (
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
                <span>
                  {transaction.discountName || transaction.discountsAndPromotions}
                </span>
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
              {transaction.items.map((item, index) => (
                <div key={index} className="transHis-modal-item">
                  <div className="transHis-modal-item-content">
                    <div className="transHis-modal-item-header">
                      <div className="transHis-modal-item-left">
                        <span className="transHis-modal-item-name">{item.name}</span>
                        <span className="transHis-modal-quantity">Qty: {item.quantity}</span>
                        {item.details && (
                          <span className="transHis-modal-item-addons">{item.details}</span>
                        )}
                      </div>

                      {/* Refund qty + price in the middle */}
                      {refundMode && (
                        <div className="transHis-modal-qty-price">
                          <button onClick={() => updateItemQuantity(index, (selectedItems[index] || 0) - 1)}>-</button>
                          <span>{selectedItems[index] || 0}</span>
                          <button onClick={() => updateItemQuantity(index, (selectedItems[index] || 0) + 1)}>+</button>
                          <span className="transHis-modal-item-price">
                            ₱{((item.price || 0) * (selectedItems[index] || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="transHis-modal-item-right">
                        <span className="transHis-modal-item-unit-price">₱{item.price.toFixed(2)} each</span>
                        <span className="transHis-modal-item-total-price">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                                    
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="transHis-modal-price-breakdown">
            <div className="transHis-modal-breakdown-row">
              <span>Subtotal:</span>
              <span>₱{transaction.subtotal.toFixed(2)}</span>
            </div>
            {transaction.discount > 0 && (
              <div className="transHis-modal-breakdown-row transHis-modal-discount">
                <span>
                  Discount {transaction.discountName && `(${transaction.discountName})`}:
                </span>
                <span>-₱{transaction.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="transHis-modal-breakdown-row transHis-modal-total">
              <span>Total Amount:</span>
              <span>₱{transaction.total.toFixed(2)}</span>
            </div>
            
            {refundMode && hasSelectedItems && (
              <div className="transHis-modal-breakdown-row transHis-modal-refund-total">
                <span>Refund Amount:</span>
                <span>₱{calculateRefundTotal().toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Issue Details */}
          {["cancelled", "refunded", "returned"].includes(
            transaction.status.toLowerCase()
          ) && (
            <div className="transHis-modal-issue-section">
              <h4>Transaction Status Issue</h4>
              <div className="transHis-modal-issue-box">
                <span className="transHis-modal-issue-label">
                  {transaction.status === "Cancelled" && "Reason for Cancellation"}
                  {transaction.status === "Refunded" && "Reason for Refund"}
                  {transaction.status === "Returned" && "Reason for Return"}
                </span>
                <p>{transaction.issueReason || "No details provided"}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {transaction.status.toLowerCase() === "processing" && (
            <div className="transHis-modal-actions">
              <button 
                className="transHis-modal-action-btn transHis-modal-cancel-btn"
                onClick={handleCancelOrder}
              >
                Cancel Order
              </button>
            </div>
          )}

          {transaction.status.toLowerCase() === "completed" && (
            <div className="transHis-modal-actions">
              {!refundMode ? (
                <>
                  <button 
                    className="transHis-modal-action-btn transHis-modal-refund-btn"
                    onClick={handleRefundOrder}
                  >
                    Full Refund
                  </button>
                  <button 
                    className="transHis-modal-action-btn transHis-modal-partial-refund-btn"
                    onClick={toggleRefundMode}
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
                    Refund Item
                  </button>
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