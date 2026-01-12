import React from 'react';
import './NoInternetModal.css';

const NoInternetModal = () => {
  return (
    <div className="noInternet-overlay">
      <div className="noInternet-modal">
        <button className="noInternet-close">×</button>
        
        <div className="noInternet-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h2 className="noInternet-title">No Internet Connection</h2>
        
        <p className="noInternet-message">
          No internet connection. Please check your connection to continue processing orders.
        </p>
      </div>
    </div>
  );
};

export default NoInternetModal;