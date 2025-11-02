import React, { useState, useEffect } from "react";
import "./orderPanel.css";
import dayjs from 'dayjs';
import qr from '../../assets/qr.png';
import { toast } from 'react-toastify';

const AUTH_API_BASE_URL = 'http://127.0.0.1:4000';
const SALES_API_BASE_URL = 'http://127.0.0.1:9000';

function OrderPanel({ order, onClose, isOpen, isStore, onUpdateStatus, onFullRefund, onPartialRefund }) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalType, setPinModalType] = useState('');
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefundAvailable, setIsRefundAvailable] = useState(true);
  const [showRefundExpiredModal, setShowRefundExpiredModal] = useState(false);
  const [refundInfo, setRefundInfo] = useState(null);
  
  // Refund mode states
  const [refundMode, setRefundMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});

  // Fetch refund information when order changes
  useEffect(() => {
    if (order && isStore && order.id) {
      fetchRefundInfo();
    }
  }, [order, isStore]);

  const fetchRefundInfo = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(
        `${SALES_API_BASE_URL}/auth/purchase_orders/${order.id}/refunds`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.refunds && data.refunds.length > 0) {
          setRefundInfo(data.refunds);
        }
      }
    } catch (error) {
      console.error("Error fetching refund info:", error);
    }
  };

  // Check if refund is still available
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

  const subtotal = order.subtotal || 0;
  const addOnsCost = order.addOns || 0;
  const promotionalDiscount = order.promotionalDiscount || 0;
  const manualDiscount = order.manualDiscount || 0;
  const appliedDiscountNames = order.appliedDiscounts || [];

  // Calculate total refund amount
  const getTotalRefundAmount = () => {
    if (!refundInfo || refundInfo.length === 0) return 0;
    return refundInfo.reduce((sum, refund) => sum + refund.total_amount, 0);
  };

  // Check if order has refunds
  const hasRefunds = refundInfo && refundInfo.length > 0;
  const isPartiallyRefunded = hasRefunds && order.status.toUpperCase() === 'COMPLETED';
  const isFullyRefunded = order.status.toUpperCase() === 'REFUNDED';

  const handleCancelOrder = () => {
    setPinModalType('cancel');
    setEnteredPin("");
    setPinError("");
    setShowPinModal(true);
  };

  const handleFullRefundClick = () => {
    if (!isRefundAvailable) {
      setShowRefundExpiredModal(true);
      return;
    }

    setPinModalType('refund');
    setEnteredPin("");
    setPinError("");
    setShowPinModal(true);
  };

  const handlePartialRefundClick = () => {
    if (!isRefundAvailable) {
      setShowRefundExpiredModal(true);
      return;
    }

    setRefundMode(true);
    setSelectedItems({});
  };

  const confirmPinAction = async () => {
    if (!enteredPin || enteredPin.length < 4) {
      setPinError("Please enter a valid PIN.");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      if (pinModalType === 'cancel') {
        await onUpdateStatus(order, "CANCELLED", { pin: enteredPin });
        setShowPinModal(false);
      } else if (pinModalType === 'refund') {
        await onFullRefund(order, enteredPin);
        setShowPinModal(false);
        onClose();
      } else if (pinModalType === 'partial-refund') {
        const itemsToRefund = order.orderItems
          .map((item, index) => {
            const refundQty = selectedItems[index] || 0;
            if (refundQty > 0) {
              return {
                saleItemId: item.saleItemId || item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                refundQuantity: refundQty
              };
            }
            return null;
          })
          .filter(item => item !== null);

        if (itemsToRefund.length === 0) {
          setPinError("Please select at least one item to refund.");
          setIsProcessing(false);
          return;
        }

        await onPartialRefund(order, itemsToRefund, enteredPin);
        setShowPinModal(false);
        setRefundMode(false);
        setSelectedItems({});
        onClose();
      }
    } catch (error) {
      setPinError(`Failed to process: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmPartialRefund = () => {
    const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);
    
    if (!hasSelectedItems) {
      toast.error("Please select at least one item to refund");
      return;
    }

    setPinModalType('partial-refund');
    setEnteredPin("");
    setPinError("");
    setShowPinModal(true);
  };

  const cancelRefundMode = () => {
    setRefundMode(false);
    setSelectedItems({});
  };

  const updateItemQuantity = (index, quantity) => {
    const item = order.orderItems[index];
    const validQty = Math.max(0, Math.min(quantity, item.quantity));
    setSelectedItems(prev => ({
      ...prev,
      [index]: validQty
    }));
  };

  const calculateRefundTotal = () => {
    let total = 0;
    order.orderItems.forEach((item, index) => {
      const qty = selectedItems[index] || 0;
      total += item.price * qty;
      
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(addon => {
          const addonCostPerUnit = (addon.price * (addon.quantity || 1)) / item.quantity;
          total += addonCostPerUnit * qty;
        });
      }
    });
    return total;
  };

  const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);

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
    let refundActions = null;

    if (isStore) {
        if (status === 'PROCESSING') {
            mainAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-complete" 
                    onClick={() => onUpdateStatus(order, "COMPLETED")}
                    disabled={isProcessing || refundMode}
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
                    disabled={isProcessing || refundMode}
                >
                    Accept Order
                </button>
            );
        } else if (status === 'PREPARING') {
            mainAction = (
                <button 
                    className="orderpanel-btn orderpanel-btn-complete" 
                    onClick={() => onUpdateStatus(order, "WAITING FOR PICK UP")}
                    disabled={isProcessing || refundMode}
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
                        disabled={isProcessing || refundMode}
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
                    disabled={isProcessing || refundMode}
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
                    disabled={isProcessing || refundMode}
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
                 disabled={isProcessing || refundMode}
             >
                 Print Receipt
             </button>
        );
        
        // Check if order has been refunded or partially refunded
        const isRefunded = hasRefunds || isPartiallyRefunded || isFullyRefunded;
        
        // Refund actions
        if (!refundMode) {
          refundActions = (
            <>
              <button 
                  className={`orderpanel-btn orderpanel-btn-refund ${(!isRefundAvailable || isRefunded) ? 'orderpanel-btn-disabled' : ''}`}
                  onClick={handleFullRefundClick}
                  disabled={isProcessing || !isRefundAvailable || isRefunded}
                  title={isRefunded ? "Order has already been refunded" : !isRefundAvailable ? "Refund window expired" : ""}
              >
                  Full Refund
              </button>
              <button 
                  className={`orderpanel-btn orderpanel-btn-partial-refund ${(!isRefundAvailable || isRefunded) ? 'orderpanel-btn-disabled' : ''}`}
                  onClick={handlePartialRefundClick}
                  disabled={isProcessing || !isRefundAvailable || isRefunded}
                  title={isRefunded ? "Order has already been refunded" : !isRefundAvailable ? "Refund window expired" : ""}
              >
                  Refund Item
              </button>
            </>
          );
        } else {
          refundActions = (
            <>
              <button 
                  className="orderpanel-btn orderpanel-btn-cancel-refund"
                  onClick={cancelRefundMode}
                  disabled={isProcessing}
              >
                  Cancel
              </button>
              <button 
                  className={`orderpanel-btn orderpanel-btn-refund ${!hasSelectedItems ? 'orderpanel-btn-disabled' : ''}`}
                  onClick={confirmPartialRefund}
                  disabled={isProcessing || !hasSelectedItems}
              >
                  Refund Selected Items
              </button>
            </>
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
            {refundActions}
            {cancelAction}
        </>
    );
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
                {isPartiallyRefunded && (
                  <span className="orderpanel-status-badge orderpanel-partiallyrefunded">Partially Refunded</span>
                )}
            </p>
            {refundMode && (
              <p className="orderpanel-refund-mode-indicator">
                ⚠️ Refund Mode: Select items to refund
              </p>
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
                          + {addon.addon_name || addon.addonName || addon.name} (₱{(addon.price || 0).toFixed(2)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isStore && <div className="orderpanel-item-price">₱{item.price.toFixed(2)}</div>}
              </div>
              
              {refundMode ? (
                <div className="orderpanel-qty-price">
                  <button 
                    onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) - 1)}
                    disabled={!selectedItems[idx] || selectedItems[idx] <= 0}
                  >
                    -
                  </button>
                  <span>{selectedItems[idx] || 0}</span>
                  <button 
                    onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) + 1)}
                    disabled={selectedItems[idx] >= item.quantity}
                  >
                    +
                  </button>
                  <span className="orderpanel-item-price">
                    ₱{(() => {
                      const basePrice = (item.price || 0) * (selectedItems[idx] || 0);
                      let addonPrice = 0;
                      if (item.addons && item.addons.length > 0) {
                        item.addons.forEach(addon => {
                          const addonCostPerUnit = ((addon.price || 0) * (addon.quantity || 1)) / item.quantity;
                          addonPrice += addonCostPerUnit * (selectedItems[idx] || 0);
                        });
                      }
                      return (basePrice + addonPrice).toFixed(2);
                    })()}
                  </span>
                </div>
              ) : (
                <>
                  <div className="orderpanel-item-qty">
                    {item.quantity}
                  </div>
                  <div className="orderpanel-item-subtotal">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Show refunded items if any */}
        {hasRefunds && (
          <div className="orderpanel-refunded-items-section">
            <div className="orderpanel-refunded-items-header">
              <span className="orderpanel-refunded-title">Refunded Items:</span>
            </div>
            {refundInfo.map((refund, refundIdx) => (
              <div key={refundIdx} className="orderpanel-refund-group">
                {refund.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="orderpanel-refunded-item">
                    <span className="orderpanel-refunded-item-name">
                      {item.quantity}x {item.item_name}
                    </span>
                    <span className="orderpanel-refunded-item-amount">
                      -₱{item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

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
                
                {/* Show refund amount */}
                {hasRefunds && (
                  <div className="orderpanel-calc-row orderpanel-refund-row">
                    <span className="orderpanel-calc-label">Refund:</span>
                    <span className="orderpanel-calc-value orderpanel-refund-amount">
                      -₱{getTotalRefundAmount().toFixed(2)}
                    </span>
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

                {refundMode && hasSelectedItems && (
                  <div className="orderpanel-calc-row orderpanel-refund-total-row">
                    <span className="orderpanel-calc-label">Refund Amount:</span>
                    <span className="orderpanel-calc-value orderpanel-refund-amount">
                      ₱{calculateRefundTotal().toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="orderpanel-calc-row orderpanel-total-row">
                    <span className="orderpanel-calc-label">Total:</span>
                    <span className="orderpanel-calc-value">
                      ₱{(order.total - getTotalRefundAmount()).toFixed(2)}
                    </span>
                </div>
            </div>
        </div>

        <div className="orderpanel-actions">
            {renderActionButtons()}
        </div>

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

                    {hasRefunds && (
                      <div className="orderpanel-receipt-line">
                        <span>REFUND:</span>
                        <span>-₱{getTotalRefundAmount().toFixed(2)}</span>
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
                    
                    <div className="orderpanel-receipt-line orderpanel-receipt-total">
                      <strong>TOTAL:</strong>
                      <strong>₱{(order.total - getTotalRefundAmount()).toFixed(2)}</strong>
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