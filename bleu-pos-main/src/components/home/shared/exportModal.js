import React, { useState } from 'react';
import './exportModal.css';

// Export Format Modal Component
export const ExportModal = ({ onClose, onExportPDF, onExportCSV }) => {
  return (
    <div className="infoModal-overlay" onClick={onClose}>
      <div className="infoModal-content" onClick={(e) => e.stopPropagation()}>
        <div className="infoModal-close" onClick={onClose}>
          &times;
        </div>
        <div className="infoModal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1>Choose Export Format</h1>
        <p>Select the file type you'd like to export.</p>
        <div className="infoModal-button-group">
          <button onClick={onExportPDF} className="infoModal-btn infoModal-pdf">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </button>
          <button onClick={onExportCSV} className="infoModal-btn infoModal-csv">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            CSV
          </button>
        </div>
      </div>
    </div>
  );
};

// No Data Modal Component
export const NoDataModal = ({ onClose }) => {
  return (
    <div className="infoModal-overlay" onClick={onClose}>
      <div className="infoModal-content infoModal-nodata" onClick={(e) => e.stopPropagation()}>
        <div className="infoModal-close" onClick={onClose}>
          &times;
        </div>
        <div className="infoModal-icon infoModal-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1>No Sales Data</h1>
        <p>There is no sales data available to export.</p>
      </div>
    </div>
  );
};

// Refund Reason Modal Component
export const RefundReasonModal = ({
  onClose,
  onSubmit,
  refundType = 'full',
  itemsToRefund = []
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showError, setShowError] = useState(false);

  const commonReasons = [
    'Customer changed mind',
    'Wrong item ordered',
    'Item defective/damaged',
    'Quality not as expected',
    'Delivery delay',
    'Price mismatch',
    'Other'
  ];

  const handleConfirm = () => {
    const finalReason = selectedReason === 'Other' ? customReason : selectedReason;

    if (!finalReason || finalReason.trim() === '') {
      setShowError(true);
      return;
    }

    onSubmit(finalReason.trim());
    handleClose();
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    setShowError(false);
    onClose();
  };

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason);
    setShowError(false);
    if (reason !== 'Other') {
      setCustomReason('');
    }
  };

  return (
    <div className="infoModal-overlay" onClick={handleClose}>
      <div className="infoModal-content infoModal-refund" onClick={(e) => e.stopPropagation()}>
        <div className="infoModal-close" onClick={handleClose}>
          &times;
        </div>
        <div className="infoModal-icon infoModal-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1>Confirm Refund</h1>
        <p>
          {refundType === 'full' 
            ? 'Are you sure you want to process a full refund for this transaction?' 
            : `Are you sure you want to refund ${itemsToRefund.length} item(s)?`}
        </p>

        {refundType === 'partial' && itemsToRefund.length > 0 && (
          <div className="infoModal-refund-items">
            <h4>Items to refund:</h4>
            <ul>
              {itemsToRefund.map((item, index) => (
                <li key={index}>
                  {item.name} × {item.refundQuantity}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="infoModal-refund-reason">   
          <select 
            className="infoModal-reason-dropdown"
            value={selectedReason}
            onChange={(e) => handleReasonSelect(e.target.value)}
          >
            <option value="">-- Select a reason --</option>
            {commonReasons.map((reason, index) => (
              <option key={index} value={reason}>
                {reason}
              </option>
            ))}
          </select>

          {selectedReason === 'Other' && (
            <div className="infoModal-custom-reason">
              <textarea
                placeholder="Please specify the reason..."
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setShowError(false);
                }}
                maxLength={200}
                rows={3}
              />
              <div className="infoModal-char-count">
                {customReason.length}/200
              </div>
            </div>
          )}

          {showError && (
            <div className="infoModal-error-message">
              Please select or enter a reason for the refund
            </div>
          )}
        </div>

        <div className="infoModal-button-group infoModal-refund-actions">
          <button 
            className="infoModal-btn infoModal-cancel" 
            onClick={handleClose}
          >
            Cancel
          </button>
          <button 
            className="infoModal-btn infoModal-confirm" 
            onClick={handleConfirm}
          >
            Confirm Refund
          </button>
        </div>
      </div>
    </div>
  );
};

// Unable to Load Data Component (Inline)
export const UnableToLoadData = () => {
  return (
    <div className="infoModal-state-container">
      <div className="infoModal-state-icon infoModal-state-error">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2>Unable to Load Data</h2>
      <p>We encountered an error while loading your data. Please try again later.</p>
    </div>
  );
};

// No Data Component (Inline)
export const NoData = () => {
  return (
    <div className="infoModal-state-container">
      <div className="infoModal-state-icon infoModal-state-warning">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h2>No Data</h2>
      <p>There is no data available to display at this time.</p>
    </div>
  );
};