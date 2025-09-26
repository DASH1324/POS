import React, { useState, useEffect } from "react";
import "./customDateModal.css";

function CustomDateModal({ show, onClose, onApply, initialStart, initialEnd }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errorMessage, setErrorMessage] = useState(""); 

  useEffect(() => {
    if (initialStart) setStartDate(initialStart);
    if (initialEnd) setEndDate(initialEnd);
  }, [initialStart, initialEnd]);

  const handleClose = () => {
    setErrorMessage(""); 
    onClose();
  };

  const handleApply = () => {
    if (startDate && endDate) {
      setErrorMessage("");
      onApply(startDate, endDate);
      onClose();
    } else {
      setErrorMessage("Please select both start and end dates");
    }
  };
  
  const handleOverlayClick = (e) => {
    if (e.target.className === "customDateModal-overlay") {
      handleClose(); 
    }
  };

  if (!show) return null;

  return (
    <div className="customDateModal-overlay" onClick={handleOverlayClick}>
      <div className="customDateModal-container">
        <h2>Select Custom Date Range</h2>

        {errorMessage && (
          <div className="customDateModal-error">
            {errorMessage}
          </div>
        )}

        <div className="customDateModal-inputs">
          <div>
            <label>Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setErrorMessage(""); 
              }}
            />
          </div>
          <div>
            <label>End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setErrorMessage("");
              }}
            />
          </div>
        </div>
        <div className="customDateModal-actions">
          <button className="customDateModal-btn cancel" onClick={handleClose}>
            Cancel
          </button>
          <button className="customDateModal-btn apply" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomDateModal;