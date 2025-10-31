import React from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import "./promotionDetailsModal.css";

function PromotionDetailsModal({ 
  show, 
  onClose, 
  promotion, 
  userRole, 
  onEdit, 
  onDelete 
}) {
  if (!show || !promotion) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="promotion-modal-overlay" onClick={onClose}>
      <div
        className="promotionDetails-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="promotionDetails-header">
          <h2>
            Promotion Details
            {userRole !== 'manager' && (
            <span className="promotionDetails-header-icons">
                <FaEdit 
                className="promotionDetails-icon-edit" 
                onClick={() => onEdit(promotion)} 
                />
                <FaTrash 
                className="promotionDetails-icon-delete" 
                onClick={() => onDelete(promotion)} 
                />
            </span>
            )}
          </h2>
          <button className="promotionDetails-close-button" onClick={onClose}>×</button>
        </div>

        <div className="promotionDetails-grid">
          <div className="promotionDetails-item">
            <span className="promotionDetails-label">Promotion Name</span>
            <span className="promotionDetails-value">{promotion.name}</span>
          </div>

          <div className="promotionDetails-item">
            <span className="promotionDetails-label">Type</span>
            <span className="promotionDetails-value">{promotion.type}</span>
          </div>

          <div className="promotionDetails-item">
            <span className="promotionDetails-label">Value</span>
            <span className="promotionDetails-value">{promotion.value}</span>
          </div>

          <div className="promotionDetails-item">
            <span className="promotionDetails-label">Status</span>
            <span className={`promotionDetails-status-badge ${promotion.status.toLowerCase()}`}>
              {promotion.status.toUpperCase()}
            </span>
          </div>

          <div className="promotionDetails-item promotionDetails-full-width">
            <span className="promotionDetails-label">Products</span>
            <span className="promotionDetails-value">{promotion.products}</span>
          </div>

          <div className="promotionDetails-item">
            <span className="promotionDetails-label">Valid From</span>
            <span className="promotionDetails-value">{formatDate(promotion.validFrom)}</span>
          </div>

          <div className="promotionDetails-item">
            <span className="promotionDetails-label">Valid Until</span>
            <span className="promotionDetails-value">{formatDate(promotion.validTo)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromotionDetailsModal;