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
  
  const [refundMode, setRefundMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [refundedQuantities, setRefundedQuantities] = useState({});

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

  const hasRefunds = refundInfo && refundInfo.length > 0;

  useEffect(() => {
    const quantities = {};
    if (hasRefunds) {
      refundInfo.forEach(refund => {
        refund.items.forEach(refundedItem => {
          quantities[refundedItem.item_name] = (quantities[refundedItem.item_name] || 0) + refundedItem.quantity;
        });
      });
    }
    setRefundedQuantities(quantities);
  }, [refundInfo, hasRefunds]);

  if (!order) return null;

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
  
  const getItemFinancials = (item) => {
    const totalItemDiscount = (item.itemDiscounts || []).reduce((sum, d) => sum + d.discountAmount, 0);
    const totalItemPromo = (item.itemPromotions || []).reduce((sum, p) => sum + p.promotionAmount, 0);
    const qty = item.quantity || 1; 
    const discountPerUnit = qty > 0 ? totalItemDiscount / qty : 0;
    const promoPerUnit = qty > 0 ? totalItemPromo / qty : 0;
    return { discountPerUnit, promoPerUnit };
  };

  // For FULL refunds - return the actual total paid
  const getFullRefundAmount = () => {
    let total = subtotal;
    total -= (order.manualDiscount || 0);
    total -= (order.promotionalDiscount || 0);
    return Math.max(0, total);
  };

  // For PARTIAL refunds - calculate based on items refunded
  const getPartialRefundAmount = () => {
    if (!refundInfo) return 0;
    let totalNetRefunded = 0;
    const refundedQuantitiesMap = {};
    
    refundInfo.forEach(refund => {
      refund.items.forEach(refundedItem => {
        refundedQuantitiesMap[refundedItem.item_name] = 
          (refundedQuantitiesMap[refundedItem.item_name] || 0) + refundedItem.quantity;
      });
    });

    order.orderItems.forEach(item => {
      const refundedQty = refundedQuantitiesMap[item.name];
      if (refundedQty > 0) {
        let unitPriceWithAddons = item.price;
        if (item.addons && item.addons.length > 0) {
          item.addons.forEach(addon => {
            const addonTotalCost = (addon.price || 0) * (addon.quantity || 1);
            const addonCostPerParentUnit = item.quantity > 0 ? addonTotalCost / item.quantity : 0; 
            unitPriceWithAddons += addonCostPerParentUnit;
          });
        }
        const { discountPerUnit, promoPerUnit } = getItemFinancials(item);
        const netPricePerUnit = unitPriceWithAddons - discountPerUnit - promoPerUnit;
        totalNetRefunded += netPricePerUnit * refundedQty;
      }
    });
    
    return totalNetRefunded;
  };

  // Determine if this is a full refund
  const isFullRefund = hasRefunds && refundInfo && refundInfo.some(refund => {
    const totalRefundedQty = refund.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalOrderQty = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    return totalRefundedQty === totalOrderQty;
  });

  const netHistoricalRefund = isFullRefund ? getFullRefundAmount() : getPartialRefundAmount();

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

  const calculateRefundTotal = () => {
    let totalRefundMoney = 0;
    
    order.orderItems.forEach((item, index) => {
      const refundQty = selectedItems[index] || 0;
      if (refundQty > 0) {
        let unitPriceWithAddons = item.price;
        if (item.addons && item.addons.length > 0) {
          item.addons.forEach(addon => {
            const addonTotalCost = (addon.price || 0) * (addon.quantity || 1);
            const addonCostPerParentUnit = item.quantity > 0 ? addonTotalCost / item.quantity : 0; 
            unitPriceWithAddons += addonCostPerParentUnit;
          });
        }

        const { discountPerUnit, promoPerUnit } = getItemFinancials(item);
        const netPricePerUnit = unitPriceWithAddons - discountPerUnit - promoPerUnit;
        totalRefundMoney += netPricePerUnit * refundQty;
      }
    });

    return Math.max(0, totalRefundMoney);
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
    const alreadyRefunded = refundedQuantities[item.name] || 0;
    const maxAvailable = item.quantity - alreadyRefunded;
    
    const validQty = Math.max(0, Math.min(quantity, maxAvailable));
    setSelectedItems(prev => ({
      ...prev,
      [index]: validQty
    }));
  };

  const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);
  const handlePrintReceipt = () => setShowReceiptModal(true);
  const confirmPrintReceipt = () => {
    window.print(); 
    setShowReceiptModal(false);
  };

  const calculateRemovedFinancials = () => {
    let removedDiscount = 0;
    let removedPromo = 0;

    // Calculate removed financials from current refund selection (refund mode)
    if (refundMode) {
      order.orderItems.forEach((item, index) => {
        const refundQty = selectedItems[index] || 0;
        if (refundQty > 0) {
          const { discountPerUnit, promoPerUnit } = getItemFinancials(item);
          removedDiscount += discountPerUnit * refundQty;
          removedPromo += promoPerUnit * refundQty;
        }
      });
    }
    
    // Calculate removed financials from historical refunds
    if (hasRefunds) {
      const refundedQuantitiesMap = {};
      refundInfo.forEach(refund => {
        refund.items.forEach(refundedItem => {
          refundedQuantitiesMap[refundedItem.item_name] = 
            (refundedQuantitiesMap[refundedItem.item_name] || 0) + refundedItem.quantity;
        });
      });

      order.orderItems.forEach((item) => {
        const historicalRefundQty = refundedQuantitiesMap[item.name] || 0;
        if (historicalRefundQty > 0) {
          const { discountPerUnit, promoPerUnit } = getItemFinancials(item);
          removedDiscount += discountPerUnit * historicalRefundQty;
          removedPromo += promoPerUnit * historicalRefundQty;
        }
      });
    }

    return { removedDiscount, removedPromo };
  };

  const { removedDiscount, removedPromo } = calculateRemovedFinancials();
  const displayedManualDiscount = Math.max(0, (order.manualDiscount || 0) - removedDiscount);
  const displayedPromoDiscount = Math.max(0, (order.promotionalDiscount || 0) - removedPromo);

  const estimatedPendingRefund = refundMode ? calculateRefundTotal() : 0;

  const renderActionButtons = () => {
    const status = order.status.toUpperCase();
    const type = order.orderType ? order.orderType.toLowerCase().trim() : '';
    
    const totalItemQuantity = order.orderItems ? order.orderItems.reduce((sum, item) => sum + item.quantity, 0) : 0;
    
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
            mainAction = ( <button className="orderpanel-btn orderpanel-btn-complete" onClick={() => onUpdateStatus(order, "PREPARING")} disabled={isProcessing || refundMode}>Accept Order</button> );
        } else if (status === 'PREPARING') {
            mainAction = ( <button className="orderpanel-btn orderpanel-btn-complete" onClick={() => onUpdateStatus(order, "WAITING FOR PICK UP")} disabled={isProcessing || refundMode}>{type === 'delivery' ? 'Ready for Pick Up (Rider)' : 'Ready for Pick Up'}</button> );
        } else if (status === 'WAITING FOR PICK UP' && type !== 'delivery') {
            mainAction = ( <button className="orderpanel-btn orderpanel-btn-complete" onClick={() => onUpdateStatus(order, "COMPLETED")} disabled={isProcessing || refundMode}>Pick Up</button> );
        }
    }

    if (isStore && status === 'PROCESSING' || !isStore && status === 'PENDING') {
        cancelAction = ( <button className="orderpanel-btn orderpanel-btn-refund" onClick={handleCancelOrder} disabled={isProcessing || refundMode}>Cancel Order</button> );
    }

    if (isStore && status === 'COMPLETED') {
        printAction = ( <button className="orderpanel-btn orderpanel-btn-print" onClick={handlePrintReceipt} disabled={isProcessing || refundMode}>Print Receipt</button> );
        
        const isRefunded = hasRefunds || isPartiallyRefunded || isFullyRefunded;
        
        const canPartiallyRefund = totalItemQuantity > 1;
        
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
              {canPartiallyRefund && (
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
              <button className="orderpanel-btn orderpanel-btn-cancel-refund" onClick={cancelRefundMode} disabled={isProcessing}>Cancel</button>
              <button className={`orderpanel-btn orderpanel-btn-refund ${!hasSelectedItems ? 'orderpanel-btn-disabled' : ''}`} onClick={confirmPartialRefund} disabled={isProcessing || !hasSelectedItems}>Refund Items</button>
            </div>
          );
        }
    }

    if (status === 'REFUNDED') {
        return ( <div className="orderpanel-status-message"><span className="orderpanel-refunded-message">This order has been refunded</span></div> );
    }
   
    return ( <>{mainAction}{printAction}{refundActions}{cancelAction}</> );
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
            <p className="orderpanel-info-item"><span className="orderpanel-label">Date:</span> {dayjs(order.date).format("MMMM D, YYYY - h:mm A")}</p>
            <p className="orderpanel-info-item"><span className="orderpanel-label">Order Type:</span> {order.orderType || (isStore ? "Store" : "Online")}</p>
            <p className="orderpanel-info-item">
              <span className="orderpanel-label">Payment Method:</span> {order.paymentMethod}

              {(order.paymentMethod === 'GCash' || order.paymentMethod === 'E-Wallet') && order.reference_number && (
                <> - {order.reference_number}</>
              )}
            </p>
            {refundMode && (
              <div className="orderpanel-refund-mode-banner">
                <span className="orderpanel-refund-mode-indicator">Select items to refund</span>
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
        {(() => {
          const groupedItems = [];
          const processedIndices = new Set();
          const promotionGroups = new Map();
          
          console.log('🔍 ORDER PANEL - Grouping items:', order.orderItems.length);
          order.orderItems.forEach((item, idx) => {
            console.log(`  Item ${idx}: ${item.name}`);
            console.log(`    itemPromotions:`, item.itemPromotions);
            console.log(`    itemDiscounts:`, item.itemDiscounts);
          });
          
          order.orderItems.forEach((item, idx) => {
            if (processedIndices.has(idx)) return;
            
            const itemPromotions = (item.itemPromotions || []);
            const promotion = itemPromotions.length > 0 ? itemPromotions[0] : null;
            
            if (promotion && promotion.promotionName) {
              const promoName = promotion.promotionName;
              
              if (!promotionGroups.has(promoName)) {
                const bogoGroup = {
                  type: 'bogo',
                  promoName: promoName,
                  items: []
                };
                
                order.orderItems.forEach((otherItem, otherIdx) => {
                  if (processedIndices.has(otherIdx)) return;
                  
                  const otherPromotions = (otherItem.itemPromotions || []);
                  const hasSamePromo = otherPromotions.some(p => 
                    p.promotionName === promoName
                  );
                  
                  if (hasSamePromo) {
                    bogoGroup.items.push({ item: otherItem, index: otherIdx });
                    processedIndices.add(otherIdx);
                  }
                });
                
                promotionGroups.set(promoName, bogoGroup);
                groupedItems.push(bogoGroup);
              }
            } else if (!processedIndices.has(idx)) {
              groupedItems.push({
                type: 'regular',
                item: item,
                index: idx
              });
              processedIndices.add(idx);
            }
          });
          
          return groupedItems.map((group, groupIdx) => {
            if (group.type === 'bogo') {
              const totalPromoAmount = group.items.reduce((sum, { item }) => {
                const itemPromotions = (item.itemPromotions || []);
                return sum + itemPromotions.reduce((pSum, p) => pSum + p.promotionAmount, 0);
              }, 0);
              
              return (
                <div key={`bogo-group-${groupIdx}`} className="orderpanel-bogo-group">
                  <div className="orderpanel-bogo-items">
                    {group.items.map(({ item, index: idx }) => {
                      const itemDiscounts = (item.itemDiscounts || []).map(discount => ({ 
                        name: discount.discountName, 
                        quantity: discount.quantityDiscounted, 
                        amount: discount.discountAmount 
                      }));
                      const itemPromotions = (item.itemPromotions || []).map(promo => ({ 
                        name: promo.promotionName, 
                        quantity: promo.quantityPromoted, 
                        amount: promo.promotionAmount 
                      }));
                      const refundedCount = refundedQuantities[item.name] || 0;
                      
                      return (
                        <div key={idx} className="orderpanel-item orderpanel-bogo-item">
                          <div className="orderpanel-item-details">
                            <div className="orderpanel-item-name">
                              {item.name}
                              <span>
                                {item.addons && item.addons.length > 0 && (
                                  <div className="orderpanel-item-addons">
                                    {item.addons.map((addon, addonIdx) => (
                                      <div key={addonIdx} className="orderpanel-addon">
                                        + ₱{((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)).toFixed(2)} 
                                        : {addon.addon_name || addon.addonName || addon.name}
                                        {(addon.quantity || 1) > 0 && <> (x{(addon.quantity || 1) * (item.quantity || 1)})</>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {refundedCount > 0 && !refundMode && (
                                  <div className="orderpanel-item-refunded-info">{refundedCount} Refunded</div>
                                )}
                                {itemDiscounts.length > 0 && (
                                  <div className="orderpanel-item-promodis-applied">
                                    {(() => {
                                      const combinedDiscounts = {};
                                      itemDiscounts.forEach(discount => {
                                        if (!combinedDiscounts[discount.name]) {
                                          combinedDiscounts[discount.name] = { name: discount.name, totalQuantity: 0, totalAmount: 0 };
                                        }
                                        combinedDiscounts[discount.name].totalQuantity += discount.quantity;
                                        combinedDiscounts[discount.name].totalAmount += discount.amount;
                                      });
                                      return Object.values(combinedDiscounts).map((discount, discIdx) => (
                                        <div key={discIdx} className="orderpanel-discount-info">
                                          -₱{discount.totalAmount.toFixed(2)} : {discount.name} (x{discount.totalQuantity})
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                )}
                                {itemPromotions.length > 0 && (
                                  <div className="orderpanel-item-promodis-applied">
                                    {(() => {
                                      const combinedPromotions = {};
                                      itemPromotions.forEach(promo => {
                                        if (!combinedPromotions[promo.name]) {
                                          combinedPromotions[promo.name] = { name: promo.name, totalQuantity: 0, totalAmount: 0 };
                                        }
                                        combinedPromotions[promo.name].totalQuantity += promo.quantity;
                                        combinedPromotions[promo.name].totalAmount += promo.amount;
                                      });
                                      return Object.values(combinedPromotions).map((promo, promoIdx) => (
                                        <div key={promoIdx} className="orderpanel-discount-info">
                                          -₱{promo.totalAmount.toFixed(2)} : {promo.name} (x{promo.totalQuantity})
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                )}
                              </span>
                            </div>
                          </div>
                          {refundMode ? (
                            <div className="orderpanel-item-qty orderpanel-refund-qty-controls">
                              <button 
                                onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) - 1)} 
                                disabled={!selectedItems[idx] || selectedItems[idx] <= 0} 
                                className="orderpanel-qty-btn orderpanel-qty-minus"
                              >-</button>
                              <span className="orderpanel-qty-display">{selectedItems[idx] || 0}</span>
                              <button 
                                onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) + 1)} 
                                disabled={(selectedItems[idx] || 0) >= (item.quantity - refundedCount)} 
                                className="orderpanel-qty-btn orderpanel-qty-plus"
                              >+</button>
                            </div>
                          ) : (
                            <div className="orderpanel-item-qty">{item.quantity}</div>
                          )}
                          <div className="orderpanel-item-subtotal">
                            <span>
                              ₱{(() => {
                                const baseTotal = item.price * item.quantity;
                                let addonTotal = 0;
                                if (item.addons && item.addons.length > 0) {
                                  addonTotal = item.addons.reduce((sum, addon) => sum + (addon.price || 0) * (addon.quantity || 1), 0);
                                }
                                const itemTotalDiscount = itemDiscounts.reduce((sum, d) => sum + d.amount, 0);
                                const itemTotalPromotion = itemPromotions.reduce((sum, p) => sum + p.amount, 0);
                                return (baseTotal + addonTotal - itemTotalDiscount - itemTotalPromotion).toFixed(2);
                              })()}
                            </span>
                            {isStore && <span className="orderpanel-item-each-price">₱{item.price.toFixed(2)} each</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            } else {
              // Regular Item Display with promotion badge
              const item = group.item;
              const idx = group.index;
              const itemDiscounts = (item.itemDiscounts || []).map(discount => ({ 
                name: discount.discountName, 
                quantity: discount.quantityDiscounted, 
                amount: discount.discountAmount 
              }));
              const itemPromotions = (item.itemPromotions || []).map(promo => ({ 
                name: promo.promotionName, 
                quantity: promo.quantityPromoted, 
                amount: promo.promotionAmount 
              }));
              const refundedCount = refundedQuantities[item.name] || 0;
              
              // Show ALL promotions for individual items (they're already separated from BOGO groups)
              const regularPromotions = itemPromotions;
              
              return (
                <div key={idx} className="orderpanel-item">
                  <div className="orderpanel-item-details">
                    <div className="orderpanel-item-name">
                      {item.name}
                      <span>
                        {item.addons && item.addons.length > 0 && (
                          <div className="orderpanel-item-addons">
                            {item.addons.map((addon, addonIdx) => (
                              <div key={addonIdx} className="orderpanel-addon">
                                + ₱{((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)).toFixed(2)} 
                                : {addon.addon_name || addon.addonName || addon.name}
                                {(addon.quantity || 1) > 0 && <> (x{(addon.quantity || 1) * (item.quantity || 1)})</>}
                              </div>
                            ))}
                          </div>
                        )}
                        {refundedCount > 0 && !refundMode && (
                          <div className="orderpanel-item-refunded-info">{refundedCount} Refunded</div>
                        )}
                        {itemDiscounts.length > 0 && (
                          <div className="orderpanel-item-promodis-applied">
                            {(() => {
                              const combinedDiscounts = {};
                              itemDiscounts.forEach(discount => {
                                if (!combinedDiscounts[discount.name]) {
                                  combinedDiscounts[discount.name] = { name: discount.name, totalQuantity: 0, totalAmount: 0 };
                                }
                                combinedDiscounts[discount.name].totalQuantity += discount.quantity;
                                combinedDiscounts[discount.name].totalAmount += discount.amount;
                              });
                              return Object.values(combinedDiscounts).map((discount, discIdx) => (
                                <div key={discIdx} className="orderpanel-discount-info">
                                  -₱{discount.totalAmount.toFixed(2)} : {discount.name} (x{discount.totalQuantity})
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                        {regularPromotions.length > 0 && (
                          <div className="orderpanel-item-promodis-applied">
                            {(() => {
                              const combinedPromotions = {};
                              regularPromotions.forEach(promo => {
                                if (!combinedPromotions[promo.name]) {
                                  combinedPromotions[promo.name] = { name: promo.name, totalQuantity: 0, totalAmount: 0 };
                                }
                                combinedPromotions[promo.name].totalQuantity += promo.quantity;
                                combinedPromotions[promo.name].totalAmount += promo.amount;
                              });
                              return Object.values(combinedPromotions).map((promo, promoIdx) => (
                                <div key={promoIdx} className="orderpanel-discount-info">
                                  -₱{promo.totalAmount.toFixed(2)} : {promo.name} (x{promo.totalQuantity})
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </span>
                    </div>
                  </div>
                  {refundMode ? (
                    <div className="orderpanel-item-qty orderpanel-refund-qty-controls">
                      <button 
                        onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) - 1)} 
                        disabled={!selectedItems[idx] || selectedItems[idx] <= 0} 
                        className="orderpanel-qty-btn orderpanel-qty-minus"
                      >-</button>
                      <span className="orderpanel-qty-display">{selectedItems[idx] || 0}</span>
                      <button 
                        onClick={() => updateItemQuantity(idx, (selectedItems[idx] || 0) + 1)} 
                        disabled={(selectedItems[idx] || 0) >= (item.quantity - refundedCount)} 
                        className="orderpanel-qty-btn orderpanel-qty-plus"
                      >+</button>
                    </div>
                  ) : (
                    <div className="orderpanel-item-qty">{item.quantity}</div>
                  )}
                  <div className="orderpanel-item-subtotal">
                    <span>
                      ₱{(() => {
                        const baseTotal = item.price * item.quantity;
                        let addonTotal = 0;
                        if (item.addons && item.addons.length > 0) {
                          addonTotal = item.addons.reduce((sum, addon) => sum + (addon.price || 0) * (addon.quantity || 1), 0);
                        }
                        const itemTotalDiscount = itemDiscounts.reduce((sum, d) => sum + d.amount, 0);
                        const itemTotalPromotion = itemPromotions.reduce((sum, p) => sum + p.amount, 0);
                        return (baseTotal + addonTotal - itemTotalDiscount - itemTotalPromotion).toFixed(2);
                      })()}
                    </span>
                    {isStore && <span className="orderpanel-item-each-price">₱{item.price.toFixed(2)} each</span>}
                  </div>
                </div>
              );
            }
          });
        })()}
      </div>
      <div className="orderpanel-summary">
        <div className="orderpanel-calculation">
          <div className="orderpanel-calc-row">
            <span className="orderpanel-calc-label">Subtotal:</span>
            <span className="orderpanel-calc-value">₱{subtotal.toFixed(2)}</span>
          </div>
          
          {(hasRefunds || (refundMode && hasSelectedItems)) && ( 
            <div className="orderpanel-calc-row orderpanel-refund-row">
              <span className="orderpanel-calc-value orderpanel-refund-amount">
                {refundMode ? "Est. Refund Amount:" : "Refunded Amount:"}
              </span>
              <span className="orderpanel-calc-value orderpanel-refund-amount">
                -₱{refundMode ? estimatedPendingRefund.toFixed(2) : netHistoricalRefund.toFixed(2)}
              </span>
            </div> 
          )}
          
            {(() => {
            // Calculate total promotions from items
            let totalItemPromotions = 0;
            order.orderItems.forEach(item => {
              const itemPromotions = item.itemPromotions || [];
              totalItemPromotions += itemPromotions.reduce((sum, p) => sum + p.promotionAmount, 0);
              
              // For online orders, also check for promo in different format
              if (!isStore && item.discount > 0 && itemPromotions.length === 0) {
                totalItemPromotions += item.discount;
              }
            });
            
            const finalPromoDiscount = order.promotionalDiscount || totalItemPromotions;
            
            return finalPromoDiscount > 0 && (
              <div className="orderpanel-calc-row orderpanel-promo-row">
                <span className="orderpanel-calc-label">Promotion:</span>
                <span className="orderpanel-calc-value">
                  -₱{finalPromoDiscount.toFixed(2)}
                </span>
              </div>
            );
          })()}

          {isStore && (order.manualDiscount > 0) && (
            <div className="orderpanel-calc-row orderpanel-discount-row">
              <span className="orderpanel-calc-label">Discount:</span>
              <span className="orderpanel-calc-value">
                -₱{order.manualDiscount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="orderpanel-calc-row orderpanel-total-row" style={{
            borderTop: '1px solid #333',
            marginTop: '8px',
            paddingTop: '8px',
            fontWeight: 'bold',
            fontSize: '1.1em'
          }}>
            <span className="orderpanel-calc-label">Total:</span>
            <span className="orderpanel-calc-value">
              ₱{(() => {
                let total = subtotal;
                
                // Calculate total promotions
                let totalItemPromotions = 0;
                order.orderItems.forEach(item => {
                  const itemPromotions = item.itemPromotions || [];
                  totalItemPromotions += itemPromotions.reduce((sum, p) => sum + p.promotionAmount, 0);
                  
                  if (!isStore && item.discount > 0 && itemPromotions.length === 0) {
                    totalItemPromotions += item.discount;
                  }
                });
                
                const finalPromoDiscount = order.promotionalDiscount || totalItemPromotions;
                
                total -= (order.manualDiscount || 0);
                total -= finalPromoDiscount;
                
                if (hasRefunds) {
                  total -= netHistoricalRefund;
                }
                
                return Math.max(0, total).toFixed(2);
              })()}
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
          promotionalDiscount={displayedPromoDiscount}
          manualDiscount={displayedManualDiscount}
          onlineBaseSubtotal={onlineBaseSubtotal}
          onlineAddOnsTotal={onlineAddOnsTotal}
          hasRefunds={hasRefunds}
          getTotalRefundAmount={isFullRefund ? getFullRefundAmount : getPartialRefundAmount}
          cashierName={order.cashierName || localStorage.getItem('username') || 'Staff'} 
        />
      </div>
    </div>
  );
}

export default OrderPanel