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
import NotificationModal from "./NotificationModal";

const NOTIFICATION_API_URL = 'http://localhost:9004/notifications';
const NOTIFICATION_WS_URL = 'ws://localhost:9004/ws/notifications';

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
  const [isNotificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("Cashier");
  const navigate = useNavigate();
  const location = useLocation();
  const userInteractedRef = useRef(false);

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
        
        // Play sound only for new notifications from WebSocket
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

  const toggleDropdown = useCallback(() => setDropdownOpen(prev => !prev), []);
  const toggleNotificationModal = useCallback(() => setNotificationModalOpen(prev => !prev), []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await fetch(`${NOTIFICATION_API_URL}/read-all`, { method: 'PATCH' });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, []);

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

  // Handle URL parameters and initial authentication
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
    <>
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
              weekday: "long", year: "numeric", month: "long", day: "numeric",
              hour: "numeric", minute: "numeric", second: "numeric",
            })}
          </div>
          <div className="navbar-profile">
            <div className="nav-profile-info">
              <div className="nav-profile-role">Hi! I'm {userRole}</div>
              <div className="nav-profile-name">{userName}</div>
            </div>
            <div className="nav-dropdown-icon" onClick={toggleDropdown}><FaChevronDown /></div>
            <div className="nav-bell-icon" onClick={toggleNotificationModal}>
              <FaBell className="bell-outline" />
              {unreadNotificationsCount > 0 && (
                <span className="notification-badge">{unreadNotificationsCount}</span>
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
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={toggleNotificationModal}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
    </>
  );
};

export default Navbar;