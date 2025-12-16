import React, { useState, useEffect } from 'react';
import Navbar from '../navbar';
import './ClosedSessionSummary.css';
import Loading from "../home/shared/loading";
import { 
  FaDollarSign, 
  FaReceipt, 
  FaCashRegister, 
  FaBalanceScale,
  FaUndo,
  FaLock,
  FaInfoCircle,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaFileInvoice
} from 'react-icons/fa';

const API_BASE_URL = 'http://127.0.0.1:9001/api';

function ClosedSessionSummary() {
  const [sessionSummary, setSessionSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const formatCurrency = (value) => {
    const num = parseFloat(value || 0);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const variance = sessionSummary 
    ? (sessionSummary.cash_in_drawer || 0) - (sessionSummary.expected_cash || 0)
    : 0;

  return (
    <div className="cSession-page">
      <Navbar isDisabled={true} />
      <div className="cSession-report">
        {isLoading ? (
          <Loading />
        ) : (
          <>
            {/* Header Banner */}
            <div className="cSession-header-banner">
              <div className="cSession-banner-left">
                <div className="cSession-banner-icon-wrapper">
                  <FaLock className="cSession-banner-icon" />
                </div>
                <div className="cSession-banner-content">
                  <h1>Session Closed</h1>
                  <p>Your cashier session has been recorded and finalized for today.</p>
                </div>
              </div>
              
              <div className="cSession-banner-right">
                <button onClick={handleReturnToLogin} className="cSession-return-btn-header">
                  <FaUndo /> Return to Login
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="cSession-scrollable-content">
              {error ? (
                <div className="cSession-error-card">
                  <div className="cSession-error-icon">⚠️</div>
                  <h2>Error Loading Summary</h2>
                  <p>{error}</p>
                  <button onClick={handleReturnToLogin} className="cSession-return-btn">
                    Return to Login
                  </button>
                </div>
              ) : sessionSummary && (
                <>
                  {/* Transaction Breakdown */}
                  <div className="cSession-info-section cSession-full-width">
                    <h3 className="cSession-section-title"><FaFileInvoice /> Summary</h3>
                    <div className="cSession-breakdown-grid">
                      <div className="cSession-breakdown-item">
                        <div className="cSession-breakdown-icon cSession-cash-icon">
                          <FaMoneyBillWave />
                        </div>
                        <div className="cSession-breakdown-content">
                          <div className="cSession-breakdown-label">Total Cash Sales</div>
                          <div className="cSession-breakdown-value">
                            ₱{formatCurrency(sessionSummary.total_sales)}
                          </div>
                        </div>
                      </div>
                      <div className="cSession-breakdown-item">
                        <div className="cSession-breakdown-icon cSession-card-icon">
                          <FaExclamationTriangle />
                        </div>
                        <div className="cSession-breakdown-content">
                          <div className="cSession-breakdown-label">Cash Discrepancy</div>
                          <div className={`cSession-breakdown-value ${variance < 0 ? 'cSession-negative' : ''}`}>
                            ₱{formatCurrency(Math.abs(variance))} {variance < 0 ? 'Short' : 'Over'}
                          </div>
                        </div>
                      </div>
                      <div className="cSession-breakdown-item">
                        <div className="cSession-breakdown-icon cSession-void-icon">
                          <FaReceipt />
                        </div>
                        <div className="cSession-breakdown-content">
                          <div className="cSession-breakdown-label">Total Transactions</div>
                          <div className="cSession-breakdown-value">
                            {sessionSummary.total_transactions || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Side by Side Sections */}
                  <div className="cSession-side-by-side-container">
                    {/* Session Details */}
                    <div className="cSession-info-section">
                      <h3 className="cSession-section-title">Session Details</h3>
                      <div className="cSession-details-grid">
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">Cashier:</span>
                          <span className="cSession-detail-value">
                            {sessionSummary.cashier_name || 'N/A'}
                          </span>
                        </div>
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">Manager:</span>
                          <span className="cSession-detail-value">
                            {sessionSummary.manager_name || 'N/A'}
                          </span>
                        </div>
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">Date:</span>
                          <span className="cSession-detail-value">
                            {sessionSummary.date || 'N/A'}
                          </span>
                        </div>
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">Start Time:</span>
                          <span className="cSession-detail-value">
                            {sessionSummary.start_time || 'N/A'}
                          </span>
                        </div>
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">End Time:</span>
                          <span className="cSession-detail-value">
                            {sessionSummary.end_time || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="cSession-info-section">
                      <h3 className="cSession-section-title">Financial Summary</h3>
                      <div className="cSession-details-grid">
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">Initial Cash:</span>
                          <span className="cSession-detail-value">
                            ₱{formatCurrency(sessionSummary.initial_cash)}
                          </span>
                        </div>
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">Total Sales:</span>
                          <span className="cSession-detail-value">
                            ₱{formatCurrency(sessionSummary.total_sales)}
                          </span>
                        </div>
                        <div className="cSession-detail-item">
                          <span className="cSession-detail-label">Expected Cash:</span>
                          <span className="cSession-detail-value">
                            ₱{formatCurrency(sessionSummary.expected_cash)}
                          </span>
                        </div>
                        <div className="cSession-detail-item cSession-detail-highlight">
                          <span className="cSession-detail-label">Cash in Drawer:</span>
                          <span className="cSession-detail-value cSession-detail-bold">
                            ₱{formatCurrency(sessionSummary.cash_in_drawer)}
                          </span>
                        </div>
                        <div className={`cSession-detail-item ${variance === 0 ? 'cSession-detail-balanced' : 'cSession-detail-discrepancy'}`}>
                          <span className="cSession-detail-label">Cash Discrepancy:</span>
                          <span className={`cSession-detail-value cSession-detail-bold ${variance < 0 ? 'cSession-negative' : variance > 0 ? 'cSession-positive' : 'cSession-balanced'}`}>
                            ₱{formatCurrency(Math.abs(variance))} {variance < 0 ? 'Short' : variance > 0 ? 'Over' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ClosedSessionSummary;  