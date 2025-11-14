import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faMoneyBills, faQrcode, faPercent } from '@fortawesome/free-solid-svg-icons';
import { FiMinus, FiPlus } from "react-icons/fi";
import './cartPanel.css';
import { 
  AddonsModal, 
  DiscountsModal, 
  TransactionSummaryModal, 
  GCashReferenceModal,
  OrderConfirmationModal,
  ItemDiscountModal
} from './cartModals';

const SALES_API_URL = 'http://127.0.0.1:9000';
const DISCOUNTS_API_URL = 'http://127.0.0.1:9002';
const PRODUCTS_API_URL = 'http://127.0.0.1:8001';

const CartPanel = ({
  cartItems,
  setCartItems,
  isCartOpen,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  getDynamicMaxQuantity,
  promotions = []
}) => {
  // Component states
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [addons, setAddons] = useState([]);
  const [availableAddons, setAvailableAddons] = useState([]);
  const [isAddonsLoading, setIsAddonsLoading] = useState(false);

  const [showDiscountsModal, setShowDiscountsModal] = useState(false);
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  const [stagedDiscounts, setStagedDiscounts] = useState([]);
  const [showTransactionSummary, setShowTransactionSummary] = useState(false);
  const [showGCashReference, setShowGCashReference] = useState(false);
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Item-level discount states
  const [showItemDiscountModal, setShowItemDiscountModal] = useState(false);
  const [itemDiscounts, setItemDiscounts] = useState([]);
  const [stagedItemDiscounts, setStagedItemDiscounts] = useState([]);

  // --- STATE FOR AUTOMATIC PROMOTIONS ---
  const [autoPromotion, setAutoPromotion] = useState(null);

  // Recalculate max quantities whenever cart changes
  useEffect(() => {
    const updateMaxQuantities = async () => {
      if (cartItems.length === 0) return;
      
      const updatedCart = await Promise.all(
        cartItems.map(async (item) => {
          if (item.type !== 'product') return item;
          
          const maxQtyInfo = await getDynamicMaxQuantity(item.name, item.category, item.id);
          return {
            ...item,
            maxQuantity: maxQtyInfo ? maxQtyInfo.maxQuantity : 999,
            limitedBy: maxQtyInfo?.limitedBy
          };
        })
      );
      
      setCartItems(updatedCart);
    };
    
    updateMaxQuantities();
  }, [cartItems.length, cartItems.map(i => i.quantity).join(',')]);

  // Fetch manual discounts from the discounts service
  useEffect(() => {
    const fetchDiscounts = async () => {
      if (!isCartOpen) return;
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError("Authentication error. Please log in to view discounts.");
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(`${DISCOUNTS_API_URL}/api/discounts/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch discounts. Please log in again.');
        }
        const data = await response.json();
        const mappedAndFilteredDiscounts = data
          .filter(d => d.status === 'active')
          .map(d => ({
            id: d.name, 
            name: d.name,
            type: d.type === 'fixed_amount' ? 'fixed' : d.type,
            value: parseFloat(d.discount.replace(/[^0-9.]/g, '')),
            minAmount: d.minSpend || 0,
            applicationType: d.application_type,
            applicableProducts: d.applicable_products,
            applicableCategories: d.applicable_categories,
          }));
        setAvailableDiscounts(mappedAndFilteredDiscounts);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDiscounts();
  }, [isCartOpen]);

  // --- AUTOMATIC PROMOTION CALCULATION (CORRECTED) ---
  useEffect(() => {
    const calculateBestPromotion = () => {
      let bestPromo = null;
      let maxDiscount = 0;

      if (!cartItems.length || !promotions.length) {
        setAutoPromotion(null);
        return;
      }

      const parsedPromotions = promotions
        .filter(p => {
          if (!p || typeof p !== 'object') return false;
          if (!p.products || !p.value) return false;
          if (!p.type && !p.promotion_type) return false;
          return true;
        })
        .map(p => {
          const promo = { ...p, original: p };
          const promotionType = p.type || p.promotion_type;
          
          if (promotionType === 'bogo') {
            promo.promotionType = 'bogo';
            promo.buyQuantity = p.buyQuantity || p.buy_quantity || 1;
            promo.getQuantity = p.getQuantity || p.get_quantity || 1;
            
            const valueMatch = p.value.match(/(\d+\.?\d*)/);
            if (valueMatch) {
              promo.discountValue = parseFloat(valueMatch[0]);
              promo.bogoDiscountType = p.value.includes('%') ? 'percentage' : 'fixed_amount';
            }
            
            promo.selectedProducts = typeof p.products === 'string' 
              ? p.products.split(',').map(name => name.trim()).filter(Boolean)
              : (Array.isArray(p.products) ? p.products : []);
              
          } else if (promotionType === 'percentage') {
            promo.promotionType = 'percentage';
            promo.promotionValue = parseFloat(p.value.replace('%', ''));
            
            promo.selectedProducts = typeof p.products === 'string'
              ? p.products.split(',').map(name => name.trim()).filter(Boolean)
              : (Array.isArray(p.products) ? p.products : []);
              
          } else if (promotionType === 'fixed') {
            promo.promotionType = 'fixed';
            promo.promotionValue = parseFloat(p.value.replace('₱', ''));
            
            promo.selectedProducts = typeof p.products === 'string'
              ? p.products.split(',').map(name => name.trim()).filter(Boolean)
              : (Array.isArray(p.products) ? p.products : []);
          }
          
          promo.applicationType = p.application_type || 'specific_products';
          return promo;
        });

      for (const promo of parsedPromotions) {
        let currentDiscount = 0;
        
        if (!Array.isArray(promo.selectedProducts)) {
          console.warn('Invalid selectedProducts for promo:', promo.name);
          continue;
        }
        
        const eligibleItems = cartItems.filter(item => {
          if (item.type !== 'product') return false;
          if (promo.applicationType === 'all_products') return true;
          if (promo.applicationType === 'specific_categories' && promo.selectedProducts.includes(item.category)) return true;
          if (promo.applicationType === 'specific_products' && promo.selectedProducts.includes(item.name)) return true;
          return false;
        });

        if (!eligibleItems.length) continue;

        if (promo.promotionType === 'percentage' || promo.promotionType === 'fixed') {
          const itemToDiscount = eligibleItems.sort((a, b) => b.price - a.price)[0];
          if (promo.promotionType === 'percentage') {
            currentDiscount = parseFloat(itemToDiscount.price) * (parseFloat(promo.promotionValue) / 100);
          } else {
            currentDiscount = Math.min(parseFloat(itemToDiscount.price), parseFloat(promo.promotionValue));
          }
        } else if (promo.promotionType === 'bogo') {
          const buyItemName = promo.selectedProducts[0];
          const getItemName = promo.selectedProducts.length > 1 ? promo.selectedProducts[1] : buyItemName;

          if (buyItemName === getItemName) {
            const itemInCart = cartItems.find(item => item.name === buyItemName);
            if (!itemInCart || !promo.buyQuantity || !promo.getQuantity) continue;
            
            const bundleSize = promo.buyQuantity + promo.getQuantity;
            const numBundles = Math.floor(itemInCart.quantity / bundleSize);
            const itemsToDiscountCount = numBundles * promo.getQuantity;
            
            if (itemsToDiscountCount > 0) {
              const itemPrice = itemInCart.price;
              if (promo.bogoDiscountType === 'percentage') {
                currentDiscount = itemsToDiscountCount * (itemPrice * (promo.discountValue / 100));
              } else {
                const discountPerItem = Math.min(itemPrice, promo.discountValue);
                currentDiscount = itemsToDiscountCount * discountPerItem;
              }
            }
          } else {
            const buyItemsInCart = cartItems.find(item => item.name === buyItemName);
            const getItemsInCart = cartItems.find(item => item.name === getItemName);
            
            if (!buyItemsInCart || !getItemsInCart || !promo.buyQuantity) continue;
            
            const bogoSets = Math.floor(buyItemsInCart.quantity / promo.buyQuantity);
            const eligibleGetItems = bogoSets * promo.getQuantity;
            const itemsToDiscountCount = Math.min(getItemsInCart.quantity, eligibleGetItems);
            
            if (itemsToDiscountCount > 0) {
              const getItemPrice = getItemsInCart.price;
              if (promo.bogoDiscountType === 'percentage') {
                currentDiscount = itemsToDiscountCount * (getItemPrice * (promo.discountValue / 100));
              } else {
                const discountPerItem = Math.min(getItemPrice, promo.discountValue);
                currentDiscount = itemsToDiscountCount * discountPerItem;
              }
            }
          }
        }

        if (currentDiscount > maxDiscount) {
          maxDiscount = currentDiscount;
          bestPromo = { ...promo.original, discountAmount: maxDiscount };
        }
      }
      
      setAutoPromotion(bestPromo);
    };

    calculateBestPromotion();
  }, [cartItems, promotions, isCartOpen]);

  const isDiscountApplicable = (discount) => {
    const subtotal = getSubtotal();
    if (subtotal < discount.minAmount) return false;
    switch (discount.applicationType) {
      case 'all_products': return true;
      case 'specific_products': return cartItems.some(item => discount.applicableProducts.includes(item.name));
      case 'specific_categories': return cartItems.some(item => discount.applicableCategories.includes(item.category));
      default: return false;
    }
  };

  const isItemDiscountApplicable = (discount, item) => {
    switch (discount.applicationType) {
      case 'all_products': return true;
      case 'specific_products': return discount.applicableProducts.includes(item.name);
      case 'specific_categories': return discount.applicableCategories.includes(item.category);
      default: return false;
    }
  };

  const openAddonsModal = async (itemIndex) => {
    const item = cartItems[itemIndex];
    if (!item || !item.id) return;
    setSelectedItemIndex(itemIndex);
    setIsAddonsLoading(true);
    setShowAddonsModal(true);
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${PRODUCTS_API_URL}/is_products/products/${item.id}/available_addons`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Could not fetch add-ons.');
        const data = await response.json();
        setAvailableAddons(data);
        setAddons(item.addons || []);
    } catch (error) {
        console.error("Failed to fetch available add-ons:", error);
        closeAddonsModal();
    } finally {
        setIsAddonsLoading(false);
    }
  };

  const closeAddonsModal = () => {
    setShowAddonsModal(false);
    setSelectedItemIndex(null);
    setAddons([]);
    setAvailableAddons([]);
  };

  const openItemDiscountModal = (itemIndex) => {
    const item = cartItems[itemIndex];
    if (!item) return;
    setSelectedItemIndex(itemIndex);
    setStagedItemDiscounts(item.itemDiscounts || []);
    setShowItemDiscountModal(true);
  };

  const closeItemDiscountModal = () => {
    setShowItemDiscountModal(false);
    setSelectedItemIndex(null);
    setStagedItemDiscounts([]);
  };

  const toggleStagedItemDiscount = (discountId) => {
    const item = cartItems[selectedItemIndex];
    const discount = availableDiscounts.find(d => d.id === discountId);
    if (!discount || !isItemDiscountApplicable(discount, item)) return;
    if (stagedItemDiscounts.includes(discountId)) {
      setStagedItemDiscounts([]);
    } else {
      setStagedItemDiscounts([discountId]);
    }
  };

  const applyItemDiscounts = () => {
    if (selectedItemIndex !== null) {
      const updatedCart = [...cartItems];
      updatedCart[selectedItemIndex].itemDiscounts = [...stagedItemDiscounts];
      setCartItems(updatedCart);
    }
    closeItemDiscountModal();
  };

  const openDiscountsModal = () => {
    setStagedDiscounts([...appliedDiscounts]);
    setShowDiscountsModal(true);
  };

  const closeDiscountsModal = () => {
    setShowDiscountsModal(false);
    setStagedDiscounts([]);
  };

  const applyDiscounts = () => {
    setAppliedDiscounts([...stagedDiscounts]);
    setShowDiscountsModal(false);
    setStagedDiscounts([]);
  };

  const toggleStagedDiscount = (discountId) => {
    const discount = availableDiscounts.find(d => d.id === discountId);
    if (!discount || !isDiscountApplicable(discount)) return;
    if (stagedDiscounts.includes(discountId)) {
      setStagedDiscounts([]);
    } else {
      setStagedDiscounts([discountId]);
    }
  };

  const updateAddons = (addonId, addonName, price, quantity) => {
    setAddons(prev => {
        const existingIndex = prev.findIndex(a => a.addonId === addonId);
        let newAddons = [...prev];
        if (quantity <= 0) {
            return newAddons.filter(a => a.addonId !== addonId);
        }
        if (existingIndex > -1) {
            newAddons[existingIndex] = { ...newAddons[existingIndex], quantity };
        } else {
            newAddons.push({ addonId, addonName, price, quantity });
        }
        return newAddons;
    });
  };

  const saveAddons = () => {
    if (selectedItemIndex !== null) {
      const updatedCart = [...cartItems];
      updatedCart[selectedItemIndex].addons = addons;
      setCartItems(updatedCart);
    }
    closeAddonsModal();
  };

  useEffect(() => {
    if (!isCartOpen) {
      setCartItems([]);
      setAppliedDiscounts([]);
      setStagedDiscounts([]);
      setAutoPromotion(null);
      setPaymentMethod('Cash');
      setOrderType('Dine in');
    }
  }, [isCartOpen, setCartItems, setPaymentMethod, setOrderType]);

  const getTotalAddonsPrice = (itemAddons) => {
    if (!Array.isArray(itemAddons)) return 0;
    return itemAddons.reduce((total, addon) => total + (addon.price * addon.quantity), 0);
  };

  const getTotalAddonsCost = () => cartItems.reduce((acc, item) => acc + (getTotalAddonsPrice(item.addons) * item.quantity), 0);

  const getSubtotal = () => cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const calculateItemDiscount = (item) => {
    if (!item.itemDiscounts || item.itemDiscounts.length === 0) return 0;
    const discountId = item.itemDiscounts[0];
    const discount = availableDiscounts.find(d => d.id === discountId);
    if (!discount || !isItemDiscountApplicable(discount, item)) return 0;
    
    const itemPrice = item.price + getTotalAddonsPrice(item.addons);
    let discountAmount = 0;
    
    if (discount.type === 'percentage') {
      discountAmount = (itemPrice * parseFloat(discount.value)) / 100;
    } else if (discount.type === 'fixed') {
      discountAmount = Math.min(parseFloat(discount.value), itemPrice);
    }
    
    return discountAmount * item.quantity;
  };

  const getTotalItemDiscounts = () => {
    return cartItems.reduce((total, item) => total + calculateItemDiscount(item), 0);
  };

  const calculateManualDiscount = (discountList) => {
    const subtotal = getSubtotal();
    if (discountList.length === 0) return 0;
    const discountId = discountList[0];
    const discount = availableDiscounts.find(d => d.id === discountId);
    if (!discount || !isDiscountApplicable(discount)) return 0;
    let eligibleItemPrice = 0;
    let highestPricedItem = null;
    if (discount.applicationType === 'all_products') {
        highestPricedItem = cartItems.reduce((highest, item) => (!highest || item.price > highest.price ? item : highest), null);
    } else if (discount.applicationType === 'specific_products') {
        highestPricedItem = cartItems.filter(item => discount.applicableProducts.includes(item.name)).reduce((highest, item) => (!highest || item.price > highest.price ? item : highest), null);
    } else if (discount.applicationType === 'specific_categories') {
        highestPricedItem = cartItems.filter(item => discount.applicableCategories.includes(item.category)).reduce((highest, item) => (!highest || item.price > highest.price ? item : highest), null);
    }
    if (highestPricedItem) {
        eligibleItemPrice = highestPricedItem.price + getTotalAddonsPrice(highestPricedItem.addons);
    }
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (eligibleItemPrice * parseFloat(discount.value)) / 100;
    } else if (discount.type === 'fixed') {
      discountAmount = Math.min(parseFloat(discount.value), eligibleItemPrice);
    }
    return Math.min(discountAmount, subtotal);
  };

  const manualDiscountValue = calculateManualDiscount(appliedDiscounts);
  const isManualDiscountActive = appliedDiscounts.length > 0;
  
  const promotionalDiscountValue = autoPromotion?.discountAmount || 0;
  const itemDiscountsValue = getTotalItemDiscounts();
  
  const getAppliedDiscountNames = () => appliedDiscounts.map(id => availableDiscounts.find(d => d.id === id)?.name).filter(Boolean);
  
  const getTotal = () => {
    const total = getSubtotal() + getTotalAddonsCost() - manualDiscountValue - promotionalDiscountValue - itemDiscountsValue;
    return Math.max(0, parseFloat(total.toFixed(2)));
  };

  const checkQuantityConflicts = async (cartItemToIncrease, simulatedCart) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No auth token found');
      return { canAdd: true, conflicts: [] };
    }
    try {
      const response = await fetch(
        `${PRODUCTS_API_URL}/is_products/products/check-quantity-increase`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart_items: simulatedCart })
        }
      );
      if (!response.ok) {
        console.error('Failed to check conflicts');
        return { canAdd: true, conflicts: [] };
      }
      return await response.json();
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return { canAdd: true, conflicts: [] };
    }
  };

  const updateQuantity = async (index, amount) => {
    const currentItem = cartItems[index];
    const newQuantity = currentItem.quantity + amount;
    if (amount > 0 && currentItem.type === 'product') {
      const simulatedCart = cartItems.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item);
      const conflictCheck = await checkQuantityConflicts(currentItem, simulatedCart);
      if (!conflictCheck.canAdd) {
        const conflictMessages = conflictCheck.conflicts.map(c => `• ${c.type.toUpperCase()}: ${c.name}\n  Needs ${c.needed}, only ${c.available} available\n  Conflicts with: "${c.conflictsWith}"`).join('\n\n');
        alert(`❌ Cannot increase quantity for "${currentItem.name}".\n\nShared limited resources:\n\n${conflictMessages}`);
        return;
      }
    }
    setCartItems(prev => {
      const updated = [...prev];
      if (amount > 0 && currentItem.maxQuantity && newQuantity > currentItem.maxQuantity) {
        alert(`Maximum quantity of ${currentItem.maxQuantity} reached for ${currentItem.name}. ${currentItem.limitedBy || ''}`);
        return prev;
      }
      if (newQuantity <= 0) {
        return updated.filter((_, i) => i !== index);
      } else {
        updated[index] = { ...currentItem, quantity: newQuantity };
        return updated;
      }
    });
  };

  const removeFromCart = (index) => setCartItems(prev => prev.filter((_, i) => i !== index));
  
  const handleProcessTransaction = () => {
    if (cartItems.length === 0) {
      alert('Please add items to your cart before processing the transaction.');
      return;
    }
    setShowTransactionSummary(true);
  };

  const handleConfirmTransaction = () => {
    if (paymentMethod === 'GCash') {
      setShowTransactionSummary(false);
      setShowGCashReference(true);
    } else {
      confirmTransaction();
    }
  };

  const handleGCashSubmit = (reference) => {
    setShowGCashReference(false);
    confirmTransaction(reference);
  };

  const confirmTransaction = async (gcashRef = null) => {
    setIsProcessing(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert("Authentication error. Please log in again.");
        setIsProcessing(false);
        return;
    }
    
    const saleData = {
        cartItems: cartItems.map(item => ({
          ...item, 
          addons: item.addons || [],
          itemDiscounts: item.itemDiscounts || []
        })),
        orderType, 
        paymentMethod, 
        appliedDiscounts: getAppliedDiscountNames(),
        promotionalDiscountAmount: promotionalDiscountValue,
        promotionalDiscountName: autoPromotion?.name || null,
        itemDiscountsAmount: itemDiscountsValue,
        gcashReference: gcashRef
    };

    try {
        const response = await fetch(`${SALES_API_URL}/auth/sales/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(saleData)
        });
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.detail || 'Failed to process transaction.');
        setShowTransactionSummary(false);
        setShowGCashReference(false);
        setShowConfirmation(true);
        setCartItems([]);
        setAppliedDiscounts([]);
    } catch (err) {
        setError(err.message);
        alert(`Error: ${err.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const getAddonsSummary = (itemAddons, quantity = 1) => {
    if (!Array.isArray(itemAddons) || itemAddons.length === 0) return null;
    return itemAddons.map(addon => `+${addon.quantity * quantity} ${addon.addonName}`).join(', ');
  };

  const getItemDiscountsSummary = (item) => {
    if (!item.itemDiscounts || item.itemDiscounts.length === 0) return null;
    return item.itemDiscounts.map(id => {
      const discount = availableDiscounts.find(d => d.id === id);
      return discount ? discount.name : '';
    }).filter(Boolean).join(', ');
  };

  return (
    <>
        <div className={`cart-panel ${isCartOpen ? 'open' : ''}`}>
            <div className="order-section">
                <h2>Order Details</h2>
                <div className="order-type-toggle">
                    <button className={orderType === 'Dine in' ? 'active' : ''} onClick={() => setOrderType('Dine in')}>Dine in</button>
                    <button className={orderType === 'Take out' ? 'active' : ''} onClick={() => setOrderType('Take out')}>Take out</button>
                </div>
                <div className="cart-items">
                    {cartItems.length > 0 ? (cartItems.map((item, index) => (
                        <div key={item.cartId || `${item.id}-${index}`} className="cart-item">
                            <img src={item.image} alt={item.name} />
                            <div className="item-details">
                                <div className="item-name">{item.name}</div>
                                {item.maxQuantity && item.quantity >= item.maxQuantity * 0.8 && (
                                    <div className="max-qty-warning" style={{fontSize: '11px', color: '#ff9800', marginTop: '2px'}}>
                                        Max: {item.maxQuantity} {item.limitedBy ? `(${item.limitedBy})` : ''}
                                    </div>
                                )}
                                {item.hasAddons && (<div className="addons-link" onClick={() => openAddonsModal(index)}>Add on</div>)}
                                {item.addons && item.addons.length > 0 && (<div className="addons-summary"><span>{getAddonsSummary(item.addons, item.quantity)}</span></div>)}
                                {item.itemDiscounts && item.itemDiscounts.length > 0 && (
                                  <div className="item-discounts-summary">
                                    <span>{getItemDiscountsSummary(item)} (-₱{calculateItemDiscount(item).toFixed(2)})</span>
                                  </div>
                                )}
                                <div className="flex-spacer" />
                                <div className="qty-price">
                                    <button onClick={() => updateQuantity(index, -1)}><FiMinus /></button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(index, 1)} disabled={item.maxQuantity && item.quantity >= item.maxQuantity} style={{ opacity: item.maxQuantity && item.quantity >= item.maxQuantity ? 0.5 : 1, cursor: item.maxQuantity && item.quantity >= item.maxQuantity ? 'not-allowed' : 'pointer' }}>
                                        <FiPlus />
                                    </button>
                                    <span className="item-price">₱{((item.price + getTotalAddonsPrice(item.addons)) * item.quantity - calculateItemDiscount(item)).toFixed(0)}</span>
                                </div>
                            </div>
                            <div className="item-actions">
                              <button className="discount-item" onClick={() => openItemDiscountModal(index)}>
                                <FontAwesomeIcon icon={faPercent} />
                              </button>
                              <button className="remove-item" onClick={() => removeFromCart(index)}>
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </div>
                        </div>
                    ))) : (
                        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#999' }}>
                            Your cart is empty.
                        </div>
                    )}
                </div>
                
                <div className="discount-section" onClick={openDiscountsModal}>
                  <div className="discount-input-wrapper">
                    <div className="discount-row">

                      <input
                        type="text"
                        placeholder="Discounts:"
                        readOnly
                      />

                      <div className="discount-tags">
                        {autoPromotion && (
                          <span className="discount-tag">Promo: {autoPromotion.name}</span>
                        )}

                        {appliedDiscounts.map(id => {
                          const d = availableDiscounts.find(x => x.id === id);
                          return d ? (
                            <span key={id} className="discount-tag">
                              Discount: {d.name}
                            </span>
                          ) : null;
                        })}
                      </div>

                    </div>
                  </div>
                    <div className="summary">
                        <div className="line"><span>Subtotal:</span><span>₱{getSubtotal().toFixed(2)}</span></div>

                        {getTotalAddonsCost() > 0 && (
                            <div className="line">
                                <span>Add-ons:</span>
                                <span>₱{getTotalAddonsCost().toFixed(2)}</span>
                            </div>
                        )}

                        {promotionalDiscountValue > 0 && (
                            <div className="line">
                                <span>Promotion:</span>
                                <span>-₱{promotionalDiscountValue.toFixed(2)}</span>
                            </div>
                        )}

                        {manualDiscountValue > 0 && (
                            <div className="line">
                                <span>Discount:</span>
                                <span>-₱{manualDiscountValue.toFixed(2)}</span>
                            </div>
                        )}

                        {itemDiscountsValue > 0 && (
                            <div className="line">
                                <span>Item Discounts:</span>
                                <span>-₱{itemDiscountsValue.toFixed(2)}</span>
                            </div>
                        )}

                        <hr />
                        <div className="line total"><span>Total:</span><span>₱{getTotal().toFixed(2)}</span></div>
                    </div>
                </div>

                <div className="payment-section">
                    <h3>Payment Method</h3>
                    <div className="payment-options">
                        <button className={`cash ${paymentMethod === 'Cash' ? 'active' : ''}`} onClick={() => setPaymentMethod('Cash')}><FontAwesomeIcon icon={faMoneyBills} /><span>Cash</span></button>
                        <button className={`gcash ${paymentMethod === 'GCash' ? 'active' : ''}`} onClick={() => setPaymentMethod('GCash')}><FontAwesomeIcon icon={faQrcode} /><span>GCash</span></button>
                    </div>
                </div>
                <button className="process-button" onClick={handleProcessTransaction} disabled={isProcessing}>
                  {isProcessing ? 'Processing...' : 'Process Transaction'}
                </button>
            </div>
        </div>

        <AddonsModal showAddonsModal={showAddonsModal} closeAddonsModal={closeAddonsModal} addons={addons} availableAddons={availableAddons} isLoading={isAddonsLoading} updateAddons={updateAddons} saveAddons={saveAddons} />
        
        <DiscountsModal showDiscountsModal={showDiscountsModal} closeDiscountsModal={closeDiscountsModal} isLoading={isLoading} error={error} availableDiscounts={availableDiscounts} stagedDiscounts={stagedDiscounts} toggleStagedDiscount={toggleStagedDiscount} applyDiscounts={applyDiscounts} getStagedDiscount={() => calculateManualDiscount(stagedDiscounts)} getSubtotal={getSubtotal} isDiscountApplicable={isDiscountApplicable} />
        
        <ItemDiscountModal
          showItemDiscountModal={showItemDiscountModal}
          closeItemDiscountModal={closeItemDiscountModal}
          isLoading={isLoading}
          error={error}
          availableDiscounts={availableDiscounts}
          stagedItemDiscounts={stagedItemDiscounts}
          toggleStagedItemDiscount={toggleStagedItemDiscount}
          applyItemDiscounts={applyItemDiscounts}
          selectedItem={selectedItemIndex !== null ? cartItems[selectedItemIndex] : null}
          isItemDiscountApplicable={isItemDiscountApplicable}
          calculateItemDiscount={(discountList) => {
            if (selectedItemIndex === null) return 0;
            const item = cartItems[selectedItemIndex];
            if (!discountList || discountList.length === 0) return 0;
            const discountId = discountList[0];
            const discount = availableDiscounts.find(d => d.id === discountId);
            if (!discount || !isItemDiscountApplicable(discount, item)) return 0;
            
            const itemPrice = item.price + getTotalAddonsPrice(item.addons);
            let discountAmount = 0;
            
            if (discount.type === 'percentage') {
              discountAmount = (itemPrice * parseFloat(discount.value)) / 100;
            } else if (discount.type === 'fixed') {
              discountAmount = Math.min(parseFloat(discount.value), itemPrice);
            }
            
            return discountAmount * item.quantity;
          }}
        />
        
        <TransactionSummaryModal
          showTransactionSummary={showTransactionSummary}
          setShowTransactionSummary={setShowTransactionSummary}
          cartItems={cartItems}
          orderType={orderType}
          paymentMethod={paymentMethod}
          appliedDiscounts={appliedDiscounts}
          availableDiscounts={availableDiscounts}
          getTotalAddonsPrice={getTotalAddonsPrice}
          getSubtotal={getSubtotal}
          promotionalDiscountValue={promotionalDiscountValue}
          manualDiscountValue={manualDiscountValue}
          itemDiscountsValue={itemDiscountsValue}
          autoPromotion={autoPromotion}
          getTotal={getTotal}
          confirmTransaction={handleConfirmTransaction}
          isProcessing={isProcessing}
        />
        
        <GCashReferenceModal showGCashReference={showGCashReference} setShowGCashReference={setShowGCashReference} onSubmit={handleGCashSubmit} isProcessing={isProcessing} />
        <OrderConfirmationModal showConfirmation={showConfirmation} setShowConfirmation={setShowConfirmation} onClose={() => setShowConfirmation(false)} />
    </>
  );
};

export default CartPanel;