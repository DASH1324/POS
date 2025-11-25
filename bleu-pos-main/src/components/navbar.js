import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, Link } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';
import './navbar.css';
import logo from '../assets/logo.png';
import { HiOutlineShoppingBag, HiOutlineClipboardList, HiOutlineChartBar, HiOutlineExclamation } from 'react-icons/hi';
import { FaBell, FaChevronDown } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import './confirmAlertCustom.css';

const NOTIFICATION_API_URL = 'http://localhost:9004/notifications';
const NOTIFICATION_WS_URL = 'ws://localhost:9004/ws/notifications';

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

const Navbar = ({ isCartOpen, isOrderPanelOpen }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isNotificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("Cashier");
  const navigate = useNavigate();
  const location = useLocation();
  const userInteractedRef = useRef(false);
  const notificationRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Track user interaction for sound
  useEffect(() => {
    const handleInteraction = () => {
      userInteractedRef.current = true;
      document.removeEventListener('click', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { lastJsonMessage } = useWebSocket(NOTIFICATION_WS_URL, {
    onOpen: () => console.log('Notification WebSocket Connected'),
    onError: (err) => console.error('WebSocket Error:', err),
    shouldReconnect: (closeEvent) => true,
  });

  useEffect(() => {
    if (!lastJsonMessage || !lastJsonMessage.type) return;
    const { type, payload } = lastJsonMessage;
    
    switch (type) {
      case 'new_notification':
        console.log('🔔 NEW notification received via WebSocket');
        setNotifications(prev => [payload, ...prev]);
        
        if (userInteractedRef.current) {
          playNotificationSound();
        } else {
          console.log('⚠️ Cannot play sound - user needs to interact with page first');
        }
        break;
        
      case 'notification_read':
        setNotifications(prev =>
          prev.map(n =>
            n.NotificationID === payload.NotificationID
              ? { ...n, IsRead: true }
              : n
          )
        );
        break;
        
      case 'notification_done':
        setNotifications(prev => prev.filter(n => n.NotificationID !== payload.NotificationID));
        break;
        
      case 'notifications_read_all':
        setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
        break;
        
      default:
        console.warn(`Received unknown WebSocket message type: ${type}`);
        break;
    }
  }, [lastJsonMessage]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(NOTIFICATION_API_URL);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const toggleDropdown = useCallback(() => {
    setDropdownOpen(prev => !prev);
    setNotificationDropdownOpen(false);
  }, []);
  
  const toggleNotificationDropdown = useCallback(() => {
    setNotificationDropdownOpen(prev => !prev);
    setDropdownOpen(false);
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await fetch(`${NOTIFICATION_API_URL}/read-all`, { method: 'PATCH' });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, []);

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

  const unreadNotificationsCount = notifications.filter(n => !n.IsRead).length;

  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    navigate('/', { replace: true });
  }, [navigate]);

  const confirmLogout = () => {
    confirmAlert({
      customUI: ({ onClose }) => (
        <>
          <div className="react-confirm-alert-close" onClick={onClose}>&times;</div>
          <div className="react-confirm-alert-icon alert-danger"><HiOutlineExclamation /></div>
          <h1>Confirm Logout</h1>
          <p>Are you sure you want to log out?</p>
          <div className="react-confirm-alert-button-group">
            <button onClick={() => { handleLogout(); onClose(); }}>Yes</button>
            <button onClick={onClose}>No</button>
          </div>
        </>
      )
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const usernameFromUrl = params.get('username');
    const tokenFromUrl = params.get('authorization');

    if (usernameFromUrl && tokenFromUrl) {
      localStorage.setItem('username', usernameFromUrl);
      localStorage.setItem('authToken', tokenFromUrl);

      if (window.history.replaceState) {
        const cleanUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      }
    }

    const storedUsername = localStorage.getItem('username');
    const storedToken = localStorage.getItem('authToken');

    if (storedUsername && storedToken) {
      try {
        const decodedToken = jwtDecode(storedToken);
        setUserRole(decodedToken.role || "Cashier");
        
        const fetchName = async () => {
          try {
            const response = await fetch(`http://127.0.0.1:4000/users/employee_name?username=${storedUsername}`, {
              headers: { "Authorization": `Bearer ${storedToken}` }
            });
            if (!response.ok) {
              if (response.status === 401) {
                handleLogout();
                return;
              }
              throw new Error(`Error fetching employee name: ${response.statusText}`);
            }
            const data = await response.json();
            setUserName(data.employee_name || "User");
          } catch (error) {
            console.error("Error fetching employee name:", error);
          }
        };
        
        fetchName();
      } catch (error) {
        console.error("Error decoding token:", error);
        handleLogout();
      }
    }
  }, [handleLogout, navigate]);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const getNavbarClass = () => {
    if (isCartOpen) return 'navbar with-cart';
    if (isOrderPanelOpen) return 'navbar with-order-panel';
    return 'navbar';
  };

  return (
    <header className={getNavbarClass()}>
      <div className="navbar-left">
        <div className="navbar-logo">
          <img src={logo} alt="Logo" className="logo-nav" />
        </div>
        <div className="nav-icons">
          <Link to="/cashier/menu" className={`nav-item ${location.pathname === '/cashier/menu' ? 'active' : ''}`}>
            <HiOutlineShoppingBag className="icon" /> Menu
          </Link>
          <Link to="/cashier/orders" className={`nav-item ${location.pathname === '/cashier/orders' ? 'active' : ''}`}>
            <HiOutlineClipboardList className="icon" /> Orders
          </Link>
          <Link to="/cashier/cashierSales" className={`nav-item ${location.pathname === '/cashier/cashierSales' ? 'active' : ''}`}>
            <HiOutlineChartBar className="icon" /> Sales
          </Link>
        </div>
      </div>
      <div className="navbar-right">
        <div className="navbar-date">
          {currentDate.toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "numeric", hour12: true
          })}
        </div>
        <div className="navbar-profile" ref={profileDropdownRef}>
          <div className="nav-profile-info">
            <div className="nav-profile-role">Hi! I'm {userRole}</div>
            <div className="nav-profile-name">{userName}</div>
          </div>
          <div className="nav-dropdown-icon" onClick={toggleDropdown}><FaChevronDown /></div>
          <div className="nav-bell-icon" onClick={toggleNotificationDropdown} ref={notificationRef}>
            <FaBell/>
            {unreadNotificationsCount > 0 && (
              <span className="notification-badge">{unreadNotificationsCount}</span>
            )}
            
            {/* Notification Dropdown */}
            {isNotificationDropdownOpen && (
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">
                  <h3>Notifications {unreadNotificationsCount > 0 && `(${unreadNotificationsCount})`}</h3>
                </div>
                <div className="notification-dropdown-body">
                  {notifications.length === 0 ? (
                    <p className="no-notifications">You're all caught up!</p>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.NotificationID} 
                        className={`notification-item ${notif.IsRead ? 'read' : ''}`}
                        onClick={() => handleMarkAsRead(notif.NotificationID, notif.IsRead)}
                        style={{ cursor: notif.IsRead ? 'default' : 'pointer' }}
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
                <div className="notification-dropdown-footer">
                  <button
                    className="mark-as-read-button"
                    onClick={handleMarkAllAsRead}
                    disabled={unreadNotificationsCount === 0}
                  >
                    Mark All as Read ({unreadNotificationsCount})
                  </button>
                </div>
              </div>
            )}
          </div>
          {isDropdownOpen && (
            <div className="nav-profile-dropdown">
              <ul>
                <li onClick={confirmLogout}>Logout</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;