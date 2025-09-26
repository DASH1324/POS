import "./sharedSpillageModal.css";

function SpillageDetailsModal({ show, onClose, spillage, onEdit, onDelete }) {
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
        <p><strong>Product:</strong> {spillage.productName}</p>
        <p><strong>Type:</strong> {spillage.type}</p>
        <p><strong>Amount:</strong> {spillage.amount}</p>
        <p><strong>Size:</strong> {spillage.size}</p>
        <p><strong>Spilled By:</strong> {spillage.spilledBy}</p>
        <p><strong>Logged By:</strong> {spillage.loggedBy}</p>
        <p><strong>Date:</strong> {spillage.date}</p>
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
            onClick={() => onDelete && onDelete(spillage.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpillageDetailsModal;
