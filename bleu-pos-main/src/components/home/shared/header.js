import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { FaChevronDown, FaBell } from "react-icons/fa";
import { HiOutlineExclamation } from 'react-icons/hi';
import { jwtDecode } from 'jwt-decode';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import "./header.css";
import '../../confirmAlertCustom.css'; 

const Header = ({ pageTitle }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState("Loading...");
  const [userRole, setUserRole] = useState("Admin");
  const navigate = useNavigate();

  const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);

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

  // ✅ Fetch full employee name from backend
  const fetchEmployeeName = useCallback(async (username, token) => {
    try {
      const response = await fetch(`http://127.0.0.1:4000/users/employee_name?username=${username}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
        setUserName(data.employee_name); // ✅ match backend key
      } else {
        console.warn("Employee name not found in response.");
        setUserName(username); // fallback to username
      }
    } catch (error) {
      console.error("Error fetching employee name:", error);
      setUserName(username); // fallback if failed
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
        setUserRole(decodedToken.role || "Admin");
      } catch (error) {
        console.error("Error decoding token:", error);
        handleLogout();
      }

      // ✅ Fetch full name instead of plain username
      fetchEmployeeName(storedUsername, storedToken);
    } else {
      console.log("No session found. Redirecting to login.");
      navigate('/');
    }
  }, [navigate, handleLogout, fetchEmployeeName]);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <h2 className="page-title">{pageTitle}</h2>
      </div>

      <div className="header-right">
        <div className="header-date">
          {currentDate.toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "numeric", hour12: true
          })}
        </div>
        <div className="header-profile">
          <div className="profile-info">
            <div className="profile-role">Hi! I'm {userRole}</div>
            <div className="profile-name">{userName}</div>
          </div>
          <div className="dropdown-icon" onClick={toggleDropdown}>
            <FaChevronDown />
          </div>
          {isDropdownOpen && (
            <div className="profile-dropdown">
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

export default Header;
