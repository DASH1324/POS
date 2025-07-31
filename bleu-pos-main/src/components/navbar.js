import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './navbar.css';
import logo from '../assets/logo.png';
import { HiOutlineShoppingBag, HiOutlineClipboardList, HiOutlineChartBar, HiOutlineTrash } from 'react-icons/hi';
import { FaBell, FaChevronDown } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css'; // default styles
import './confirmAlertCustom.css';

const Navbar = ({ isCartOpen, isOrderPanelOpen }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("Cashier");
  const navigate = useNavigate();
  const location = useLocation();

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    navigate('/');
  }, [navigate]);

  const confirmLogout = () => {
    confirmAlert({
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          label: 'Yes',
          onClick: () => handleLogout()
        },
        {
          label: 'No',
          onClick: () => {}
        }
      ]
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
      setUserName(storedUsername);
      try {
        const decodedToken = jwtDecode(storedToken);
        setUserRole(decodedToken.role || "Cashier");
      } catch (error) {
        console.error("Error decoding token:", error);
        handleLogout();
      }
    } else {
      console.log("No session found. Redirecting to login.");
      navigate('/');
    }
  }, [navigate, handleLogout]);

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
          <Link to="/cashier/cashierSpillage" className={`nav-item ${location.pathname === '/cashier/cashierSpillage' ? 'active' : ''}`}>
            <HiOutlineTrash className="icon" /> Spillage
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
            <div className="nav-bell-icon"><FaBell className="bell-outline" /></div>

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