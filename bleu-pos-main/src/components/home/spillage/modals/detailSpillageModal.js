import React, { useState, useEffect } from "react";
import "./sharedSpillageModal.css";
import { FaEdit, FaTrash } from "react-icons/fa";

function SpillageDetailsModal({ show, onClose, spillage, userRole, onEdit, onDelete }) {
  const [cashierFullName, setCashierFullName] = useState("");
  const [isLoadingCashier, setIsLoadingCashier] = useState(false);

  useEffect(() => {
    if (show && spillage?.cashier_name) {
      fetchCashierFullName(spillage.cashier_name);
    }
  }, [show, spillage]);

  const fetchCashierFullName = async (username) => {
    setIsLoadingCashier(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://localhost:4000/users/cashiers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const cashiers = await response.json();
        const cashier = cashiers.find(c => c.Username === username);
        setCashierFullName(cashier ? cashier.FullName : username);
      } else {
        setCashierFullName(username);
      }
    } catch (error) {
      console.error("Error fetching cashier name:", error);
      setCashierFullName(username);
    } finally {
      setIsLoadingCashier(false);
    }
  };

  if (!show || !spillage) return null;

  return (
    <div className="spillage-modal-overlay" onClick={onClose}>
      <div
        className="logSpillage-details-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logSpillage-details-header">
          <h2>
            Spillage Details
            <span className="logSpillage-header-icons">
              {userRole !== "admin" && (
                <>
                  {onEdit && (
                    <FaEdit
                      className="logSpillage-icon-edit"
                      onClick={() => onEdit(spillage)}
                    />
                  )}
                  {onDelete && (
                    <FaTrash
                      className="logSpillage-icon-delete"
                      onClick={() => onDelete(spillage.spillage_id)}
                    />
                  )}
                </>
              )}
            </span>
          </h2>
          <button className="logSpillage-close-button" onClick={onClose}>×</button>
        </div>

        <div className="logSpillage-details-grid">
          <div className="logSpillage-detail-item">
            <span className="logSpillage-detail-label">Product</span>
            <span className="logSpillage-detail-value">{spillage.product_name}</span>
          </div>

          <div className="logSpillage-detail-item">
            <span className="logSpillage-detail-label">Type</span>
            <span className="logSpillage-detail-value">{spillage.category}</span>
          </div>

          <div className="logSpillage-detail-item">
            <span className="logSpillage-detail-label">Amount</span>
            <span className="logSpillage-detail-value">{spillage.quantity}</span>
          </div>

          <div className="logSpillage-detail-item">
            <span className="logSpillage-detail-label">Spilled By</span>
            <span className="logSpillage-detail-value">
              {isLoadingCashier ? "Loading..." : (cashierFullName || spillage.cashier_name)}
            </span>
          </div>

          <div className="logSpillage-detail-item">
            <span className="logSpillage-detail-label">Logged By</span>
            <span className="logSpillage-detail-value">{spillage.logged_by}</span>
          </div>

          <div className="logSpillage-detail-item">
            <span className="logSpillage-detail-label">Date</span>
            <span className="logSpillage-detail-value">
              {new Date(spillage.spillage_date).toLocaleDateString()}
            </span>
          </div>

          <div className="logSpillage-detail-item logSpillage-full-width">
            <span className="logSpillage-detail-label">Reason</span>
            <span className="logSpillage-detail-value">{spillage.reason}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpillageDetailsModal;