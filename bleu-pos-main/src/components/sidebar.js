import React, { useState} from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, Menu, MenuItem } from 'react-pro-sidebar';
import './sidebar.css';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars, faHome, faChartBar, faFileAlt, faTags, faBoxes,
  faReceipt, faCog
} from '@fortawesome/free-solid-svg-icons';

function SidebarComponent() {
  const [collapsed, setCollapsed] = useState(false);
  const toggleSidebar = () => setCollapsed(!collapsed);
  const location = useLocation();

  return (
    <div className="sidebar-wrapper">
      {/* Sidebar Panel */}
      <Sidebar collapsed={collapsed} className={`sidebar-container ${collapsed ? 'ps-collapsed' : ''}`}>
        <div className="side-container">
          <div className={`logo-wrapper ${collapsed ? 'collapsed' : ''}`}>
            <img src={logo} alt="Logo" className="logo" />
          </div>

          <div className='item-wrap'>
          {!collapsed && <div className="section-title">OPERATIONS</div>}
          <Menu>
            <MenuItem 
              icon={<FontAwesomeIcon icon={faHome} />}
              component={<Link to="/admin/dashboard" />}
              active={location.pathname === '/admin/dashboard'}
            >
              Dashboard
            </MenuItem>
            <MenuItem 
              icon={<FontAwesomeIcon icon={faChartBar} />} 
              component={<Link to="/admin/salesMon" />}
              active={location.pathname === '/admin/salesMon'}
              >
              Sales Monitoring
            </MenuItem>
            <MenuItem 
              icon={<FontAwesomeIcon icon={faFileAlt} />} 
              component={<Link to="/admin/transHis" />}
              active={location.pathname === '/admin/transHis'}
              >
              Transaction History
            </MenuItem>
            <MenuItem 
              icon={<FontAwesomeIcon icon={faBoxes} />} 
              component={<Link to="/admin/products" />}
              active={location.pathname === '/admin/products'}
              >
              Products
            </MenuItem>
            <MenuItem 
              icon={<FontAwesomeIcon icon={faTags} />}
              component={<Link to="/admin/discounts" />}
              active={location.pathname === '/admin/discounts'}
              >
              Discounts
            </MenuItem>
            <MenuItem 
              icon={<FontAwesomeIcon icon={faReceipt} />} 
              component={<Link to="/admin/salesRep" />}
              active={location.pathname === '/admin/salesRep'}
            >
              Sales Reports
            </MenuItem>
            <MenuItem 
              icon={<FontAwesomeIcon icon={faCog} />} 
              component={<Link to="/admin/transRep" />}
              active={location.pathname === '/admin/transRep'}
            >
              Transaction Reports
            </MenuItem>
          </Menu>
          </div>
        </div>
      </Sidebar>

      {/* TOGGLE BUTTON ON THE RIGHT OF SIDEBAR */}
      <button className="toggle-btn-right" onClick={toggleSidebar}>
        <FontAwesomeIcon icon={faBars} />
      </button>
    </div>
  );
}

export default SidebarComponent;