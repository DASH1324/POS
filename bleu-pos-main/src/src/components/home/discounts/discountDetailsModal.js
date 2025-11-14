import React from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import "./discountDetailsModal.css";

function DiscountDetailsModal({ 
  show, 
  onClose, 
  discount, 
  userRole, 
  onEdit, 
  onDelete 
}) {
  if (!show || !discount) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <div className="discount-modal-overlay" onClick={onClose}>
      <div
        className="discountDetails-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="discountDetails-header">
          <h2>
            Discount Details
            {userRole !== 'manager' && (
            <span className="discountDetails-header-icons">
                <FaEdit 
                className="discountDetails-icon-edit" 
                onClick={() => onEdit(discount)} 
                />
                <FaTrash 
                className="discountDetails-icon-delete" 
                onClick={() => onDelete(discount)} 
                />
            </span>
            )}
          </h2>
          <button className="discountDetails-close-button" onClick={onClose}>×</button>
        </div>

        <div className="discountDetails-grid">
          <div className="discountDetails-item">
            <span className="discountDetails-label">Discount Name</span>
            <span className="discountDetails-value">{discount.name}</span>
          </div>

          <div className="discountDetails-item">
            <span className="discountDetails-label">Discount Type</span>
            <span className="discountDetails-value">
              {discount.discount.includes('%') ? 'Percentage' : 'Fixed Amount'}
            </span>
          </div>

          <div className="discountDetails-item">
            <span className="discountDetails-label">Discount Value</span>
            <span className="discountDetails-value">{discount.discount}</span>
          </div>

          <div className="discountDetails-item">
            <span className="discountDetails-label">Minimum Spend</span>
            <span className="discountDetails-value">{formatCurrency(discount.minSpend)}</span>
          </div>

          <div className="discountDetails-item">
            <span className="discountDetails-label">Application</span>
            <span className="discountDetails-value">{discount.application}</span>
          </div>

          <div className="discountDetails-item">
            <span className="discountDetails-label">Status</span>
            <span className={`discountDetails-status-badge ${discount.status.toLowerCase()}`}>
              {discount.status.toUpperCase()}
            </span>
          </div>

          <div className="discountDetails-item">
            <span className="discountDetails-label">Valid From</span>
            <span className="discountDetails-value">{formatDate(discount.validFrom)}</span>
          </div>

          <div className="discountDetails-item">
            <span className="discountDetails-label">Valid Until</span>
            <span className="discountDetails-value">{formatDate(discount.validTo)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiscountDetailsModal;