import React, { useState, useEffect } from "react";
import dayjs from 'dayjs';
import QRCode from 'qrcode';
import "./orderPanel.css";

const API_BASE_URL = 'http://127.0.0.1:9006/api';

const OrderModals = ({
  // PIN Modal props
  showPinModal,
  setShowPinModal,
  pinModalType,
  enteredPin,
  setEnteredPin,
  pinError,
  setPinError,
  isProcessing,
  confirmPinAction,
  calculateRefundTotal,
  
  // Refund Expired Modal props
  showRefundExpiredModal,
  setShowRefundExpiredModal,
  
  // Receipt Modal props
  showReceiptModal,
  setShowReceiptModal,
  confirmPrintReceipt,
  order,
  isStore,
  subtotal,
  addOnsCost,
  promotionalDiscount,
  manualDiscount,
  onlineBaseSubtotal,
  onlineAddOnsTotal,
  hasRefunds,
  getTotalRefundAmount,
  cashierName
}) => {
  
  const [receiptConfig, setReceiptConfig] = useState(null);
  const [generatedQRCode, setGeneratedQRCode] = useState(null);
  const [blockchainQRCode, setBlockchainQRCode] = useState(null);
  const [cashierFullName, setCashierFullName] = useState('');

  // Fetch receipt configuration and cashier full name
  useEffect(() => {
    if (showReceiptModal) {
      fetchReceiptConfig();
      fetchCashierFullName();
    }
  }, [showReceiptModal]);

  // Generate QR codes when receipt config changes or order changes
  useEffect(() => {
    if (receiptConfig && order) {
      // Generate the first QR code (existing functionality)
      if (receiptConfig.showQR && receiptConfig.qrType === 'link' && receiptConfig.qrLink) {
        generateQRCode(receiptConfig.qrLink, setGeneratedQRCode);
      } else {
        setGeneratedQRCode(null);
      }
      
      // Always generate blockchain QR code
      const blockchainUrl = generateBlockchainUrl();
      generateQRCode(blockchainUrl, setBlockchainQRCode);
    }
  }, [receiptConfig, order]);

  const generateBlockchainUrl = () => {
    // Generate URL for blockchain transaction view
    const baseUrl = window.location.origin;
    return `${baseUrl}/blockchain?${order.id}`;
  };

  const fetchReceiptConfig = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setDefaultConfig();
        return;
      }

      const response = await fetch(`${API_BASE_URL}/receipt/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const config = await response.json();
        setReceiptConfig(config);
      } else {
        setDefaultConfig();
      }
    } catch (error) {
      console.error('Error fetching receipt config:', error);
      setDefaultConfig();
    }
  };

  const setDefaultConfig = () => {
    setReceiptConfig({
      storeName: 'BLEU BEAN CAFE',
      address1: 'Don Fabian St., Commonwealth',
      address2: 'Quezon City, Philippines',
      telephone: '0917XXXXXXX',
      showQR: true,
      qrType: 'link',
      qrLink: '',
      qrText: 'Scan to learn more about us!',
      additionalText: ''
    });
  };

  const generateQRCode = async (url, setQRCodeState) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQRCodeState(qrDataUrl);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setQRCodeState(null);
    }
  };

  const fetchCashierFullName = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const username = cashierName || localStorage.getItem('username');
      if (!token || !username) {
        setCashierFullName('Staff');
        return;
      }

      const response = await fetch(`http://127.0.0.1:4000/users/employee_name?username=${username}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCashierFullName(data.employee_name || username);
      } else {
        setCashierFullName(username);
      }
    } catch (error) {
      console.error("Error fetching cashier full name:", error);
      setCashierFullName(cashierName || 'Staff');
    }
  };
  
  const getPinModalTitle = () => {
    switch (pinModalType) {
      case 'cancel':
        return 'Manager PIN Required';
      case 'refund':
        return 'Manager PIN Required for Full Refund';
      case 'partial-refund':
        return 'Manager PIN Required for Partial Refund';
      default:
        return 'Manager PIN Required';
    }
  };

  const getPinModalDescription = () => {
    switch (pinModalType) {
      case 'cancel':
        return 'Please ask a manager to enter their PIN to cancel this order.';
      case 'refund':
        return 'Please ask a manager to enter their PIN to process full refund.';
      case 'partial-refund':
        return `Please ask a manager to enter their PIN to refund selected items (₱${calculateRefundTotal().toFixed(2)}).`;
      default:
        return 'Please ask a manager to enter their PIN.';
    }
  };

  return (
    <>
      {/* PIN Modal */}
      {showPinModal && (
        <div className="orderpanel-modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="orderpanel-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="orderpanel-modal-header">
              <h3 className="orderpanel-modal-title">{getPinModalTitle()}</h3>
              <button className="orderpanel-close-modal" onClick={() => setShowPinModal(false)}>×</button>
            </div>
            <div className="orderpanel-modal-body">
              <p className="orderpanel-modal-description">
                {getPinModalDescription()}
              </p>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="orderpanel-modal-input"
                placeholder="Enter PIN"
                value={enteredPin}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value)) {
                    setEnteredPin(value);
                    setPinError("");
                  }
                }}
                autoFocus
              />
              {pinError && <p className="orderpanel-modal-error">{pinError}</p>}
            </div>
            <div className="orderpanel-modal-footer">
              <button 
                className="orderpanel-modal-btn orderpanel-modal-cancel" 
                onClick={() => setShowPinModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                className="orderpanel-modal-btn orderpanel-modal-confirm" 
                onClick={confirmPinAction}
                disabled={isProcessing || enteredPin.length < 4}
              >
                {isProcessing ? "Verifying..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Expired Modal */}
      {showRefundExpiredModal && (
        <div className="orderpanel-modal-overlay" onClick={() => setShowRefundExpiredModal(false)}>
          <div className="orderpanel-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="orderpanel-modal-header">
              <h3 className="orderpanel-modal-title">Refund Not Available</h3>
              <button className="orderpanel-close-modal" onClick={() => setShowRefundExpiredModal(false)}>×</button>
            </div>
            <div className="orderpanel-modal-body">
              <p className="orderpanel-modal-description">
                ⚠️ Cannot process refund after 30 minutes of order completion.
              </p>
              <p className="orderpanel-modal-subdescription">
                This order was completed more than 30 minutes ago. Refunds from cashier are only available within 30 minutes of completion.
              </p>
            </div>
            <div className="orderpanel-modal-footer">
              <button 
                className="orderpanel-modal-btn orderpanel-modal-confirm" 
                onClick={() => setShowRefundExpiredModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Print Modal */}
      {showReceiptModal && receiptConfig && (
        <div className="orderpanel-modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="orderpanel-modal-content orderpanel-receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderpanel-modal-header">
              <h3 className="orderpanel-modal-title">Order Receipt</h3>
              <button className="orderpanel-close-modal" onClick={() => setShowReceiptModal(false)}>×</button>
            </div>
            <div className="orderpanel-modal-body">
              <div className="orderpanel-receipt-print" id="orderpanel-print-section">
                <div className="orderpanel-receipt-header">
                  <div className="orderpanel-store-name">{receiptConfig.storeName}</div>
                  <div className="orderpanel-store-address">{receiptConfig.address1}</div>
                  <div className="orderpanel-store-address">{receiptConfig.address2}</div>
                  <div className="orderpanel-store-contact">TEL #: {receiptConfig.telephone}</div>
                </div>

                <div className="orderpanel-receipt-divider">----------------------------------------</div>

                <div className="orderpanel-receipt-info">
                  <div className="orderpanel-receipt-info-left">
                    <div>DATE: {dayjs(order.date).format("MM/DD/YYYY")}</div>
                    <div>TIME: {dayjs(order.date).format("hh:mm A")}</div>
                    <div>CASHIER: {cashierFullName || cashierName || 'STAFF'}</div>
                    <div>ORDER TYPE: {order.orderType?.toUpperCase() || order.order_type?.toUpperCase() || 'DINE IN'}</div>
                  </div>
                </div>

                <div className="orderpanel-receipt-divider">----------------------------------------</div>

                <div className="orderpanel-receipt-body">
                  {order.orderItems.map((item, i) => {
                    const itemTotal = item.price * item.quantity;
                    const addonsTotal = item.addons?.reduce((sum, addon) => sum + ((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)), 0) || 0;
                    const fullItemTotal = itemTotal + addonsTotal;
                    
                    // Separate discounts and promotions for clarity
                    const itemDiscounts = (item.itemDiscounts || []).map(d => ({ 
                      name: d.discountName, 
                      quantity: d.quantityDiscounted, 
                      amount: d.discountAmount,
                      type: 'discount'
                    }));
                    
                    const itemPromotions = (item.itemPromotions || []).map(p => ({ 
                      name: p.promotionName, 
                      quantity: p.quantityPromoted, 
                      amount: p.promotionAmount,
                      type: 'promotion'
                    }));
                    
                    // For online orders, check if promo info exists in different format
                    const hasOnlinePromo = item.promo_name || item.applied_promo;
                    
                    // Combine all reductions
                    const allReductions = [...itemDiscounts, ...itemPromotions];
                    
                    // If online order with promo but no itemPromotions, add it manually
                    if (!isStore && hasOnlinePromo && allReductions.length === 0 && item.discount > 0) {
                      allReductions.push({
                        name: item.promo_name || item.applied_promo?.promotionName || 'Promotion Applied',
                        quantity: 1,
                        amount: item.discount,
                        type: 'promotion'
                      });
                    }
                    
                    const totalReductions = allReductions.reduce((sum, r) => sum + r.amount, 0);
                    
                    return (
                      <div key={i} className="orderpanel-receipt-item">
                        <div className="orderpanel-receipt-line">
                          <span className="orderpanel-receipt-item-name">{item.name}</span>
                        </div>
                        <div className="orderpanel-receipt-line orderpanel-receipt-qty-price">
                          <span>{item.price.toFixed(2)} x {item.quantity}</span>
                          <span>{itemTotal.toFixed(2)}</span>
                        </div>
                        
                        {/* Addons */}
                        {item.addons?.length > 0 && item.addons.map((addon, idx) => (
                          <div key={idx} className="orderpanel-receipt-line orderpanel-receipt-qty-price">
                            <span>{addon.addon_name || addon.addonName || addon.name} {addon.price.toFixed(2)} x {(addon.quantity || 1) * (item.quantity || 1)}</span>
                            <span>{((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)).toFixed(2)}</span>
                          </div>
                        ))}
                        
                        {/* Show all reductions (discounts and promotions) */}
                        {allReductions.map((reduction, idx) => (
                        <div
                          key={`reduction-${idx}`}
                          className="orderpanel-receipt-line orderpanel-receipt-qty-price"
                        >
                          <span>
                            {reduction.name}
                            {reduction.quantity > 1 ? ` (x${reduction.quantity})` : ''}
                          </span>
                          <span>-{reduction.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      </div>
                    );
                  })}
                </div>

                <div className="orderpanel-receipt-divider">----------------------------------------</div>

                <div className="orderpanel-receipt-summary">
                  {(() => {
                    let totalNetAmt = 0;
                    order.orderItems.forEach(item => {
                      const itemTotal = item.price * item.quantity;
                      const addonsTotal = item.addons?.reduce((sum, addon) => sum + ((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)), 0) || 0;
                      const fullItemTotal = itemTotal + addonsTotal;
                      
                      const itemDiscounts = (item.itemDiscounts || []).map(d => ({ name: d.discountName, amount: d.discountAmount }));
                      const itemPromotions = (item.itemPromotions || []).map(p => ({ name: p.promotionName, amount: p.promotionAmount }));
                      
                      const totalItemDiscount = [...itemDiscounts, ...itemPromotions].reduce((sum, d) => sum + d.amount, 0);
                      const netAmt = fullItemTotal - totalItemDiscount;
                      totalNetAmt += netAmt;
                    });
                    
                    return (
                      <>
                        <div className="orderpanel-receipt-line" style={{ fontWeight: '600', margin: '4px 0' }}>
                          <span>NET AMOUNT</span>
                          <span>{totalNetAmt.toFixed(2)}</span>
                        </div>

                        {hasRefunds && (
                          <div className="orderpanel-receipt-line">
                            <span>REFUND:</span>
                            <span>-₱{getTotalRefundAmount().toFixed(2)}</span>
                          </div>
                        )}

                        <div className="orderpanel-receipt-divider">----------------------------------------</div>

                        <div className="orderpanel-receipt-line orderpanel-receipt-total">
                          <span>TOTAL</span>
                          <span>{(totalNetAmt - (hasRefunds ? getTotalRefundAmount() : 0)).toFixed(2)}</span>
                        </div>

                        <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '11px', fontWeight: 'bold' }}>
                          <div>NON-VAT</div>
                          <div>EXEMPT</div>
                        </div>

                        <div className="orderpanel-receipt-divider">----------------------------------------</div>

                        <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '10px', fontWeight: 'bold', lineHeight: '1.4' }}>
                          <div>THIS IS NOT AN OFFICIAL RECEIPT</div>
                        </div>

                        <div className="orderpanel-receipt-divider">----------------------------------------</div>

                        <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '11px', fontWeight: 'bold', lineHeight: '1.6' }}>
                          <div>THANK YOU FOR YOUR PURCHASE!</div>
                          <div>PLEASE COME AGAIN</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {/* Dual QR Code Section */}
                <div className="orderpanel-receipt-footer">
                  <div className="orderpanel-dual-qr-section">
                    {/* First QR Code - Feedback/OOS (only if enabled) */}
                    {receiptConfig.showQR && (
                      <div className="orderpanel-qr-item">
                        {receiptConfig.qrType === 'image' && receiptConfig.qrImagePath ? (
                          <img 
                            src={receiptConfig.qrImagePath} 
                            alt="QR Code" 
                            className="orderpanel-qr-code" 
                          />
                        ) : receiptConfig.qrType === 'link' && generatedQRCode ? (
                          <img 
                            src={generatedQRCode} 
                            alt="Feedback QR Code" 
                            className="orderpanel-qr-code" 
                          />
                        ) : (
                          <div className="orderpanel-qr-placeholder">QR CODE</div>
                        )}
                        <div className="orderpanel-qr-text">
                          {receiptConfig.qrText || 'SCAN FOR FEEDBACK'}
                        </div>
                      </div>
                    )}
                    
                    {/* Second QR Code - Blockchain Transaction (always shown) */}
                    <div className="orderpanel-qr-item">
                      {blockchainQRCode ? (
                        <img 
                          src={blockchainQRCode} 
                          alt="Blockchain Transaction QR Code" 
                          className="orderpanel-qr-code" 
                        />
                      ) : (
                        <div className="orderpanel-qr-placeholder">QR CODE</div>
                      )}
                      <div className="orderpanel-qr-text">
                        Verify Blockchain Transaction
                      </div>
                    </div>
                  </div>
                  
                  {receiptConfig.additionalText && (
                    <div className="orderpanel-additional-text">{receiptConfig.additionalText}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="orderpanel-modal-footer">
              <button className="orderpanel-modal-btn orderpanel-modal-cancel" onClick={() => setShowReceiptModal(false)}>
                Cancel
              </button>
              <button className="orderpanel-modal-btn orderpanel-modal-confirm" onClick={confirmPrintReceipt}>
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrderModals;