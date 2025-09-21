import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faMoneyBills, faQrcode } from '@fortawesome/free-solid-svg-icons';
import { FiMinus, FiPlus } from "react-icons/fi";
import './cartPanel.css';
import { 
  AddonsModal, 
  DiscountsModal, 
  TransactionSummaryModal, 
  GCashReferenceModal,
  OrderConfirmationModal 
} from './cartModals';

const SALES_API_URL = 'http://127.0.0.1:9000';
const DISCOUNTS_API_URL = 'http://127.0.0.1:9002';
const PRODUCTS_API_URL = 'http://127.0.0.1:8001'; // <-- NEW: API URL for products

const CartPanel = ({
  cartItems,
  setCartItems,
  isCartOpen,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
}) => {
  // --- REMOVED: Hardcoded drink categories are no longer needed ---

  // Component states
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  
  // --- MODIFIED: Addons state is now an array to handle dynamic data ---
  const [addons, setAddons] = useState([]); 
  
  // --- NEW: States for fetching and storing available add-ons ---
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

  // --- MODIFICATION: Fetches available add-ons for the selected product ---
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
        setAddons(item.addons || []); // Pre-populate with current addons
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
    setStagedDiscounts(prev => prev.includes(discountId) ? prev.filter(id => id !== discountId) : [...prev, discountId]);
  };

  // --- MODIFICATION: Handles updates for the new addons array structure ---
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

  // --- MODIFICATION: Saves the addons array to the cart item ---
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
      setAvailableDiscounts([]);
      setPaymentMethod('Cash');
      setOrderType('Dine in');
    }
  }, [isCartOpen, setCartItems, setPaymentMethod, setOrderType]);

  // --- MODIFICATION: Calculates price from the addons array ---
  const getTotalAddonsPrice = (itemAddons) => {
    if (!Array.isArray(itemAddons)) return 0;
    return itemAddons.reduce((total, addon) => total + (addon.price * addon.quantity), 0);
  };
  
  const getSubtotal = () => cartItems.reduce((acc, item) => (acc + (item.price * item.quantity) + (getTotalAddonsPrice(item.addons) * item.quantity)), 0);

  const calculateDiscount = (discountList) => {
    const subtotal = getSubtotal();
    return Math.min(subtotal, discountList.reduce((acc, discountId) => {
        const discount = availableDiscounts.find(d => d.id === discountId);
        if (discount && isDiscountApplicable(discount)) {
            if (discount.type === 'percentage') return acc + (subtotal * parseFloat(discount.value)) / 100;
            if (discount.type === 'fixed') return acc + parseFloat(discount.value);
        }
        return acc;
    }, 0));
  };

  const getDiscount = () => calculateDiscount(appliedDiscounts);
  const getStagedDiscount = () => calculateDiscount(stagedDiscounts);
  const getTotal = () => Math.max(0, getSubtotal() - getDiscount());

  const updateQuantity = (index, amount) => {
    setCartItems(prev => {
        const updated = [...prev];
        updated[index].quantity += amount;
        return updated[index].quantity <= 0 ? updated.filter((_, i) => i !== index) : updated;
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
    const appliedDiscountNames = appliedDiscounts.map(id => availableDiscounts.find(d => d.id === id)?.name).filter(Boolean);
    const saleData = {
        cartItems: cartItems.map(item => ({...item, addons: item.addons || [] })),
        orderType, paymentMethod, appliedDiscounts: appliedDiscountNames, gcashReference: gcashRef
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

  const getAppliedDiscountNames = () => appliedDiscounts.map(id => availableDiscounts.find(d => d.id === id)?.name).filter(Boolean);

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
                        <div key={`${item.id}-${index}`} className="cart-item">
                            <img src={item.image} alt={item.name} />
                            <div className="item-details">
                                <div className="item-name">{item.name}</div>
                                
                                {/* --- MODIFICATION: Conditionally render link based on backend flag --- */}
                                {item.hasAddons && (
                                    <div className="addons-link" onClick={() => openAddonsModal(index)}>Add ons</div>
                                )}
                                
                                {/* --- MODIFICATION: Dynamically display addon summary from array --- */}
                                {item.addons && item.addons.length > 0 && (
                                    <div className="addons-summary">
                                        {item.addons.map(addon => (
                                            <span key={addon.addonId}>+{addon.quantity} {addon.addonName}</span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex-spacer" />
                                <div className="qty-price">
                                    <button onClick={() => updateQuantity(index, -1)}><FiMinus /></button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(index, 1)}><FiPlus /></button>
                                    <span className="item-price">₱{((item.price + getTotalAddonsPrice(item.addons)) * item.quantity).toFixed(0)}</span>
                                </div>
                            </div>
                            <button className="remove-item" onClick={() => removeFromCart(index)}>
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    ))) : (
                        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#999' }}>
                            Your cart is empty.
                        </div>
                    )}
                </div>
                <div className="discount-section">
                    <div className="discount-input-wrapper" onClick={openDiscountsModal}>
                        <input type="text" placeholder="Discounts and Promotions" value={getAppliedDiscountNames().join(', ')} readOnly />
                    </div>
                    <div className="summary">
                        <div className="line"><span>Subtotal:</span><span>₱{getSubtotal().toFixed(2)}</span></div>
                        <div className="line"><span>Discount:</span><span>-₱{getDiscount().toFixed(2)}</span></div>
                        <hr />
                        <div className="line total"><span>Total:</span><span>₱{getTotal().toFixed(2)}</span></div>
                    </div>
                </div>
                <div className="payment-section">
                    <h3>Payment Method</h3>
                    <div className="payment-options">
                        <button className={`cash ${paymentMethod === 'Cash' ? 'active' : ''}`} onClick={() => setPaymentMethod('Cash')}>
                            <FontAwesomeIcon icon={faMoneyBills} /><span>Cash</span>
                        </button>
                        <button className={`gcash ${paymentMethod === 'GCash' ? 'active' : ''}`} onClick={() => setPaymentMethod('GCash')}>
                            <FontAwesomeIcon icon={faQrcode} /><span>GCash</span>
                        </button>
                    </div>
                </div>
                <button className="process-button" onClick={handleProcessTransaction} disabled={isProcessing}>
                  {isProcessing ? 'Processing...' : 'Process Transaction'}
                </button>
            </div>
        </div>

        {/* --- MODIFICATION: Pass new dynamic props to AddonsModal --- */}
        <AddonsModal
          showAddonsModal={showAddonsModal}
          closeAddonsModal={closeAddonsModal}
          addons={addons}
          availableAddons={availableAddons}
          isLoading={isAddonsLoading}
          updateAddons={updateAddons}
          saveAddons={saveAddons}
        />

        <DiscountsModal
          showDiscountsModal={showDiscountsModal}
          closeDiscountsModal={closeDiscountsModal}
          isLoading={isLoading}
          error={error}
          availableDiscounts={availableDiscounts}
          stagedDiscounts={stagedDiscounts}
          toggleStagedDiscount={toggleStagedDiscount}
          applyDiscounts={applyDiscounts}
          getStagedDiscount={getStagedDiscount}
          getSubtotal={getSubtotal}
        />

        <TransactionSummaryModal
          showTransactionSummary={showTransactionSummary}
          setShowTransactionSummary={setShowTransactionSummary}
          cartItems={cartItems}
          orderType={orderType}
          paymentMethod={paymentMethod}
          getSubtotal={getSubtotal}
          getDiscount={getDiscount}
          getTotal={getTotal}
          getTotalAddonsPrice={getTotalAddonsPrice}
          appliedDiscounts={appliedDiscounts}
          availableDiscounts={availableDiscounts}
          confirmTransaction={handleConfirmTransaction}
          isProcessing={isProcessing}
        />

        <GCashReferenceModal
          showGCashReference={showGCashReference}
          setShowGCashReference={setShowGCashReference}
          onSubmit={handleGCashSubmit}
          isProcessing={isProcessing}
        />

        <OrderConfirmationModal
          showConfirmation={showConfirmation}
          setShowConfirmation={setShowConfirmation}
        />
    </>
  );
};

export default CartPanel;