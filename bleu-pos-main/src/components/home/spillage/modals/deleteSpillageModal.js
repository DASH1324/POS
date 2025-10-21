import React, { useState } from "react";
import "./sharedSpillageModal.css";

function DeleteSpillageModal({ show, onClose, onConfirm, spillage }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!show || !spillage) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(
        `http://127.0.0.1:9003/wastelogs/${spillage.spillage_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete spillage");
      }

      const result = await response.json();
      console.log(result.message);

      // Call the parent component's onConfirm callback if provided
      if (onConfirm) {
        onConfirm(spillage.spillage_id);
      }

      onClose();
    } catch (err) {
      console.error("Error deleting spillage:", err);
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="deleteSpillage-modal-backdrop" onClick={onClose}>
      <div
        className="deleteSpillage-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Confirm Delete</h2>
        <p>Are you sure you want to delete this Spilled Log?</p>
        
        {spillage && (
          <div className="spillage-details">
            <p><strong>Product:</strong> {spillage.product_name}</p>
            <p><strong>Quantity:</strong> {spillage.quantity}</p>
            <p><strong>Date:</strong> {new Date(spillage.spillage_date).toLocaleDateString()}</p>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>
            {error}
          </div>
        )}

        <div className="deleteSpillage-button-container">
          <button
            onClick={onClose}
            className="deleteSpillage-cancel-button"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="deleteSpillage-confirm-button"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteSpillageModal;