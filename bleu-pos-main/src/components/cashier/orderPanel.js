import React, { useState, useEffect } from "react";
import "./orderPanel.css";
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import OrderModals from './orderModals';

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
      if (!token) {
        setRefundInfo(null);
        return;
      }

      const response = await fetch(
        `${SALES_API_BASE_URL}/auth/purchase_orders/${order.id}/refunds`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRefundInfo(data.refunds && data.refunds.length > 0 ? data.refunds : null);
      } else {
        setRefundInfo(null);
      }
    } catch (error) {
      console.error("Error fetching refund info:", error);
      setRefundInfo(null);
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

  // Calculate subtotals for online orders
  const calculateOnlineSubtotals = () => {
    let baseSubtotal = 0;
    let addOnsTotal = 0;

    order.orderItems.forEach(item => {
      baseSubtotal += item.price * item.quantity;
      
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(addon => {
          addOnsTotal += (addon.price || addon.Price || 0);
        });
      }
    });

    return { baseSubtotal, addOnsTotal };
  };

  const { baseSubtotal: onlineBaseSubtotal, addOnsTotal: onlineAddOnsTotal } = 
    !isStore ? calculateOnlineSubtotals() : { baseSubtotal: 0, addOnsTotal: 0 };

  const subtotal = order.subtotal || 0;
  const addOnsCost = order.addOns || 0;
  const promotionalDiscount = order.promotionalDiscount || 0;
  const manualDiscount = order.manualDiscount || 0;
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
                refundQuantity: refundQty,
                addons: item.addons || []
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
          const addonCostPerUnit = ((addon.price || 0) * (addon.quantity || 1)) / item.quantity;
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
        
        const isRefunded = hasRefunds || isPartiallyRefunded || isFullyRefunded;
        const hasMultipleItems = order.orderItems && order.orderItems.length > 1;
        
        if (!refundMode) {
          refundActions = (
            <div className="orderpanel-refund-actions">
              <button 
                  className={`orderpanel-btn orderpanel-btn-refund ${(!isRefundAvailable || isRefunded) ? 'orderpanel-btn-disabled' : ''}`}
                  onClick={handleFullRefundClick}
                  disabled={isProcessing || !isRefundAvailable || isRefunded}
                  title={isRefunded ? "Order has already been refunded" : !isRefundAvailable ? "Refund window expired" : ""}
              >
                  Full Refund
              </button>
              {hasMultipleItems && (
                 <button 
                    className={`orderpanel-btn orderpanel-btn-refund orderpanel-btn-partial ${(!isRefundAvailable || isRefunded) ? 'orderpanel-btn-disabled' : ''}`}
                    onClick={handlePartialRefundClick}
                    disabled={isProcessing || !isRefundAvailable || isRefunded}
                    title={isRefunded ? "Order has already been refunded" : !isRefundAvailable ? "Refund window expired" : ""}
                >
                    Refund Item
                </button>
              )}
            </div>
          );
        } else {
          refundActions = (
            <div className="orderpanel-refund-actions">
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
                  Refund Items
              </button>
            </div>
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

  return (
    <div className={`orderpanel-container ${isOpen ? 'orderpanel-open' : ''}`}>
      <div className="orderpanel-header">
        <h2 className="orderpanel-title">Order Details</h2>
        <div className="orderpanel-header-right">
          <span className={`orderpanel-status-badge orderpanel-${order.status.toLowerCase().replace(/ /g, '')}`}>
            {order.status}
          </span>
        </div>
      </div>

      <div className="orderpanel-content">
        <div className="orderpanel-info">
            <p className="orderpanel-info-item">
              <span className="orderpanel-label">Order Type:</span> {order.orderType || (isStore ? "Store" : "Online")}
            </p>
            <p className="orderpanel-info-item">
              <span className="orderpanel-label">Date:</span> {dayjs(order.date).format("MMMM D, YYYY - h:mm A")}
            </p>
            <p className="orderpanel-info-item">
              <span className="orderpanel-label">Payment Method:</span> {order.paymentMethod}
            </p>
            {refundMode && (
              <div className="orderpanel-refund-mode-banner">
                <span className="orderpanel-refund-mode-indicator">
                  Select items to refund
                </span>
              </div>
            )}
        </div>

        {!refundMode && (
          <div className="orderpanel-items-header">
            <span className="orderpanel-column-item">Item</span>
            <span className="orderpanel-column-qty">Qty</span>
            <span className="orderpanel-column-subtotal">Subtotal</span>
          </div>
        )}

      <div className="orderpanel-items-section">
        {order.orderItems.map((item, idx) => {
          const itemDiscounts = (item.itemDiscounts || []).map(discount => ({
            name: discount.discountName,
            quantity: discount.quantityDiscounted,
            amount: discount.discountAmount
          }));

          return (
            <div key={idx} className="orderpanel-item">
              <div className="orderpanel-item-details">
                <div className="orderpanel-item-name">
                  {item.name}
                  {item.addons && item.addons.length > 0 && (
                    <div className="orderpanel-item-addons">
                      {item.addons.map((addon, addonIdx) => (
                        <div key={addonIdx} className="orderpanel-addon">
                          + {addon.addon_name || addon.addonName || addon.name}
                          {addon.quantity && addon.quantity > 1 && ` (x${addon.quantity})`}
                          - ₱{((addon.price || 0) * (addon.quantity || 1)).toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                  {itemDiscounts.length > 0 && (
                    <div className="orderpanel-item-discount-applied">
                      {itemDiscounts.map((discount, discIdx) => (
                        <div key={discIdx} className="orderpanel-discount-info">
                          {discount.quantity} {item.name} • {discount.name}: -₱{discount.amount.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* ✅ THIS IS THE FIX ✅ */}
                {isStore && !refundMode && itemDiscounts.length === 0 && (
                    <div className="orderpanel-item-price">₱{item.price.toFixed(2)}</div>
                )}
              </div>

              {refundMode ? (
                <div className="orderpanel-item-qty orderpanel-refund-qty-controls">
                  <button
                    onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) - 1)}
                    disabled={!selectedItems[idx] || selectedItems[idx] <= 0}
                    className="orderpanel-qty-btn orderpanel-qty-minus"
                  >
                    -
                  </button>
                  <span className="orderpanel-qty-display">{selectedItems[idx] || 0}</span>
                  <button
                    onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) + 1)}
                    disabled={selectedItems[idx] >= item.quantity}
                    className="orderpanel-qty-btn orderpanel-qty-plus"
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="orderpanel-item-qty">
                  {item.quantity}
                </div>
              )}
              <div className="orderpanel-item-subtotal">
                ₱{(() => {
                  const baseTotal = item.price * item.quantity;
                  let addonTotal = 0;
                  if (item.addons && item.addons.length > 0) {
                    item.addons.forEach(addon => {
                      addonTotal += (addon.price || 0) * (addon.quantity || 1);
                    });
                  }
                  const itemTotalDiscount = itemDiscounts.reduce((sum, d) => sum + d.amount, 0);
                  return (baseTotal + addonTotal - itemTotalDiscount).toFixed(2);
                })()}
              </div>
            </div>
          );
        })}
      </div>

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
            <div className="orderpanel-calculation">
                {isStore && (
                  <>
                    <div className="orderpanel-calc-row">
                        <span className="orderpanel-calc-label">Subtotal:</span>
                        <span className="orderpanel-calc-value">₱{subtotal.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {!isStore && (
                  <>
                    <div className="orderpanel-calc-row">
                        <span className="orderpanel-calc-label">Subtotal:</span>
                        <span className="orderpanel-calc-value">₱{onlineBaseSubtotal.toFixed(2)}</span>
                    </div>
                    
                    {onlineAddOnsTotal > 0 && (
                        <div className="orderpanel-calc-row">
                            <span className="orderpanel-calc-label">Add-ons:</span>
                            <span className="orderpanel-calc-value">+ ₱{onlineAddOnsTotal.toFixed(2)}</span>
                        </div>
                    )}
                  </>
                )}
                
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
                      ₱{isStore 
                        ? (order.total - getTotalRefundAmount()).toFixed(2)
                        : (onlineBaseSubtotal + onlineAddOnsTotal).toFixed(2)
                      }
                    </span>
                </div>
            </div>
        </div>

        <div className="orderpanel-actions">
            {renderActionButtons()}
        </div>

        <OrderModals
          showPinModal={showPinModal}
          setShowPinModal={setShowPinModal}
          pinModalType={pinModalType}
          enteredPin={enteredPin}
          setEnteredPin={setEnteredPin}
          pinError={pinError}
          setPinError={setPinError}
          isProcessing={isProcessing}
          confirmPinAction={confirmPinAction}
          calculateRefundTotal={calculateRefundTotal}
          showRefundExpiredModal={showRefundExpiredModal}
          setShowRefundExpiredModal={setShowRefundExpiredModal}
          showReceiptModal={showReceiptModal}
          setShowReceiptModal={setShowReceiptModal}
          confirmPrintReceipt={confirmPrintReceipt}
          order={order}
          isStore={isStore}
          subtotal={subtotal}
          addOnsCost={addOnsCost}
          promotionalDiscount={promotionalDiscount}
          manualDiscount={manualDiscount}
          onlineBaseSubtotal={onlineBaseSubtotal}
          onlineAddOnsTotal={onlineAddOnsTotal}
          hasRefunds={hasRefunds}
          getTotalRefundAmount={getTotalRefundAmount}
        />
      </div>
    </div>
  );
}

export default OrderPanel;