import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationModal.css';

// Helper to format time difference
const timeSince = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 5) return "Just now";
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  
  return Math.floor(seconds) + " seconds ago";
};

// Function to play notification sound
const playNotificationSound = () => {
  try {
    const audio = new Audio('/Notif.mp3');
    audio.volume = 0.8;
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('🔊 Notification sound played successfully');
        })
        .catch(err => {
          if (err.name === 'NotAllowedError') {
            console.log('ℹ️ Sound blocked by browser - user needs to interact with page first');
          } else {
            console.error('Error playing notification sound:', err);
          }
        });
    }
  } catch (error) {
    console.error('Error creating audio:', error);
  }
};

const NotificationModal = ({ isOpen, onClose, notifications, onMarkAllAsRead }) => {
  const navigate = useNavigate();

  // Handler for marking individual notification as read
  const handleMarkAsRead = async (notificationId, isRead) => {
    if (isRead) return;
    
    try {
      const response = await fetch(`http://localhost:9004/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Handler for clicking on a notification - navigate to order
  const handleNotificationClick = async (notification) => {
    console.log('📍 Notification clicked:', notification);
    
    // Mark as read first
    await handleMarkAsRead(notification.NotificationID, notification.IsRead);
    
    // Close the modal
    onClose();
    
    // Navigate to orders page with the order ID
    if (notification.SaleID) {
      console.log('🧭 Navigating to order:', notification.SaleID);
      navigate('/cashier/orders', { 
        state: { 
          selectedOrderId: notification.SaleID,
          openPanel: true,
          timestamp: Date.now() // Force state change detection
        } 
      });
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Notifications {unreadCount > 0 && `(${unreadCount})`}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {notifications.length === 0 ? (
            <p className="no-notifications">You're all caught up!</p>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.NotificationID} 
                className={`notification-item ${notif.IsRead ? 'read' : ''}`}
                onClick={() => handleNotificationClick(notif)}
                style={{ cursor: 'pointer' }}
              >
                <div className="notification-icon">
                  {notif.IsRead ? '🔕' : '🔔'}
                </div>
                <div className="notification-details">
                  <p className="notification-message">{notif.Message}</p>
                  <p className="notification-time">{timeSince(notif.CreatedAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal-footer">
          <button
            className="mark-as-read-button"
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark All as Read ({unreadCount})
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;