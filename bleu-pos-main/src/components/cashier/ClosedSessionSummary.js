import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../navbar';
import './ClosedSessionSummary.css';

const API_BASE_URL = 'http://127.0.0.1:9001/api';

function ClosedSessionSummary() {
  const [sessionSummary, setSessionSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchSessionSummary = async () => {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const username = localStorage.getItem('username');

      if (!token || !username) {
        setError("Authorization Error. Please log in.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/session/summary?cashier_name=${encodeURIComponent(username)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch session summary.');
        }

        const data = await response.json();
        setSessionSummary(data);
      } catch (err) {
        console.error("Error fetching session summary:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionSummary();
  }, []);

  const handleReturnToLogin = () => {
    window.location.href = 'http://localhost:4002/';
  };

  if (isLoading) {
    return (
      <div className="closed-session-summary-page">
        <Navbar />
        <div className="closed-session-summary-container">
          <div className="loading">Loading session summary...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="closed-session-summary-page">
        <Navbar />
        <div className="closed-session-summary-container">
          <div className="error-message">Error: {error}</div>
          <button onClick={handleReturnToLogin} className="return-btn">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="closed-session-summary-page">
      <Navbar />
      <div className="closed-session-summary-container">
        <div className="summary-header">
          <h1>Today's Session Summary</h1>
          <p>Your session for today has already been closed.</p>
        </div>

        {sessionSummary && (
          <div className="summary-content">
            <div className="summary-section">
              <h2>Session Details</h2>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Cashier:</span>
                  <span className="value">{sessionSummary.cashier_name || 'N/A'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Date:</span>
                  <span className="value">{sessionSummary.date || 'N/A'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Start Time:</span>
                  <span className="value">{sessionSummary.start_time || 'N/A'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">End Time:</span>
                  <span className="value">{sessionSummary.end_time || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="summary-section">
              <h2>Financial Summary</h2>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Initial Cash:</span>
                  <span className="value">₱{sessionSummary.initial_cash ? sessionSummary.initial_cash.toFixed(2) : '0.00'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Total Sales:</span>
                  <span className="value">₱{sessionSummary.total_sales ? sessionSummary.total_sales.toFixed(2) : '0.00'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Cash in Drawer:</span>
                  <span className="value">₱{sessionSummary.cash_in_drawer ? sessionSummary.cash_in_drawer.toFixed(2) : '0.00'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Expected Cash:</span>
                  <span className="value">₱{sessionSummary.expected_cash ? sessionSummary.expected_cash.toFixed(2) : '0.00'}</span>
                </div>
              </div>
            </div>

            <div className="summary-section">
              <h2>Transaction Summary</h2>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Total Transactions:</span>
                  <span className="value">{sessionSummary.total_transactions || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Cash Transactions:</span>
                  <span className="value">{sessionSummary.cash_transactions || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Card Transactions:</span>
                  <span className="value">{sessionSummary.card_transactions || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Void Transactions:</span>
                  <span className="value">{sessionSummary.void_transactions || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="summary-actions">
          <p>You cannot access the menu until tomorrow's session begins.</p>
          <p>Please contact your manager if you need assistance.</p>
          <button onClick={handleReturnToLogin} className="return-btn">
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClosedSessionSummary;
