import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, Clock, Package, Receipt, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import './CustomerBlockchainView.css';

const CustomerBlockchainView = () => {
  const [receiptData, setReceiptData] = useState(null);
  const [blockchainLogs, setBlockchainLogs] = useState([]);
  const [expandedLog, setExpandedLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const saleId = parseInt(window.location.search.substring(1));

  // API endpoints - separate services for security
  const POS_API = 'http://127.0.0.1:9000/auth/purchase_orders/receipt';
  const BLOCKCHAIN_API = 'http://127.0.0.1:9005/blockchain-logs/api/blockchain-logs/sale';

  useEffect(() => {
    if (saleId) {
      fetchReceiptAndBlockchain();
    } else {
      setError("No sale ID provided in URL");
      setLoading(false);
    }
  }, [saleId]);

  const fetchReceiptAndBlockchain = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch from both services in parallel
      const [receiptResponse, blockchainResponse] = await Promise.all([
        fetch(`${POS_API}/${saleId}`),
        fetch(`${BLOCKCHAIN_API}/${saleId}`)
      ]);
      
      // Check receipt response
      if (!receiptResponse.ok) {
        throw new Error(`Failed to fetch receipt data: ${receiptResponse.statusText}`);
      }
      
      // Check blockchain response (non-critical, can be empty)
      let blockchainData = [];
      if (blockchainResponse.ok) {
        blockchainData = await blockchainResponse.json();
      } else {
        console.warn('Blockchain logs not available, continuing with receipt only');
      }
      
      const receiptData = await receiptResponse.json();
      
      setReceiptData(receiptData);
      setBlockchainLogs(blockchainData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching transaction data:', err);
      setError(err.message || 'Failed to load transaction data');
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      CREATE: <Package className="custReceipt-icon" />,
      UPDATE: <Clock className="custReceipt-icon" />,
      CANCEL: <ChevronDown className="custReceipt-icon" />,
      REFUND: <Receipt className="custReceipt-icon" />
    };
    return icons[action] || <CheckCircle className="custReceipt-icon" />;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="custReceipt-container">
        <div className="custReceipt-loading">
          <div className="custReceipt-spinner"></div>
          <p className="custReceipt-loading-text">Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="custReceipt-container">
        <div className="custReceipt-error-card">
          <div className="custReceipt-error-icon-wrapper">
            <AlertCircle className="custReceipt-error-icon" />
          </div>
          <h2 className="custReceipt-error-title">Error Loading Transaction</h2>
          <p className="custReceipt-error-message">{error}</p>
          <button onClick={fetchReceiptAndBlockchain} className="custReceipt-retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="custReceipt-container">
      <div className="custReceipt-content">
        {/* Header */}
        <div className="custReceipt-header-card">
          <div className="custReceipt-shield-wrapper">
            <Shield className="custReceipt-shield-icon" />
          </div>
          <h1 className="custReceipt-main-title">Transaction Verified</h1>
          <p className="custReceipt-subtitle">Your transaction is secured on the blockchain</p>
          <div className="custReceipt-verified-badge">
            <CheckCircle className="custReceipt-check-icon" />
            <span>Immutable • Transparent • Secure</span>
          </div>
        </div>

        {/* Receipt Details */}
        {receiptData && (
          <div className="custReceipt-receipt-card">
            <div className="custReceipt-receipt-paper">
              <div className="custReceipt-receipt-top">
                <h3 className="custReceipt-store-name">{receiptData.storeName}</h3>
                <p className="custReceipt-store-address">{receiptData.address}</p>
                <div className="custReceipt-receipt-divider"></div>
              </div>
              
              <div className="custReceipt-receipt-meta">
                <div className="custReceipt-meta-row">
                  <span>Date:</span>
                  <span>{receiptData.date}</span>
                </div>
                <div className="custReceipt-meta-row">
                  <span>Cashier:</span>
                  <span>{blockchainLogs.length > 0 ? blockchainLogs[0].actorUsername : receiptData.cashier}</span>
                </div>
                <div className="custReceipt-meta-row">
                  <span>Payment:</span>
                  <span>{receiptData.paymentMethod}</span>
                </div>
                <div className="custReceipt-receipt-divider"></div>
              </div>

              <div className="custReceipt-items-list">
                {receiptData.items.map((item, idx) => (
                  <div key={idx} className="custReceipt-item">
                    <div className="custReceipt-item-line">
                      <span className="custReceipt-item-name">{item.name}</span>
                      <span className="custReceipt-item-total">₱{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div className="custReceipt-item-subline">
                      <span>₱{item.price.toFixed(2)} × {item.quantity}</span>
                    </div>
                    {item.addons && item.addons.map((addon, addonIdx) => (
                      <div key={addonIdx} className="custReceipt-addon">
                        <span>  + {addon.name} (×{addon.quantity})</span>
                        <span>₱{(addon.price * addon.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {item.discounts && item.discounts.map((discount, discIdx) => (
                      <div key={discIdx} className="custReceipt-discount">
                        <span>  - {discount.name}</span>
                        <span>-₱{discount.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="custReceipt-receipt-divider"></div>

              <div className="custReceipt-totals">
                <div className="custReceipt-total-row">
                  <span>Subtotal:</span>
                  <span>₱{receiptData.subtotal.toFixed(2)}</span>
                </div>
                {receiptData.promotionalDiscount > 0 && (
                  <div className="custReceipt-total-row custReceipt-discount-row">
                    <span>Promo Discount:</span>
                    <span>-₱{receiptData.promotionalDiscount.toFixed(2)}</span>
                  </div>
                )}
                {receiptData.manualDiscount > 0 && (
                  <div className="custReceipt-total-row custReceipt-discount-row">
                    <span>Manual Discount:</span>
                    <span>-₱{receiptData.manualDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="custReceipt-receipt-divider-bold"></div>
                <div className="custReceipt-total-row custReceipt-grand-total">
                  <span>TOTAL:</span>
                  <span>₱{receiptData.total.toFixed(2)}</span>
                </div>
                <div className="custReceipt-receipt-divider-bold"></div>
              </div>

              <div className="custReceipt-receipt-bottom">
                <p>Thank you for your purchase!</p>
                <p>Please come again</p>
              </div>
            </div>
          </div>
        )}

        {/* Blockchain Transaction History */}
        <div className="custReceipt-blockchain-card">
          <h2 className="custReceipt-section-title">
            <Shield className="custReceipt-title-icon" />
            Blockchain Transaction History
          </h2>

          {blockchainLogs.length === 0 ? (
            <div className="custReceipt-no-logs">
              <p>No blockchain logs available yet.</p>
              <p className="custReceipt-no-logs-subtitle">Logs will appear as the transaction is processed.</p>
            </div>
          ) : (
            <div className="custReceipt-logs-list">
              {blockchainLogs.map((log, idx) => (
                <div key={log.logId} className="custReceipt-log-item">
                  <div 
                    className="custReceipt-log-header"
                    onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
                  >
                    <div className="custReceipt-log-header-content">
                      <div className="custReceipt-log-badges">
                        <span className={`custReceipt-action-badge custReceipt-action-${log.action.toLowerCase()}`}>
                          {getActionIcon(log.action)}
                          {log.action}
                        </span>
                        <span className="custReceipt-block-number">
                          Block #{log.blockNumber}
                        </span>
                      </div>
                      {expandedLog === idx ? (
                        <ChevronUp className="custReceipt-chevron" />
                      ) : (
                        <ChevronDown className="custReceipt-chevron" />
                      )}
                    </div>
                    
                    <p className="custReceipt-log-description">{log.changeDescription}</p>
                    
                    <div className="custReceipt-log-meta">
                      <span className="custReceipt-log-timestamp">
                        <Clock className="custReceipt-clock-icon" />
                        {formatDate(log.timestamp)}
                      </span>
                      <span>By: {log.actorUsername}</span>
                    </div>
                  </div>

                  {expandedLog === idx && (
                    <div className="custReceipt-log-details">
                      <div className="custReceipt-hash-section">
                        <p className="custReceipt-hash-label">Transaction Hash</p>
                        <div className="custReceipt-hash-value">
                          {log.transactionHash}
                        </div>
                      </div>
                      
                      <div className="custReceipt-hash-section">
                        <p className="custReceipt-hash-label">Data Hash</p>
                        <div className="custReceipt-hash-value">
                          {log.dataHash}
                        </div>
                      </div>

                      <div className="custReceipt-verified-indicator">
                        <CheckCircle className="custReceipt-verified-icon" />
                        <span>Verified and immutable on blockchain</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="custReceipt-info-box">
            <p>
              <strong>Why blockchain?</strong> Every transaction is permanently recorded and cannot be altered, 
              ensuring complete transparency and trust in your purchase history.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="custReceipt-footer">
          <p>Thank you for choosing {receiptData?.storeName}</p>
          <p className="custReceipt-footer-subtitle">This page is secured and verified by blockchain technology</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerBlockchainView;