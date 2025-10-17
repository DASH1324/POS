import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import './sidebar.css';
import { Link } from 'react-router-dom';
import logo from '../../../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars, faHome, faChartBar, faFileAlt, faTags, faBoxes,
  faReceipt, faWarning,
  faAreaChart
} from '@fortawesome/free-solid-svg-icons';

function SidebarComponent() {
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(''); // State to hold the user's role
  const toggleSidebar = () => setCollapsed(!collapsed);
  const location = useLocation(); // Gets the current page location

  // This effect re-runs every time the user navigates to a new page.
  useEffect(() => {
    const role = localStorage.getItem('userRole');
    console.log('Sidebar reading userRole from localStorage:', role); // This is the line causing the console message
    if (role) {
      setUserRole(role);
    }
  }, [location]); // The dependency on location is the key fix.

  return (
    <div className="sidebar-wrapper">
      <Sidebar collapsed={collapsed} className={`sidebar-container ${collapsed ? 'ps-collapsed' : ''}`}>
        <div className="side-container">
          <div className={`logo-wrapper ${collapsed ? 'collapsed' : ''}`}>
            <img src={logo} alt="Logo" className="logo" />
          </div>

          <div className='item-wrap'>
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
                icon={<FontAwesomeIcon icon={faChartBar} />}
                component={<Link to="/home/salesMonitoring" />}
                active={location.pathname === '/home/salesMonitoring'}
              >
                Sales Monitoring
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

              {!collapsed && <div className="section-title">REPORTS</div>}
              <MenuItem
                icon={<FontAwesomeIcon icon={faReceipt} />}
                component={<Link to="/home/salesReport" />}
                active={location.pathname === '/home/salesReport'}
              >
                Sales Report
              </MenuItem>
              <MenuItem
                icon={<FontAwesomeIcon icon={faAreaChart} />}
                component={<Link to="/home/transactionReport" />}
                active={location.pathname === '/home/transactionReport'}
              >
                Transaction Report
              </MenuItem>
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