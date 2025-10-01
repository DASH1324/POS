import React, { useState } from "react";
import "./orderPanel.css";
import dayjs from 'dayjs';
import qr from '../../assets/qr.png';
import { toast } from 'react-toastify';

function OrderPanel({ order, onClose, isOpen, isStore, onUpdateStatus }) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!order) return null;

  const subtotal = order.subtotal || order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const addOnsCost = order.addOns || 0;
  const actualDiscount = order.discount || 0;
  
  const displayAddOns = Math.abs(addOnsCost);
  const displayDiscount = Math.abs(actualDiscount);

  // Get auth token from localStorage or context
  const getAuthToken = () => {
    return localStorage.getItem('authToken') || localStorage.getItem('token') || '';
  };

  const handleStoreCancel = () => {
    setEnteredPin("");
    setPinError("");
    setShowPinModal(true);
  };

  const handleStoreRefund = () => {
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
      // Use the existing onUpdateStatus function for cancellation
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
      // FIXED: Use the correct sales service URL
      const response = await fetch(`http://127.0.0.1:9000/auth/purchase_orders/${order.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          managerUsername: `manager_${enteredPin}`, // You might want to validate PIN against actual manager username
          refundReason: "Customer requested refund"
        })
      });

      if (response.ok) {
        const result = await response.json();
        setShowRefundModal(false);
        
        // Update the order status locally or refresh the order list
        if (onUpdateStatus) {
          await onUpdateStatus(order, "REFUNDED");
        }
        
        // Optional: Show success message
        toast.success("Order refunded successfully!");
      } else {
        // Handle both JSON and non-JSON error responses
        let errorMessage = "Failed to process refund";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (jsonError) {
          // If response is not JSON (like HTML error page), use status text
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

  // Renders the correct set of action buttons based on the order's state
  const renderActionButtons = () => {
    const status = order.status.toUpperCase();
    const type = order.orderType ? order.orderType.toLowerCase() : '';

    let mainAction = null;
    let cancelAction = null;
    let printAction = null;
    let refundAction = null;

    // --- Determine Main Progressive Action Button ---
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
    } else { // Online Order Workflow
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
            if (type === 'pick up') {
                mainAction = (
                    <button 
                        className="orderpanel-btn orderpanel-btn-complete" 
                        onClick={() => onUpdateStatus(order, "WAITING FOR PICK UP")}
                        disabled={isProcessing}
                    >
                        Ready for Pick Up
                    </button>
                );
            } else { // Delivery
                mainAction = (
                    <button 
                        className="orderpanel-btn orderpanel-btn-complete" 
                        onClick={() => onUpdateStatus(order, "DELIVERING")}
                        disabled={isProcessing}
                    >
                        Ready to Deliver
                    </button>
                );
            }
        } else if (status === 'WAITING FOR PICK UP') {
            mainAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-complete" 
                    onClick={() => onUpdateStatus(order, "COMPLETED")}
                    disabled={isProcessing}
                >
                    Pick Up
                </button>
            );
        } else if (status === 'DELIVERING') {
            mainAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-complete" 
                    onClick={() => onUpdateStatus(order, "COMPLETED")}
                    disabled={isProcessing}
                >
                    Delivered
                </button>
            );
        }
    }

    // --- Determine Cancel Button Visibility ---
    if (isStore) {
        if (status === 'PROCESSING') {
            cancelAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-refund" 
                    onClick={handleStoreCancel}
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
                    onClick={() => onUpdateStatus(order, "CANCELLED")}
                    disabled={isProcessing}
                >
                    Cancel Order
                </button>
            );
        }
    }

    // --- Determine Print and Refund Button Visibility for Store ---
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
        refundAction = (
             <button 
                 className="orderpanel-btn orderpanel-btn-refund" 
                 onClick={handleStoreRefund}
                 disabled={isProcessing}
             >
                 {isProcessing ? "Processing..." : "Refund Order"}
             </button>
        );
    }

    // Show refunded status but no actions
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
            <p className="orderpanel-info-item"><span className="orderpanel-label">Order ID:</span> #{order.id}</p>
            <p className="orderpanel-info-item"><span className="orderpanel-label">Order Type:</span> {order.orderType || (isStore ? "Store" : "Online")}</p>
            <p className="orderpanel-info-item"><span className="orderpanel-label">Date:</span> {dayjs(order.date).format("MMMM D, YYYY - h:mm A")}</p>
            <p className="orderpanel-info-item"><span className="orderpanel-label">Payment Method:</span> {order.paymentMethod}</p>
            <p className="orderpanel-info-item">
                <span className="orderpanel-label">Status:</span>
                <span className={`orderpanel-status-badge orderpanel-${order.status.toLowerCase().replace(/ /g, '')}`}>{order.status}</span>
            </p>
            {order.cashierName && (
                <p className="orderpanel-info-item"><span className="orderpanel-label">Cashier:</span> {order.cashierName}</p>
            )}
        </div>

        <div className="orderpanel-items-header">
          <span className="orderpanel-column-item">Item</span>
          <span className="orderpanel-column-qty">Qty</span>
          <span className="orderpanel-column-subtotal">Subtotal</span>
        </div>

        <div className="orderpanel-items-section">
          {order.orderItems.map((item, idx) => (
            <div key={idx} className="orderpanel-item">
              <div className="orderpanel-item-details">
                <div className="orderpanel-item-name">
                  {item.name}
                  {item.addons && item.addons.length > 0 && (
                    <div className="orderpanel-item-addons">
                      {item.addons.map((addon, addonIdx) => (
                        <div key={addonIdx} className="orderpanel-addon">
                          + {addon.quantity}x {addon.addonName || addon.name} (₱{addon.price.toFixed(2)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isStore && <div className="orderpanel-item-price">₱{item.price.toFixed(2)}</div>}
              </div>
              <div className="orderpanel-item-qty">{item.quantity}</div>
              <div className="orderpanel-item-subtotal">₱{(item.price * item.quantity).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="orderpanel-summary">
            <div className="orderpanel-promotions">
                <span className="orderpanel-promotions-label">Discounts and Promotions used:</span>
                <span className="orderpanel-promotions-value">
                    {displayDiscount > 0 ? 'Discount Applied' : 'None'}
                </span>
            </div>
            <div className="orderpanel-calculation">
                <div className="orderpanel-calc-row">
                    <span className="orderpanel-calc-label">Subtotal:</span>
                    <span className="orderpanel-calc-value">₱{subtotal.toFixed(2)}</span>
                </div>
                
                {displayAddOns > 0 && (
                    <div className="orderpanel-calc-row">
                        <span className="orderpanel-calc-label">Add-ons:</span>
                        <span className="orderpanel-calc-value">+ ₱{displayAddOns.toFixed(2)}</span>
                    </div>
                )}

                {displayDiscount > 0 && (
                    <div className="orderpanel-calc-row">
                        <span className="orderpanel-calc-label">Discount:</span>
                        <span className="orderpanel-calc-value">- ₱{displayDiscount.toFixed(2)}</span>
                    </div>
                )}

                <div className="orderpanel-calc-row orderpanel-total-row">
                    <span className="orderpanel-calc-label">Total:</span>
                    <span className="orderpanel-calc-value">₱{order.total.toFixed(2)}</span>
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
              
              {/* Header */}
              <div className="orderpanel-modal-header">
                <h3 className="orderpanel-modal-title">Manager PIN Required</h3>
                <button className="orderpanel-close-modal" onClick={() => setShowPinModal(false)}>×</button>
              </div>
              
              {/* Body / Content */}
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
              
              {/* Footer */}
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
              
              {/* Header */}
              <div className="orderpanel-modal-header">
                <h3 className="orderpanel-modal-title">Manager PIN Required</h3>
                <button className="orderpanel-close-modal" onClick={() => setShowRefundModal(false)}>×</button>
              </div>
              
              {/* Body */}
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
              
              {/* Footer */}
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

        {/* Receipt Print Modal */}
        {showReceiptModal && (
          <div className="orderpanel-modal-overlay" onClick={() => setShowReceiptModal(false)}>
            <div className="orderpanel-modal-content orderpanel-receipt-modal" onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="orderpanel-modal-header">
                <h3 className="orderpanel-modal-title">Order Receipt</h3>
                <button className="orderpanel-close-modal" onClick={() => setShowReceiptModal(false)}>×</button>
              </div>

              {/* Body */}
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
                              <span>  + {addon.addonName || addon.name}</span>
                            </div>
                            <div className="orderpanel-receipt-line orderpanel-receipt-addon orderpanel-receipt-qty-price">
                              <span>  {addon.quantity} x ₱{addon.price.toFixed(2)}</span>
                              <span>₱{(addon.price * addon.quantity).toFixed(2)}</span>
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
                    {displayAddOns > 0 && (
                      <div className="orderpanel-receipt-line">
                        <span>ADD-ONS:</span>
                        <span>₱{displayAddOns.toFixed(2)}</span>
                      </div>
                    )}
                    {displayDiscount > 0 && (
                      <div className="orderpanel-receipt-line">
                        <span>DISCOUNT:</span>
                        <span>-₱{displayDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="orderpanel-receipt-line orderpanel-receipt-total">
                      <strong>TOTAL:</strong>
                      <strong>₱{order.total.toFixed(2)}</strong>
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

              {/* Footer */}
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