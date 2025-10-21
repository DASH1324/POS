import "./sharedSpillageModal.css";

function SpillageDetailsModal({ show, onClose, spillage, cashiersMap, userRole, onEdit, onDelete }) {
  if (!show || !spillage) return null;

  return (
    <div className="spillage-modal-backdrop" onClick={onClose}>
      <div
        className="spillage-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-x" onClick={onClose}>
          ×
        </button>

        <h2>Spillage Details</h2>
        <p><strong>Product:</strong> {spillage.product_name}</p>
        <p><strong>Type:</strong> {spillage.category}</p>
        <p><strong>Amount:</strong> {spillage.quantity}</p>
        <p><strong>Spilled By:</strong> {cashiersMap?.[spillage.cashier_name] || spillage.cashier_name}</p>
        <p><strong>Logged By:</strong> {spillage.logged_by}</p>
        <p><strong>Date:</strong> {new Date(spillage.spillage_date).toLocaleDateString()}</p>
        <p><strong>Reason:</strong> {spillage.reason}</p>

        <div className="spillage-modal-actions">
          <button
            className="details-edit-btn"
            onClick={() => onEdit(spillage)}
          >
            Edit
          </button>
          <button
            className="btn-delete"
            onClick={() => onDelete && onDelete(spillage.spillage_id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpillageDetailsModal;