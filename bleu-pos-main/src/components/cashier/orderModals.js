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
                  <div className="orderpanel-store-tin">VATREGTIN: XXX-XXX-XXX-XXX</div>
                  <div className="orderpanel-store-address">Don Fabian St., Commonwealth</div>
                  <div className="orderpanel-store-address">Quezon City, Philippines</div>
                  <div className="orderpanel-store-contact">TEL #: NULL</div>
                  <div className="orderpanel-receipt-divider">{dayjs(order.date).format("MM/DD/YYYY")} {dayjs(order.date).format("hh:mm A")}</div>
                  <div className="orderpanel-receipt-info">
                    <div className="orderpanel-receipt-info-left">
                      <div>INVOICE: #{order.id}</div>
                      <div>STAFF: {order.cashierName || 'Staff'}</div>
                    </div>
                  </div>    
                </div>

                <div className="orderpanel-receipt-body">
                  {(() => {
                    let totalNetAmt = 0;
                    let totalScPwdDisc = 0;
                    
                    return order.orderItems.map((item, i) => {
                      const itemTotal = item.price * item.quantity;
                      const addonsTotal = item.addons?.reduce((sum, addon) => sum + ((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)), 0) || 0;
                      const fullItemTotal = itemTotal + addonsTotal;
                      
                      // Per-item discounts and promotions
                      const itemDiscounts = (item.itemDiscounts || []).map(d => ({ name: d.discountName, quantity: d.quantityDiscounted, amount: d.discountAmount }));
                      const itemPromotions = (item.itemPromotions || []).map(p => ({ name: p.promotionName, quantity: p.quantityPromoted, amount: p.promotionAmount }));
                      
                      // Combine discounts, separating SC/PWD
                      const combinedDiscounts = {};
                      const scPwdDiscounts = [];
                      [...itemDiscounts, ...itemPromotions].forEach(d => {
                        if (d.name === 'PWD' || d.name === 'Senior') {
                          scPwdDiscounts.push(d);
                          totalScPwdDisc += d.amount;
                        } else {
                          if (!combinedDiscounts[d.name]) combinedDiscounts[d.name] = { name: d.name, totalQuantity: 0, totalAmount: 0 };
                          combinedDiscounts[d.name].totalQuantity += d.quantity;
                          combinedDiscounts[d.name].totalAmount += d.amount;
                        }
                      });
                      
                      const totalItemDiscount = Object.values(combinedDiscounts).reduce((sum, d) => sum + d.totalAmount, 0) + scPwdDiscounts.reduce((sum, d) => sum + d.amount, 0);
                      const netAmt = fullItemTotal - totalItemDiscount;
                      totalNetAmt += netAmt;
                      
                      return (
                        <div key={i} className="orderpanel-receipt-item">
                          <div className="orderpanel-receipt-line">
                            <span className="orderpanel-receipt-item-name">{item.name}</span>
                          </div>
                          <div className="orderpanel-receipt-line orderpanel-receipt-qty-price">
                            <span>{item.price.toFixed(2)} x {item.quantity}</span>
                            <span>{itemTotal.toFixed(2)}</span>
                          </div>
                          {item.addons?.length > 0 && item.addons.map((addon, idx) => (
                            <div key={idx} className="orderpanel-receipt-line orderpanel-receipt-qty-price">
                              <span>{addon.addon_name || addon.addonName || addon.name} {addon.price.toFixed(2)} x {(addon.quantity || 1) * (item.quantity || 1)}</span>
                              <span>{((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)).toFixed(2)}</span>
                            </div>
                          ))}
                          {/* Show non-SC/PWD discounts above NET AMT, with qty only if >1 */}
                          {Object.values(combinedDiscounts).map((discount, discIdx) => (
                            <div key={discIdx} className="orderpanel-receipt-line orderpanel-receipt-qty-price">
                              <span>{discount.name}{discount.totalQuantity > 1 ? ` (x${discount.totalQuantity})` : ''}</span>
                              <span>-{discount.totalAmount.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="orderpanel-receipt-line orderpanel-receipt-net-amt">
                            <span>NET AMT:</span>
                            <span>{netAmt.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="orderpanel-receipt-divider">------------------------------------------</div>

                <div className="orderpanel-receipt-summary">
                  {(() => {
                    // Recalculate totals here for summary (since we can't access from map)
                    let totalNetAmt = 0;
                    let totalScPwdDisc = 0;
                    order.orderItems.forEach(item => {
                      const itemTotal = item.price * item.quantity;
                      const addonsTotal = item.addons?.reduce((sum, addon) => sum + ((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)), 0) || 0;
                      const fullItemTotal = itemTotal + addonsTotal;
                      
                      const itemDiscounts = (item.itemDiscounts || []).map(d => ({ name: d.discountName, amount: d.discountAmount }));
                      const itemPromotions = (item.itemPromotions || []).map(p => ({ name: p.promotionName, amount: p.promotionAmount }));
                      
                      const totalItemDiscount = [...itemDiscounts, ...itemPromotions].reduce((sum, d) => {
                        if (d.name === 'PWD' || d.name === 'Senior Citizen') {
                          totalScPwdDisc += d.amount;
                        }
                        return sum + d.amount;
                      }, 0);
                      
                      const netAmt = fullItemTotal - totalItemDiscount;
                      totalNetAmt += netAmt;
                    });
                    
                    return (
                      <>
                        <div className="orderpanel-receipt-line orderpanel-receipt-total">
                          <span>TOTAL:</span>
                          <span>{totalNetAmt.toFixed(2)}</span>
                        </div>

                        {hasRefunds && (
                          <div className="orderpanel-receipt-line">
                            <span>REFUND:</span>
                            <span>-₱{getTotalRefundAmount().toFixed(2)}</span>
                          </div>
                        )}            

                        <div className="orderpanel-receipt-qty-price">
                          <div className="orderpanel-receipt-line">
                            <span>Vatable:</span>
                            <span>0.00</span>
                          </div>
                          <div className="orderpanel-receipt-line">
                            <span>VAT_Amt:</span>
                            <span>0.00</span>
                          </div>
                          <div className="orderpanel-receipt-line">
                            <span>Zero-Rated Sales:</span>
                            <span>0.00</span>
                          </div>
                          <div className="orderpanel-receipt-line">
                            <span>VAT Exempt Sales:</span>
                            <span>{(totalNetAmt - getTotalRefundAmount()).toFixed(2)}</span>
                          </div>
                          {totalScPwdDisc > 0 && (
                            <div className="orderpanel-receipt-line">
                              <span>TOTAL SC/PWD DISC:</span>
                              <span>{totalScPwdDisc.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="orderpanel-receipt-divider">------------------------------------------</div>
                <div className="orderpanel-receipt-footer">
                  <div className="orderpanel-qr-section">
                    <img src={qr} alt="QR Code" className="orderpanel-qr-code" />
                    <div className="orderpanel-qr-text">Scan to learn more about us!</div>
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