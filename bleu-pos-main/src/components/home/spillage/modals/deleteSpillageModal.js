import React, { useState } from "react";
import PropTypes from "prop-types";
import "./sharedSpillageModal.css";

function DeleteSpillageModal({ show, onClose, onConfirm, spillage }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!show || !spillage) return null;

  // Helper function to restock inventory based on category
  const handleInventoryRestock = async (token) => {
    const spillageItem = {
      product_name: spillage.product_name,
      category: spillage.category,
      quantity: spillage.quantity
    };

    // Normalize category - treat "All Items" as "Merchandise"
    const normalizedCategory = spillage.category.toLowerCase() === "all items" 
      ? "merchandise" 
      : spillage.category.toLowerCase();

    try {
      if (normalizedCategory === "merchandise") {
        // Call merchandise restock endpoint
        console.log("Restocking merchandise for deleted spillage");
        const merchResponse = await fetch(
          "http://localhost:8002/merchandise/restock-from-deleted-spillage",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ spillage_item: spillageItem }),
          }
        );

        if (!merchResponse.ok) {
          const errorData = await merchResponse.json();
          console.error("Merchandise restock failed:", errorData);
          throw new Error(errorData.detail || "Failed to restock merchandise inventory");
        }

        console.log("Merchandise restocked successfully");
      } else {
        // It's a product - call both ingredients and materials restock endpoints
        console.log("Restocking ingredients for deleted spillage");
        const ingredientsResponse = await fetch(
          "http://127.0.0.1:8002/ingredients/restock-from-deleted-spillage",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ spillage_item: spillageItem }),
          }
        );

        if (!ingredientsResponse.ok) {
          const errorData = await ingredientsResponse.json();
          console.error("Ingredients restock failed:", errorData);
          throw new Error(errorData.detail || "Failed to restock ingredients inventory");
        }

        console.log("Ingredients restocked successfully");

        console.log("Restocking materials for deleted spillage");
        const materialsResponse = await fetch(
          "http://localhost:8002/materials/restock-from-deleted-spillage",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ spillage_item: spillageItem }),
          }
        );

        if (!materialsResponse.ok) {
          const errorData = await materialsResponse.json();
          console.error("Materials restock failed:", errorData);
          throw new Error(errorData.detail || "Failed to restock materials inventory");
        }

        console.log("Materials restocked successfully");
      }
    } catch (error) {
      console.error("Error restocking inventory:", error);
      throw error;
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("No authentication token found");
      }

      // STEP 1: Restock inventory first (before deleting the spillage record)
      try {
        await handleInventoryRestock(token);
        console.log("Inventory restock completed successfully");
      } catch (inventoryError) {
        console.error("Inventory restock failed:", inventoryError);
        setError(`Inventory restock failed: ${inventoryError.message}. Spillage record not deleted.`);
        setIsDeleting(false);
        return; // Don't proceed with deletion if inventory restock fails
      }

      // STEP 2: Delete spillage record from database
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
        <p>Are you sure you want to delete this Spillage Log?</p>
        <p style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
          This will restock the inventory for this spillage.
        </p>
        
        {spillage && (
          <div className="spillage-details">
            <p><strong>Product:</strong> {spillage.product_name}</p>
            <p><strong>Category:</strong> {spillage.category}</p>
            <p><strong>Quantity:</strong> {spillage.quantity}</p>
            <p><strong>Date:</strong> {new Date(spillage.spillage_date).toLocaleDateString()}</p>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ color: 'red', marginTop: '10px', marginBottom: '10px' }}>
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

DeleteSpillageModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func,
  spillage: PropTypes.object,
};

export default DeleteSpillageModal;