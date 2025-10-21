import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './navbar.css';
import logo from '../assets/logo.png';
import { HiOutlineShoppingBag, HiOutlineClipboardList, HiOutlineChartBar, HiOutlineExclamation } from 'react-icons/hi';
import { FaBell, FaChevronDown } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import './confirmAlertCustom.css';
import NotificationModal from "./NotificationModal"; // Import the modal component

const Navbar = ({ isCartOpen, isOrderPanelOpen }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isNotificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, message: 'New order #1234 has been placed.', time: '10 minutes ago', read: false },
    { id: 2, message: 'Item "Burger" is running low in stock.', time: '1 hour ago', read: false },
    { id: 3, message: 'Daily sales report is ready.', time: '3 hours ago', read: true },
  ]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("Cashier");
  const navigate = useNavigate();
  const location = useLocation();

  const toggleDropdown = useCallback(() => setDropdownOpen(!isDropdownOpen), []);
  const toggleNotificationModal = useCallback(() => setNotificationModalOpen(prev => !prev), []);

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications(notifications.map(notif => ({ ...notif, read: true })));
  }, [notifications]);

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');

    navigate('/');
  }, [navigate]);

  const confirmLogout = () => {
    confirmAlert({
      customUI: ({ onClose }) => (
        <>
          <div className="react-confirm-alert-close" onClick={onClose}>&times;</div>
          <div className="react-confirm-alert-icon alert-danger">
            <HiOutlineExclamation />
          </div>
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

  const fetchEmployeeName = useCallback(async (username, token) => {
    try {
      const response = await fetch(`http://127.0.0.1:4000/users/employee_name?username=${username}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Unauthorized. Logging out...");
          handleLogout();
          return;
        }
        throw new Error(`Error fetching employee name: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.employee_name) {
        setUserName(data.employee_name);
      } else {
        console.warn("Employee name not found in response.");
      }

    } catch (error) {
      console.error("Error fetching employee name:", error);
    }
  }, [handleLogout]);

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
        fetchEmployeeName(storedUsername, storedToken);
      } catch (error) {
        console.error("Error decoding token:", error);
        handleLogout();
      }
    } else {
      console.log("No session found. Redirecting to login.");
      navigate('/');
    }
  }, [navigate, handleLogout, fetchEmployeeName]);

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
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
              second: "numeric",
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