import React, { useState } from "react";
import PropTypes from "prop-types";
import { HiOutlineExclamation } from "react-icons/hi";
import "./sharedSpillageModal.css";

function LogSpillageDeleteModal({ show, onClose, onConfirm, spillage }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!show || !spillage) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("No authentication token found");

      // Delete spillage - backend handles inventory restock in background
      const response = await fetch(`http://127.0.0.1:9003/wastelogs/${spillage.spillage_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete spillage");
      }

      console.log("Spillage deleted successfully. Inventory restock processing in background.");
      
      if (onConfirm) onConfirm(spillage.spillage_id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="logSpillage-delete-overlay" onClick={onClose}>
      <div className="logSpillage-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logSpillage-delete-close" onClick={onClose}>&times;</div>
        <div className="logSpillage-delete-icon alert-danger">
          <HiOutlineExclamation />
        </div>
        <h1>Confirm Delete</h1>
        <p>Deleting this log will return the product to inventory. Proceed?</p>

        {error && (
          <div className="logSpillage-delete-error">{error}</div>
        )}

        <div className="logSpillage-delete-button-group">
          <button onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
          <button onClick={onClose} disabled={isDeleting}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

LogSpillageDeleteModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func,
  spillage: PropTypes.object,
};

export default LogSpillageDeleteModal;