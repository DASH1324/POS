import React from "react";
import "./transactionDetailsModal.css";

const TransHisModal = ({ show, transaction, onClose }) => {
  if (!show || !transaction) return null;

  return (
    <div className="transhis-modal-backdrop" onClick={onClose}>
      <div
        className="transhis-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button className="transhis-modal-close-x" onClick={onClose}>
          ×
        </button>

        <h2 className="transhis-modal-title">Transaction Details</h2>

        <div className="modal-body">
          {/* Transaction Info */}
          <div className="modal-section">
            <div className="detail-row">
              <label>Status:</label>
              <span
                className={`status-badge ${transaction.status.toLowerCase()}`}
              >
                {transaction.status}
              </span>
            </div>
            <div className="detail-row">
              <label>Date & Time:</label>
              <span>{new Date(transaction.date).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <label>Order Type:</label>
              <span>{transaction.orderType}</span>
            </div>
            <div className="detail-row">
              <label>Payment Method:</label>
              <span>{transaction.paymentMethod}</span>
            </div>
            <div className="detail-row">
              <label>Cashier:</label>
              <span>{transaction.cashierName}</span>
            </div>
            {transaction.paymentMethod === "GCash" &&
              transaction.GCashReferenceNumber && (
                <div className="detail-row">
                  <label>GCash Reference #:</label>
                  <span>{transaction.GCashReferenceNumber}</span>
                </div>
              )}
            <div className="detail-row">
              <label>Discount & Promotion:</label>
              {transaction.discountsAndPromotions !== "None" ? (
                <span className="discount-badge">
                  {transaction.discountsAndPromotions}
                </span>
              ) : (
                <span className="discount-badge none">
                  No Discount Applied
                </span>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="modal-section">
            <h5>Order Items</h5>
            <div className="items-list">
              {transaction.items.map((item, index) => (
                <div key={index} className="item-row">
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-qty">Qty: {item.quantity}</div>
                    {item.details && (
                      <div className="item-details">{item.details}</div>
                    )}
                  </div>
                  <div className="item-price">₱{item.price}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bill Summary */}
          <div className="modal-section">
            <div className="bill-summary">
              <div className="bill-row">
                <span>Subtotal:</span>
                <span>₱{transaction.subtotal.toFixed(2)}</span>
              </div>
              {transaction.discount > 0 && (
                <div className="bill-row discount-row">
                  <span>Discount & Promotion:</span>
                  <span>-₱{transaction.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="bill-row total-row">
                <span>Total Amount:</span>
                <span>₱{transaction.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Issue Details Section */}
            <div className="modal-section">
              <h5>Transaction Status Issue</h5>
              <div className="issue-box">
                {["cancelled", "refunded", "returned"].includes(
                  transaction.status.toLowerCase()
                ) ? (
                  <>
                    <label>
                      {transaction.status === "Cancelled" &&
                        "Reason for Cancellation"}
                      {transaction.status === "Refunded" &&
                        "Reason for Refund"}
                      {transaction.status === "Returned" &&
                        "Reason for Return"}
                    </label>
                    <p>{transaction.issueReason || "No details provided"}</p>
                  </>
                ) : (
                  <p>No issues. Transaction is in good standing.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransHisModal;