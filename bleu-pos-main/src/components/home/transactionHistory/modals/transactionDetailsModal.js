import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPercent } from '@fortawesome/free-solid-svg-icons';
import "./transactionDetailsModal.css";

const TransHisModal = ({ show, transaction, onClose }) => {
  if (!show || !transaction) return null;

  return (
    <div className="transHis-modal-overlay" onClick={onClose}>
      <div
        className="transHis-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="transHis-modal-header">
          <h3>Transaction Details</h3>
          <button className="transHis-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div className="transHis-modal-content">
          {/* Transaction Info Grid */}
          <div className="transHis-modal-info-grid">
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">Status:</span>
              <span className={`transHis-modal-status ${transaction.status.toLowerCase()}`}>
                {transaction.status}
              </span>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">Date & Time:</span>
              <span className="transHis-modal-value">
                {new Date(transaction.date).toLocaleString()}
              </span>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">Order Type:</span>
              <span className="transHis-modal-value">{transaction.orderType}</span>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">Payment Method:</span>
              <span className="transHis-modal-value">{transaction.paymentMethod}</span>
            </div>
            <div className="transHis-modal-info-item">
              <span className="transHis-modal-label">Cashier:</span>
              <span className="transHis-modal-value">{transaction.cashierName}</span>
            </div>
            {transaction.paymentMethod === "GCash" &&
              transaction.GCashReferenceNumber && (
                <div className="transHis-modal-info-item">
                  <span className="transHis-modal-label">GCash Reference #:</span>
                  <span className="transHis-modal-value">{transaction.GCashReferenceNumber}</span>
                </div>
              )}
          </div>

          {/* Discount Section */}
          {transaction.discountsAndPromotions !== "None" && (
            <div className="transHis-modal-applied-discounts">
              <h4>Applied Discounts</h4>
              <div className="transHis-modal-discount-item">
                <FontAwesomeIcon icon={faPercent} />
                <span>{transaction.discountsAndPromotions}</span>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="transHis-modal-order-items">
            <h4>Order Items</h4>
            <div className="transHis-modal-items-scrollable">
              {transaction.items.map((item, index) => (
                <div key={index} className="transHis-modal-item">
                  <div className="transHis-modal-item-header">
                    <span className="transHis-modal-item-name">{item.name}</span>
                    <span className="transHis-modal-item-price">₱{item.price}</span>
                  </div>
                  <div className="transHis-modal-item-details">
                    <span className="transHis-modal-quantity">Qty: {item.quantity}</span>
                  </div>
                  {item.details && (
                    <div className="transHis-modal-item-addons">
                      <span>{item.details}</span>
                    </div>
                  )}
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
                <span>Discount:</span>
                <span>-₱{transaction.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="transHis-modal-breakdown-row transHis-modal-total">
              <span>Total Amount:</span>
              <span>₱{transaction.total.toFixed(2)}</span>
            </div>
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
        </div>
      </div>
    </div>
  );
};

export default TransHisModal;