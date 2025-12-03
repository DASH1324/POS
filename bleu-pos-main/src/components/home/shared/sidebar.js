import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import './sidebar.css';
import { Link } from 'react-router-dom';
import logo from '../../../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars, faHome, faChartBar, faFileAlt, faTags, faBoxes,
  faReceipt, faWarning, faClockRotateLeft
} from '@fortawesome/free-solid-svg-icons';

function SidebarComponent() {
  const [collapsed, setCollapsed] = useState(() => {
    // Load saved collapse state (default false)
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  const [userRole, setUserRole] = useState('');
  const location = useLocation();

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', newState);
      return newState;
    });
  };

  useEffect(() => {
    // Sync collapse state on page load (to ensure consistency)
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) setCollapsed(saved === 'true');

    // Check user role
    const params = new URLSearchParams(window.location.search);
    const roleFromUrl = params.get('userRole');

    if (roleFromUrl) {
      localStorage.setItem('userRole', roleFromUrl);
      setUserRole(roleFromUrl);
    } else {
      const roleFromStorage = localStorage.getItem('userRole');
      if (roleFromStorage) setUserRole(roleFromStorage);
    }
  }, [location]);

  return (
    <div className="sidebar-wrapper">
      <Sidebar collapsed={collapsed} className={`sidebar-container ${collapsed ? 'ps-collapsed' : ''}`}>
        <div className="side-container">
          <div className={`logo-wrapper ${collapsed ? 'collapsed' : ''}`}>
            <img src={logo} alt="Logo" className="logo" />
          </div>

          <div className="item-wrap">
            {!collapsed && <div className="section-title">GENERAL OPERATIONS</div>}
            <Menu>
              <MenuItem
                icon={<FontAwesomeIcon icon={faHome} />}
                component={<Link to="/home/dashboard" />}
                active={location.pathname === '/home/dashboard'}
              >
                Dashboard
              </MenuItem>
              <MenuItem
                icon={<FontAwesomeIcon icon={faFileAlt} />}
                component={<Link to="/home/transactionHistory" />}
                active={location.pathname === '/home/transactionHistory'}
              >
                Transaction History
              </MenuItem>
              <MenuItem
                icon={<FontAwesomeIcon icon={faBoxes} />}
                component={<Link to="/home/products" />}
                active={location.pathname === '/home/products'}
              >
                Products
              </MenuItem>
              <MenuItem
                icon={<FontAwesomeIcon icon={faTags} />}
                component={<Link to="/home/discounts" />}
                active={location.pathname === '/home/discounts'}
              >
                Discounts
              </MenuItem>
              <MenuItem
                icon={<FontAwesomeIcon icon={faWarning} />}
                component={<Link to="/home/spillage" />}
                active={location.pathname === '/home/spillage'}
              >
                Spillage
              </MenuItem>
              <MenuItem
                icon={<FontAwesomeIcon icon={faChartBar} />}
                component={<Link to="/home/salesMonitoring" />}
                active={location.pathname === '/home/salesMonitoring'}
              >
                Sales Monitoring
              </MenuItem>
              <MenuItem
                icon={<FontAwesomeIcon icon={faReceipt} />}
                component={<Link to="/home/salesReport" />}
                active={location.pathname === '/home/salesReport'}
              >
                Sales Report
              </MenuItem>

              {userRole === 'admin' && (
                <MenuItem
                  icon={<FontAwesomeIcon icon={faClockRotateLeft} />}
                  component={<Link to="/home/activityLogs" />}
                  active={location.pathname === '/home/activityLogs'}
                >
                  Logs
                </MenuItem>
              )}
            </Menu>
          </div>
        </div>
      </Sidebar>

      <button className="toggle-btn-right" onClick={toggleSidebar}>
        <FontAwesomeIcon icon={faBars} />
      </button>
    </div>
  );
}

export default SidebarComponent;
