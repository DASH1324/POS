import React, { useState, useEffect } from "react";
import "./customDateModal.css";

function CustomDateModal({ show, onClose, onApply, initialStart, initialEnd }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errorMessage, setErrorMessage] = useState(""); 

  useEffect(() => {
    if (show) {
      if (initialStart) setStartDate(initialStart);
      if (initialEnd) setEndDate(initialEnd);
    } else {
      // Reset when modal closes
      setErrorMessage("");
    }
  }, [show, initialStart, initialEnd]);

  const handleClose = () => {
    setErrorMessage(""); 
    onClose();
  };

  const handleApply = () => {
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        setErrorMessage("Start date cannot be after end date");
        return;
      }
      setErrorMessage("");
      onApply(startDate, endDate);
      onClose();
    } else {
      setErrorMessage("Please select both start and end dates");
    }
  };

  if (!show) return null;

  return (
    <div className="customDateModal-overlay" onClick={handleClose}>
      <div className="customDateModal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="customDateModal-header">
          <h3>Select Custom Date Range</h3>
          <button className="customDateModal-close-modal" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="customDateModal-content">
          {errorMessage && (
            <p className="customDateModal-error-message">{errorMessage}</p>
          )}

          <div className="customDateModal-date-row">
            <div className="customDateModal-input-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setErrorMessage(""); 
                }}
                className="customDateModal-date-input"
              />
            </div>

            <div className="customDateModal-input-group">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setErrorMessage("");
                }}
                className="customDateModal-date-input"
              />
            </div>
          </div>
        </div>

        <div className="customDateModal-footer">
          <button className="customDateModal-btn-confirm" onClick={handleApply}>
            Apply Date Range
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomDateModal;