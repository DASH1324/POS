import React from 'react';
import './NotificationModal.css';

const NotificationModal = ({ isOpen, onClose, notifications, onMarkAllAsRead }) => {
  if (!isOpen) return null;

  // Wrapper function for debugging
  const handleClose = () => {
    console.log("Close button clicked!"); // This should appear in your browser console
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Notifications</h2>
          {/* Use the new handleClose function */}
          <button className="close-button" onClick={handleClose}>&times;</button>
        </div>
        <div className="modal-body">
          {notifications.length === 0 ? (
            <p>No notifications</p>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id} className={`notification-item ${notif.read ? 'read' : ''}`}>
                <div className="notification-icon">🔔</div>
                <div className="notification-details">
                  <p className="notification-message">{notif.message}</p>
                  <p className="notification-time">{notif.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal-footer">
          <button className="mark-as-read-button" onClick={onMarkAllAsRead}>
            Mark All as Read
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;