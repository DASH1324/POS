import React from "react";
import dayjs from 'dayjs';
import qr from '../../assets/qr.png';
import "./orderPanel.css";

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
  getTotalRefundAmount
}) => {
  
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
                  <div className="orderpanel-store-tin">NON-VAT Reg TIN: XXX-XXX-XXX-XXX</div>
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
                      <div className="orderpanel-receipt-line ord
                      erpanel-receipt-qty-price">
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
                  {isStore && (
                    <>
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
                    </>
                  )}

                  {!isStore && (
                    <>
                      <div className="orderpanel-receipt-line">
                        <span>SUBTOTAL:</span>
                        <span>₱{onlineBaseSubtotal.toFixed(2)}</span>
                      </div>
                      {onlineAddOnsTotal > 0 && (
                        <div className="orderpanel-receipt-line">
                          <span>ADD-ONS:</span>
                          <span>₱{onlineAddOnsTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {hasRefunds && (
                    <div className="orderpanel-receipt-line">
                      <span>REFUND:</span>
                      <span>-₱{getTotalRefundAmount().toFixed(2)}</span>
                    </div>
                  )}

                  {promotionalDiscount > 0 && (
                    <div className="orderpanel-receipt-line">
                      <span>LESS: DISCOUNT</span>
                      <span>-₱{promotionalDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {manualDiscount > 0 && (
                    <div className="orderpanel-receipt-line">
                      <span>LESS: DISCOUNT</span>
                      <span>-₱{manualDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="orderpanel-receipt-divider">================================</div>
                  
                  <div className="orderpanel-receipt-line orderpanel-receipt-total">
                    <strong>TOTAL AMOUNT DUE:</strong>
                    <strong>₱{isStore 
                      ? (order.total - getTotalRefundAmount()).toFixed(2)
                      : (onlineBaseSubtotal + onlineAddOnsTotal).toFixed(2)
                    }</strong>
                  </div>
                  
                  <div className="orderpanel-receipt-divider">================================</div>
                  
                  <div className="orderpanel-receipt-vat-section">
                    <div className="orderpanel-receipt-line">
                      <span>VATable Sales:</span>
                      <span>₱0.00</span>
                    </div>
                    <div className="orderpanel-receipt-line">
                      <span>VAT Amount (12%):</span>
                      <span>₱0.00</span>
                    </div>
                    <div className="orderpanel-receipt-line">
                      <span>VAT-Exempt Sales:</span>
                      <span>₱{isStore 
                        ? (order.total - getTotalRefundAmount()).toFixed(2)
                        : (onlineBaseSubtotal + onlineAddOnsTotal).toFixed(2)
                      }</span>
                    </div>
                    <div className="orderpanel-receipt-line">
                      <span>Zero-Rated Sales:</span>
                      <span>₱0.00</span>
                    </div>
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
    </>
  );
};

export default OrderModals;