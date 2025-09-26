import React from "react";
import "./sharedSpillageModal.css";

function DeleteSpillageModal({ show, onClose, onConfirm, spillage }) {
  if (!show || !spillage) return null;

  return (
    <div className="deleteSpillage-modal-backdrop" onClick={onClose}>
      <div
        className="deleteSpillage-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Confirm Delete</h2>
        <p>Are you sure you want to delete this Spilled Log?</p>
        <div className="deleteSpillage-button-container">
          <button
            onClick={onClose}
            className="deleteSpillage-cancel-button"
          >
        Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(spillage.id);
              onClose();
            }}className="deleteSpillage-confirm-button"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteSpillageModal;
