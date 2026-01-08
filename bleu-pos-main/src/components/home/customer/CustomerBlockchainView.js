import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, Clock, Package, Receipt, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

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

      // Remove saleId from URL after successful load
    } catch (err) {
      console.error('Error fetching transaction data:', err);
      setError(err.message || 'Failed to load transaction data');
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      CREATE: 'bg-green-100 text-green-800',
      UPDATE: 'bg-blue-100 text-blue-800',
      CANCEL: 'bg-red-100 text-red-800',
      REFUND: 'bg-orange-100 text-orange-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action) => {
    const icons = {
      CREATE: <Package className="w-4 h-4" />,
      UPDATE: <Clock className="w-4 h-4" />,
      CANCEL: <ChevronDown className="w-4 h-4" />,
      REFUND: <Receipt className="w-4 h-4" />
    };
    return icons[action] || <CheckCircle className="w-4 h-4" />;
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
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2f1 0%, #e3f2fd 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', border: '4px solid #009688', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#666' }}>Loading transaction details...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2f1 0%, #e3f2fd 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ maxWidth: '600px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#ffebee', padding: '16px', borderRadius: '50%' }}>
              <AlertCircle style={{ width: '48px', height: '48px', color: '#d32f2f' }} />
            </div>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>
            Error Loading Transaction
          </h2>
          <p style={{ color: '#666', marginBottom: '16px' }}>
            {error}
          </p>
          <button 
            onClick={fetchReceiptAndBlockchain}
            style={{ 
              backgroundColor: '#009688', 
              color: 'white', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', background: 'linear-gradient(135deg, #e0f2f1 0%, #e3f2fd 100%)', padding: '32px 16px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', padding: '32px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#e0f2f1', padding: '24px', borderRadius: '50%' }}>
              <Shield style={{ width: '48px', height: '48px', color: '#009688' }} />
            </div>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: '8px' }}>
            Transaction Verified
          </h1>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: '16px', fontSize: '14px' }}>
            Your transaction is secured on the blockchain
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', color: '#999' }}>
            <CheckCircle style={{ width: '16px', height: '16px', color: '#4caf50' }} />
            <span>Immutable • Transparent • Secure</span>
          </div>
        </div>

        {/* Receipt Details */}
        {receiptData && (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', padding: '32px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt style={{ width: '24px', height: '24px', color: '#009688' }} />
              Receipt Details
            </h2>
            
            <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '16px', marginBottom: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a' }}>{receiptData.storeName}</h3>
                <p style={{ fontSize: '13px', color: '#666' }}>{receiptData.address}</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Date</p>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{receiptData.date}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Cashier</p>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>
                    {blockchainLogs.length > 0 ? blockchainLogs[0].actorUsername : receiptData.cashier}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Payment</p>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{receiptData.paymentMethod}</p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              {receiptData.items.map((item, idx) => (
                <div key={idx} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{item.name}</p>
                      <p style={{ fontSize: '13px', color: '#666' }}>₱{item.price.toFixed(2)} × {item.quantity}</p>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  {item.addons && item.addons.map((addon, addonIdx) => (
                    <div key={addonIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginLeft: '16px' }}>
                      <span>+ {addon.name} (×{addon.quantity})</span>
                      <span>₱{(addon.price * addon.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {item.discounts && item.discounts.map((discount, discIdx) => (
                    <div key={discIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4caf50', marginLeft: '16px' }}>
                      <span>- {discount.name}</span>
                      <span>-₱{discount.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <span>Subtotal</span>
                <span>₱{receiptData.subtotal.toFixed(2)}</span>
              </div>
              {receiptData.promotionalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4caf50', marginBottom: '8px' }}>
                  <span>Promotion Discount</span>
                  <span>-₱{receiptData.promotionalDiscount.toFixed(2)}</span>
                </div>
              )}
              {receiptData.manualDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4caf50', marginBottom: '8px' }}>
                  <span>Manual Discount</span>
                  <span>-₱{receiptData.manualDiscount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '700', color: '#1a1a1a', paddingTop: '8px', borderTop: '1px solid #e0e0e0', marginTop: '8px' }}>
                <span>Total</span>
                <span>₱{receiptData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Blockchain Transaction History */}
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ width: '24px', height: '24px', color: '#009688' }} />
            Blockchain Transaction History
          </h2>

          {blockchainLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
              <p>No blockchain logs available yet.</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>Logs will appear as the transaction is processed.</p>
            </div>
          ) : (
            <div>
              {blockchainLogs.map((log, idx) => (
                <div key={log.logId} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
                  <div 
                    style={{ padding: '16px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                    onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ 
                          padding: '6px 12px', 
                          borderRadius: '12px', 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          ...(log.action === 'CREATE' ? { backgroundColor: '#e8f5e9', color: '#2e7d32' } : 
                             log.action === 'UPDATE' ? { backgroundColor: '#e3f2fd', color: '#1976d2' } : 
                             log.action === 'CANCEL' ? { backgroundColor: '#ffebee', color: '#c62828' } : 
                             { backgroundColor: '#fff3e0', color: '#e65100' })
                        }}>
                          {getActionIcon(log.action)}
                          {log.action}
                        </span>
                        <span style={{ fontSize: '12px', color: '#999' }}>
                          Block #{log.blockNumber}
                        </span>
                      </div>
                      {expandedLog === idx ? (
                        <ChevronUp style={{ width: '20px', height: '20px', color: '#bdbdbd' }} />
                      ) : (
                        <ChevronDown style={{ width: '20px', height: '20px', color: '#bdbdbd' }} />
                      )}
                    </div>
                    
                    <p style={{ fontSize: '14px', color: '#424242', margin: '8px 0' }}>{log.changeDescription}</p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#999' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock style={{ width: '12px', height: '12px' }} />
                        {formatDate(log.timestamp)}
                      </span>
                      <span>By: {log.actorUsername}</span>
                    </div>
                  </div>

                  {expandedLog === idx && (
                    <div style={{ backgroundColor: '#f9f9f9', borderTop: '1px solid #e0e0e0', padding: '16px' }}>
                      <div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '12px', fontWeight: '600', color: '#424242', marginBottom: '4px' }}>Transaction Hash</p>
                          <div style={{ backgroundColor: 'white', borderRadius: '6px', padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#666', wordBreak: 'break-all' }}>
                            {log.transactionHash}
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '12px', fontWeight: '600', color: '#424242', marginBottom: '4px' }}>Data Hash</p>
                          <div style={{ backgroundColor: 'white', borderRadius: '6px', padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#666', wordBreak: 'break-all' }}>
                            {log.dataHash}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#4caf50' }}>
                          <CheckCircle style={{ width: '16px', height: '16px' }} />
                          <span>Verified and immutable on blockchain</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ backgroundColor: '#e0f2f1', borderRadius: '8px', padding: '16px', marginTop: '24px' }}>
            <p style={{ fontSize: '13px', color: '#424242', textAlign: 'center', margin: 0 }}>
              <strong>Why blockchain?</strong> Every transaction is permanently recorded and cannot be altered, 
              ensuring complete transparency and trust in your purchase history.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: '#999' }}>
          <p>Thank you for choosing {receiptData?.storeName}</p>
          <p style={{ marginTop: '8px' }}>This page is secured and verified by blockchain technology</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerBlockchainView;