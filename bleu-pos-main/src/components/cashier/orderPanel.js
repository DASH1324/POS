import React, { useState, useEffect } from "react";
import "./orderPanel.css";
import dayjs from 'dayjs';
import qr from '../../assets/qr.png';
import { toast } from 'react-toastify';

const AUTH_API_BASE_URL = 'http://127.0.0.1:4000';
const SALES_API_BASE_URL = 'http://127.0.0.1:9000';

function OrderPanel({ order, onClose, isOpen, isStore, onUpdateStatus }) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showRefundExpiredModal, setShowRefundExpiredModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefundAvailable, setIsRefundAvailable] = useState(true);
  const [refundData, setRefundData] = useState(null);
  const [loadingRefunds, setLoadingRefunds] = useState(false);

  // Fetch refund data when order changes
  useEffect(() => {
    const fetchRefundData = async () => {
      if (!order || !isStore || (order.status.toUpperCase() !== 'REFUNDED' && order.status.toUpperCase() !== 'COMPLETED')) {
        setRefundData(null);
        return;
      }

      setLoadingRefunds(true);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(
          `${SALES_API_BASE_URL}/auth/purchase_orders/${order.id}/refunds`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.refunds && data.refunds.length > 0) {
            setRefundData(data);
          } else {
            setRefundData(null);
          }
        }
      } catch (error) {
        console.error('Error fetching refund data:', error);
      } finally {
        setLoadingRefunds(false);
      }
    };

    fetchRefundData();
  }, [order, isStore]);

  // Check if refund is still available (within 30 minutes)
  useEffect(() => {
    if (!order || !isStore || order.status.toUpperCase() !== 'COMPLETED') {
      return;
    }

    const checkRefundAvailability = () => {
      const completionTime = dayjs(order.updatedAt || order.date);
      const now = dayjs();
      const minutesPassed = now.diff(completionTime, 'minute');
      
      if (minutesPassed >= 30) {
        setIsRefundAvailable(false);
      } else {
        setIsRefundAvailable(true);
      }
    };

    checkRefundAvailability();
    const interval = setInterval(checkRefundAvailability, 60000);

    return () => clearInterval(interval);
  }, [order, isStore]);

  if (!order) return null;

  // Helper function to get refunded quantity for an item
  const getRefundedQuantity = (itemName) => {
    if (!refundData) return 0;
    
    let totalRefunded = 0;
    refundData.refunds.forEach(refund => {
      refund.items.forEach(refundedItem => {
        if (refundedItem.item_name === itemName) {
          totalRefunded += refundedItem.quantity;
        }
      });
    });
    return totalRefunded;
  };

  // Calculate total refund amount
  const getTotalRefundAmount = () => {
    if (!refundData) return 0;
    return refundData.refunds.reduce((sum, refund) => sum + refund.total_amount, 0);
  };

  const subtotal = order.subtotal || 0;
  const addOnsCost = order.addOns || 0;
  const promotionalDiscount = order.promotionalDiscount || 0;
  const manualDiscount = order.manualDiscount || 0;
  const appliedDiscountNames = order.appliedDiscounts || [];
  const totalRefundAmount = getTotalRefundAmount();
  
  // Calculate net total after refunds
  const netTotal = order.total - totalRefundAmount;
  
  const getAuthToken = () => {
    const token = localStorage.getItem('authToken') || 
                  localStorage.getItem('token') || 
                  sessionStorage.getItem('authToken') ||
                  sessionStorage.getItem('token');
    return token || '';
  };

  const handleCancelOrder = () => {
    setEnteredPin("");
    setPinError("");
    setShowPinModal(true);
  };

  const handleStoreRefund = () => {
    if (!isRefundAvailable) {
      setShowRefundExpiredModal(true);
      return;
    }

    setEnteredPin("");
    setPinError("");
    setShowRefundModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!enteredPin || enteredPin.length < 4) {
      setPinError("Please enter a valid PIN.");
      return;
    }
    
    setIsProcessing(true);
    try {
      await onUpdateStatus(order, "CANCELLED", { pin: enteredPin });
      setShowPinModal(false);
    } catch (error) {
      setPinError("Failed to cancel order. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmRefundOrder = async () => {
    if (!enteredPin || enteredPin.length < 4) {
      setPinError("Please enter a valid PIN.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const token = getAuthToken();
      
      const pinResponse = await fetch(`${AUTH_API_BASE_URL}/users/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin: enteredPin })
      });

      if (!pinResponse.ok) {
        const pinError = await pinResponse.json();
        setPinError(pinError.detail || "Invalid Manager PIN.");
        setIsProcessing(false);
        return;
      }

      const pinData = await pinResponse.json();
      const managerUsername = pinData.managerUsername;

      const response = await fetch(`${SALES_API_BASE_URL}/auth/purchase_orders/${order.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          managerUsername: managerUsername,
          refundReason: "Customer requested refund"
        })
      });

      if (response.ok) {
        const result = await response.json();
        setShowRefundModal(false);
        
        if (onUpdateStatus) {
          await onUpdateStatus(order, "REFUNDED");
        }
        
        toast.success(`Order refunded successfully by ${managerUsername}!`);
      } else {
        let errorMessage = "Failed to process refund";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
          
          if (errorMessage.includes("30 minutes") || errorMessage.includes("expired")) {
            setShowRefundModal(false);
            setShowRefundExpiredModal(true);
            return;
          }
        } catch (jsonError) {
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        setPinError(errorMessage);
      }
    } catch (error) {
      console.error("Refund error:", error);
      setPinError("Failed to process refund. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => setShowReceiptModal(true);

  const confirmPrintReceipt = () => {
    window.print(); 
    setShowReceiptModal(false);
  };

  const renderActionButtons = () => {
    const status = order.status.toUpperCase();
    const type = order.orderType ? order.orderType.toLowerCase().trim() : '';

    let mainAction = null;
    let cancelAction = null;
    let printAction = null;
    let refundAction = null;

    if (isStore) {
        if (status === 'PROCESSING') {
            mainAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-complete" 
                    onClick={() => onUpdateStatus(order, "COMPLETED")}
                    disabled={isProcessing}
                >
                    Mark as Completed
                </button>
            );
        }
    } else {
        if (status === 'PENDING') {
            mainAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-complete" 
                    onClick={() => onUpdateStatus(order, "PREPARING")}
                    disabled={isProcessing}
                >
                    Accept Order
                </button>
            );
        } else if (status === 'PREPARING') {
            mainAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-complete" 
                    onClick={() => onUpdateStatus(order, "WAITING FOR PICK UP")}
                    disabled={isProcessing}
                >
                    {type === 'delivery' ? 'Ready for Pick Up (Rider)' : 'Ready for Pick Up'}
                </button>
            );
        } else if (status === 'WAITING FOR PICK UP') {
            if (type !== 'delivery') {
                mainAction = (
                    <button 
                        className="orderpanel-btn orderpanel-btn-complete" 
                        onClick={() => onUpdateStatus(order, "COMPLETED")}
                        disabled={isProcessing}
                    >
                        Pick Up
                    </button>
                );
            }
        }
    }

    if (isStore) {
        if (status === 'PROCESSING') {
            cancelAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-refund" 
                    onClick={handleCancelOrder}
                    disabled={isProcessing}
                >
                    Cancel Order
                </button>
            );
        }
    } else {
        if (status === 'PENDING') {
            cancelAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-refund" 
                    onClick={handleCancelOrder}
                    disabled={isProcessing}
                >
                    Cancel Order
                </button>
            );
        }
    }

    if (isStore && status === 'COMPLETED') {
        printAction = (
             <button 
                 className="orderpanel-btn orderpanel-btn-print" 
                 onClick={handlePrintReceipt}
                 disabled={isProcessing}
             >
                 Print Receipt
             </button>
        );
        
        // Only show refund button if no refunds have been processed yet
        if (!refundData || refundData.refunds.length === 0) {
          refundAction = (
               <button 
                   className={`orderpanel-btn orderpanel-btn-refund ${!isRefundAvailable ? 'orderpanel-btn-disabled' : ''}`}
                   onClick={handleStoreRefund}
                   disabled={isProcessing || !isRefundAvailable}
               >
                   {isProcessing ? "Processing..." : "Refund Order"}
               </button>
          );
        }
    }

    if (status === 'REFUNDED') {
        return (
            <div className="orderpanel-status-message">
                <span className="orderpanel-refunded-message">This order has been refunded</span>
            </div>
        );
    }
   
    return (
        <>
            {mainAction}
            {printAction}
            {refundAction}
            {cancelAction}
        </>
    );
  };

  return (
    <div className={`orderpanel-container ${isOpen ? 'orderpanel-open' : ''}`}>
      <div className="orderpanel-header">
        <h2 className="orderpanel-title">Order Details</h2>
        <button className="orderpanel-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="orderpanel-content">
        <div className="orderpanel-info">
            <p className="orderpanel-info-item"><span className="orderpanel-label">Order Type:</span> {order.orderType || (isStore ? "Store" : "Online")}</p>
            <p className="orderpanel-info-item"><span className="orderpanel-label">Date:</span> {dayjs(order.date).format("MMMM D, YYYY - h:mm A")}</p>
            <p className="orderpanel-info-item"><span className="orderpanel-label">Payment Method:</span> {order.paymentMethod}</p>
            <p className="orderpanel-info-item">
                <span className="orderpanel-label">Status:</span>
                <span className={`orderpanel-status-badge orderpanel-${order.status.toLowerCase().replace(/ /g, '')}`}>{order.status}</span>
            </p>
        </div>

        <div className="orderpanel-items-header">
          <span className="orderpanel-column-item">Item</span>
          <span className="orderpanel-column-qty">Qty</span>
          <span className="orderpanel-column-subtotal">Subtotal</span>
        </div>

        <div className="orderpanel-items-section">
          {order.orderItems.map((item, idx) => {
            const refundedQty = getRefundedQuantity(item.name);
            const isFullyRefunded = refundedQty >= item.quantity;
            
            return (
              <div key={idx} className="orderpanel-item">
                <div className="orderpanel-item-details">
                  <div className="orderpanel-item-name">
                    <span className={isFullyRefunded ? 'orderpanel-refunded-text' : ''}>
                      {item.name}
                    </span>
                    {refundedQty > 0 && (
                      <div className="orderpanel-refund-indicator">
                        Refunded: {refundedQty}
                      </div>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <div className="orderpanel-item-addons">
                        {item.addons.map((addon, addonIdx) => (
                          <div key={addonIdx} className={`orderpanel-addon ${isFullyRefunded ? 'orderpanel-refunded-text' : ''}`}>
                            + {addon.addon_name || addon.addonName || addon.name} (₱{(addon.price || 0).toFixed(2)})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {isStore && <div className="orderpanel-item-price">₱{item.price.toFixed(2)}</div>}
                </div>
                <div className={`orderpanel-item-qty ${isFullyRefunded ? 'orderpanel-refunded-text' : ''}`}>
                  {item.quantity}
                </div>
                <div className={`orderpanel-item-subtotal ${isFullyRefunded ? 'orderpanel-refunded-text' : ''}`}>
                  ₱{(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="orderpanel-summary">
            <div className="orderpanel-promotions">
                <span className="orderpanel-promotions-label">Discounts and Promotions used:</span>
                <span className="orderpanel-promotions-value">
                    {appliedDiscountNames.length > 0 ? appliedDiscountNames.join(', ') : 'None'}
                </span>
            </div>
            <div className="orderpanel-calculation">
                <div className="orderpanel-calc-row">
                    <span className="orderpanel-calc-label">Subtotal:</span>
                    <span className="orderpanel-calc-value">₱{subtotal.toFixed(2)}</span>
                </div>
                
                 {addOnsCost > 0 && (
                    <div className="orderpanel-calc-row">
                        <span className="orderpanel-calc-label">Add-ons:</span>
                        <span className="orderpanel-calc-value">+ ₱{addOnsCost.toFixed(2)}</span>
                    </div>
                )}
                
                {promotionalDiscount > 0 && (
                    <div className="orderpanel-calc-row">
                        <span className="orderpanel-calc-label">Promotional Discount:</span>
                        <span className="orderpanel-calc-value">- ₱{promotionalDiscount.toFixed(2)}</span>
                    </div>
                )}
                 {manualDiscount > 0 && (
                    <div className="orderpanel-calc-row">
                        <span className="orderpanel-calc-label">Discount:</span>
                        <span className="orderpanel-calc-value">- ₱{manualDiscount.toFixed(2)}</span>
                    </div>
                )}

                {/* Show refund line if there are refunds */}
                {totalRefundAmount > 0 && (
                    <div className="orderpanel-calc-row orderpanel-refund-row">
                        <span className="orderpanel-calc-label">Refund:</span>
                        <span className="orderpanel-calc-value orderpanel-refund-amount">
                          - ₱{totalRefundAmount.toFixed(2)}
                        </span>
                    </div>
                )}

                <div className="orderpanel-calc-row orderpanel-total-row">
                    <span className="orderpanel-calc-label">Total:</span>
                    <span className="orderpanel-calc-value">
                      ₱{totalRefundAmount > 0 ? netTotal.toFixed(2) : order.total.toFixed(2)}
                    </span>
                </div>
            </div>
        </div>

        <div className="orderpanel-actions">
            {renderActionButtons()}
        </div>

        {/* PIN Modal for Cancellation */}
        {showPinModal && (
          <div className="orderpanel-modal-overlay" onClick={() => setShowPinModal(false)}>
            <div className="orderpanel-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="orderpanel-modal-header">
                <h3 className="orderpanel-modal-title">Manager PIN Required</h3>
                <button className="orderpanel-close-modal" onClick={() => setShowPinModal(false)}>×</button>
              </div>
              <div className="orderpanel-modal-body">
                <p className="orderpanel-modal-description">
                  Please ask a manager to enter their PIN to cancel this order.
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
                    onClick={confirmCancelOrder}
                    disabled={isProcessing || enteredPin.length < 4}
                >
                    {isProcessing ? "Verifying..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIN Modal for Refund */}
        {showRefundModal && (
          <div className="orderpanel-modal-overlay" onClick={() => setShowRefundModal(false)}>
            <div className="orderpanel-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="orderpanel-modal-header">
                <h3 className="orderpanel-modal-title">Manager PIN Required</h3>
                <button className="orderpanel-close-modal" onClick={() => setShowRefundModal(false)}>×</button>
              </div>
              <div className="orderpanel-modal-body">
                <p className="orderpanel-modal-description">
                  Please ask a manager to enter their PIN to refund this order.
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="orderpanel-modal-input"
                  placeholder="Enter Manager PIN"
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
                    onClick={() => setShowRefundModal(false)}
                    disabled={isProcessing}
                >
                    Cancel
                </button>
                <button 
                    className="orderpanel-modal-btn orderpanel-modal-confirm" 
                    onClick={confirmRefundOrder}
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
                  This order was completed more than 30 minutes ago. Refunds are only available within 30 minutes of completion.
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
        {showReceiptModal && (
          <div className="orderpanel-modal-overlay" onClick={() => setShowReceiptModal(false)}>
            <div className="orderpanel-modal-content orderpanel-receipt-modal" onClick={(e) => e.stopPropagation()}>
              <div className="orderpanel-modal-header">
                <h3 className="orderpanel-modal-title">Order Receipt</h3>
                <button className="orderpanel-close-modal" onClick={() => setShowReceiptModal(false)}>×</button>
              </div>
              <div className="orderpanel-modal-body">
                <div className="orderpanel-receipt-print" id="orderpanel-print-section">
                  <div className="orderpanel-receipt-header">
                    <div className="orderpanel-store-name">BLEU BEAN CAFE</div>
                    <div className="orderpanel-store-address">Don Fabian St., Commonwealth</div>
                    <div className="orderpanel-store-address">Quezon City, Philippines</div>
                    <div className="orderpanel-store-contact">Phone: +63 961 687 2463</div>
                    <div className="orderpanel-receipt-divider">================================</div>
                    <div className="orderpanel-receipt-info">
                      <div className="orderpanel-receipt-info-left">
                        <div>Order #: {order.id}</div>
                        <div>Cashier: {order.cashierName || 'Staff'}</div>
                      </div>
                      <div className="orderpanel-receipt-info-right">
                        <div>Date: {dayjs(order.date).format("MM/DD/YYYY")}</div>
                        <div>Time: {dayjs(order.date).format("hh:mm A")}</div>
                      </div>
                    </div>
                    <div className="orderpanel-receipt-divider">================================</div>
                  </div>

                  <div className="orderpanel-receipt-body">
                    {order.orderItems.map((item, i) => (
                      <div key={i} className="orderpanel-receipt-item">
                        <div className="orderpanel-receipt-line">
                          <span className="orderpanel-receipt-item-name">
                            {item.name}
                          </span>
                        </div>
                        <div className="orderpanel-receipt-line orderpanel-receipt-qty-price">
                          <span>{item.quantity} x ₱{item.price.toFixed(2)}</span>
                          <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        {item.addons && item.addons.length > 0 && item.addons.map((addon, addonIdx) => (
                        <div key={addonIdx}>
                          <div className="orderpanel-receipt-line orderpanel-receipt-addon">
                            <span>  + {addon.addon_name || addon.addonName || addon.name}</span>
                          </div>
                          <div className="orderpanel-receipt-line orderpanel-receipt-addon orderpanel-receipt-qty-price">
                            <span>  ₱{(addon.price || 0).toFixed(2)}</span>
                            <span>₱{(addon.price || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                      </div>
                    ))}
                  </div>

                  <div className="orderpanel-receipt-divider">================================</div>

                  <div className="orderpanel-receipt-summary">
                    <div className="orderpanel-receipt-line">
                      <span>SUBTOTAL:</span>
                      <span>₱{subtotal.toFixed(2)}</span>
                    </div>
                     {addOnsCost > 0 && (
                      <div className="orderpanel-receipt-line">
                        <span>ADD-ONS:</span>
                        <span>₱{addOnsCost.toFixed(2)}</span>
                      </div>
                    )}

                    {promotionalDiscount > 0 && (
                      <div className="orderpanel-receipt-line">
                        <span>PROMO DISCOUNT:</span>
                        <span>-₱{promotionalDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    {manualDiscount > 0 && (
                      <div className="orderpanel-receipt-line">
                        <span>DISCOUNT:</span>
                        <span>-₱{manualDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {totalRefundAmount > 0 && (
                      <div className="orderpanel-receipt-line">
                        <span>REFUND:</span>
                        <span>-₱{totalRefundAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="orderpanel-receipt-line orderpanel-receipt-total">
                      <strong>TOTAL:</strong>
                      <strong>₱{totalRefundAmount > 0 ? netTotal.toFixed(2) : order.total.toFixed(2)}</strong>
                    </div>
                    <div className="orderpanel-receipt-divider">================================</div>
                  </div>

                  <div className="orderpanel-receipt-footer">
                    <div className="orderpanel-thankyou">THANK YOU FOR YOUR PURCHASE!</div>
                    <div className="orderpanel-thankyou">PLEASE COME AGAIN</div>
                    <div className="orderpanel-receipt-divider">================================</div>
                    <div className="orderpanel-qr-section">
                      <img src={qr} alt="QR Code" className="orderpanel-qr-code" />
                      <div className="orderpanel-qr-text">Scan to learn more about us!</div>
                      <div className="orderpanel-qr-subtext">Follow us for updates & promos</div>
                    </div>
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
      </div>
    </div>
  );
}

export default OrderPanel;