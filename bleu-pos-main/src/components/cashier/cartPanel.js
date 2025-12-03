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
  const [showDiscountsModal, setShowDiscountsModal] = useState(false);
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [filteredAvailableDiscounts, setFilteredAvailableDiscounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTransactionSummary, setShowTransactionSummary] = useState(false);
  const [showGCashReference, setShowGCashReference] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [autoPromotion, setAutoPromotion] = useState(null);

  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [addons, setAddons] = useState([]);
  const [availableAddons, setAvailableAddons] = useState([]);
  const [isAddonsLoading, setIsAddonsLoading] = useState(false);

  const getTotalAddonsPrice = (itemAddons) => {
    if (!Array.isArray(itemAddons)) return 0;
    return itemAddons.reduce((total, addon) => total + (addon.price * addon.quantity), 0);
  };

  const getSubtotal = () => cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

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
          throw new Error(errorData.detail || 'Failed to fetch discounts.');
        }
        const data = await response.json();
        const mappedAndFilteredDiscounts = data
          .filter(d => d.status === 'active')
          .map(d => ({
            id: d.id,
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

  // ✅ FIXED: Calculate per-item promotion amounts for comparison with discounts
  const getItemPromotionAmount = (itemIndex) => {
    if (!autoPromotion || !autoPromotion.itemPromotions) return 0;
    const itemPromo = autoPromotion.itemPromotions.find(p => p.itemIndex === itemIndex);
    if (!itemPromo) return 0;
    
    const item = cartItems[itemIndex];
    if (!item) return 0;
    
    // Calculate per-item promotion amount
    return itemPromo.promotionAmount / itemPromo.quantity;
  };

  useEffect(() => {
    if (!availableDiscounts.length) {
      setFilteredAvailableDiscounts([]);
      return;
    }
    
    const discountsWithValues = availableDiscounts.map(discount => {
      const subtotal = getSubtotal();
      const meetsMinSpend = !discount.minAmount || subtotal >= discount.minAmount;
      let potentialDiscount = 0;
      let hasAnyItemBetterThanPromo = false;
      
      const eligibleItems = cartItems.filter((item, itemIndex) => {
        if (item.type !== 'product') return false;
        
        // Check if item matches discount criteria
        let matchesDiscountCriteria = false;
        switch (discount.applicationType) {
          case 'all_products': 
            matchesDiscountCriteria = true;
            break;
          case 'specific_products': 
            matchesDiscountCriteria = discount.applicableProducts?.includes(item.name);
            break;
          case 'specific_categories': 
            matchesDiscountCriteria = discount.applicableCategories?.includes(item.category);
            break;
        }
        
        return matchesDiscountCriteria;
      });
      
      if (eligibleItems.length > 0) {
        eligibleItems.forEach((item, idx) => {
          const itemIndex = cartItems.findIndex(ci => ci === item);
          const itemPrice = item.price + getTotalAddonsPrice(item.addons);
          
          // Get already discounted quantity
          const discountedQty = appliedDiscounts.reduce((total, discountData) => {
            const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === itemIndex);
            return total + (itemDiscountInfo ? itemDiscountInfo.quantity : 0);
          }, 0);
          
          const availableQty = item.quantity - discountedQty;
          
          if (availableQty > 0) {
            let perItemDiscount = 0;
            
            if (discount.type === 'percentage') {
              perItemDiscount = itemPrice * (discount.value / 100);
            } else if (discount.type === 'fixed') {
              perItemDiscount = Math.min(discount.value, itemPrice);
            }
            
            // ✅ FIXED: Compare per-item discount with per-item promotion
            const itemPromotionAmount = getItemPromotionAmount(itemIndex);
            
            // If this item's discount is better than its promotion, mark it
            if (perItemDiscount > itemPromotionAmount) {
              hasAnyItemBetterThanPromo = true;
            }
            
            potentialDiscount += perItemDiscount * availableQty;
          }
        });
      }
      
      return {
        ...discount,
        potentialDiscount,
        meetsMinSpend,
        hasEligibleItems: eligibleItems.length > 0,
        isBetterThanPromo: hasAnyItemBetterThanPromo,
        isEnabled: meetsMinSpend && eligibleItems.length > 0 && hasAnyItemBetterThanPromo
      };
    });
    
    const filtered = discountsWithValues.filter(d => d.meetsMinSpend && d.hasEligibleItems);
    setFilteredAvailableDiscounts(filtered);
  }, [availableDiscounts, cartItems, autoPromotion, appliedDiscounts]);

  useEffect(() => {
    const calculateBestPromotion = () => {
      let bestOverallPromo = null;

      if (!cartItems.length || !promotions.length) {
        setAutoPromotion(null);
        return;
      }

      console.log("🔍 Starting promotion calculation with", promotions.length, "promotions");

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
          
          if (promo.applicationType === 'specific_products') {
            promo.priority = 3;
          } else if (promo.applicationType === 'specific_categories') {
            promo.priority = 2;
          } else if (promo.applicationType === 'all_products') {
            promo.priority = 1;
          }
          
          return promo;
        });

      console.log("📋 Parsed promotions:", parsedPromotions.map(p => ({ 
        name: p.original.name, 
        type: p.promotionType, 
        priority: p.priority,
        applicationType: p.applicationType,
        selectedProducts: p.selectedProducts
      })));

      const itemBestPromotion = new Map();
      
      for (const promo of parsedPromotions) {
        if (!Array.isArray(promo.selectedProducts)) continue;
        
        console.log(`  🔍 Evaluating promo "${promo.original.name}" (${promo.applicationType}):`, promo.selectedProducts);
        
        const eligibleItems = cartItems.filter((item, itemIndex) => {
          if (item.type !== 'product') return false;
          
          if (promo.applicationType === 'all_products') {
            console.log(`    - "${item.name}" eligible (all_products)`);
            return true;
          }
          
          if (promo.applicationType === 'specific_categories') {
            const isEligible = promo.selectedProducts.includes(item.category);
            console.log(`    - "${item.name}" (${item.category}) eligible? ${isEligible}`);
            return isEligible;
          }
          
          if (promo.applicationType === 'specific_products') {
            const matchesProductName = promo.selectedProducts.includes(item.name);
            const matchesCategory = promo.selectedProducts.includes(item.category);
            const isEligible = matchesProductName || matchesCategory;
            
            if (matchesCategory && !matchesProductName) {
              console.log(`    - "${item.name}" eligible by CATEGORY "${item.category}" (treating as category)`);
            } else {
              console.log(`    - "${item.name}" eligible? ${isEligible} (looking for: ${promo.selectedProducts.join(', ')})`);
            }
            
            return isEligible;
          }
          
          return false;
        });
        
        if (!eligibleItems.length) continue;

        console.log(`  📦 Promo "${promo.original.name}" applies to ${eligibleItems.length} items`);

        if (promo.promotionType === 'percentage' || promo.promotionType === 'fixed') {
          eligibleItems.forEach(item => {
            const itemIndex = cartItems.findIndex(ci => ci === item);
            
            const discountedQty = appliedDiscounts.reduce((total, discountData) => {
              const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === itemIndex);
              return total + (itemDiscountInfo ? itemDiscountInfo.quantity : 0);
            }, 0);
            
            const eligibleQty = item.quantity - discountedQty;
            
            if (eligibleQty > 0) {
              let itemPromotionAmount = 0;
              
              if (promo.promotionType === 'percentage') {
                itemPromotionAmount = eligibleQty * (parseFloat(item.price) * (parseFloat(promo.promotionValue) / 100));
              } else {
                itemPromotionAmount = eligibleQty * Math.min(parseFloat(item.price), parseFloat(promo.promotionValue));
              }
              
              console.log(`    ✓ Item "${item.name}" discount: ₱${itemPromotionAmount.toFixed(2)} (priority: ${promo.priority})`);
              
              const currentBest = itemBestPromotion.get(itemIndex);
              const shouldReplace = !currentBest || itemPromotionAmount > currentBest.discount;
              
              if (shouldReplace) {
                itemBestPromotion.set(itemIndex, {
                  promo: promo,
                  discount: itemPromotionAmount,
                  priority: promo.priority,
                  quantity: eligibleQty
                });
                
                console.log(`      🏆 New best for item "${item.name}": ${promo.original.name} (₱${itemPromotionAmount.toFixed(2)} > ₱${currentBest?.discount.toFixed(2) || 0})`);
              }
            }
          });
          
        } else if (promo.promotionType === 'bogo') {
          const buyItemName = promo.selectedProducts[0];
          const getItemName = promo.selectedProducts.length > 1 ? promo.selectedProducts[1] : buyItemName;
          
          if (buyItemName === getItemName) {
            const itemInCart = cartItems.find(item => item.name === buyItemName);
            const itemIndex = cartItems.findIndex(item => item.name === buyItemName);
            
            if (!itemInCart || !promo.buyQuantity || !promo.getQuantity) continue;
            
            const discountedQty = appliedDiscounts.reduce((total, discountData) => {
              const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === itemIndex);
              return total + (itemDiscountInfo ? itemDiscountInfo.quantity : 0);
            }, 0);
            
            const eligibleQty = itemInCart.quantity - discountedQty;
            const bundleSize = promo.buyQuantity + promo.getQuantity;
            const numBundles = Math.floor(eligibleQty / bundleSize);
            const itemsToDiscountCount = numBundles * promo.getQuantity;
            
            if (itemsToDiscountCount > 0) {
              const itemPrice = itemInCart.price;
              let bogoDiscount = 0;
              
              if (promo.bogoDiscountType === 'percentage') {
                bogoDiscount = itemsToDiscountCount * (itemPrice * (promo.discountValue / 100));
              } else {
                bogoDiscount = itemsToDiscountCount * Math.min(itemPrice, promo.discountValue);
              }
              
              console.log(`    ✓ BOGO "${buyItemName}" discount: ₱${bogoDiscount.toFixed(2)} (priority: ${promo.priority})`);
              
              const currentBest = itemBestPromotion.get(itemIndex);
              const shouldReplace = !currentBest || bogoDiscount > currentBest.discount;
              
              if (shouldReplace) {
                itemBestPromotion.set(itemIndex, {
                  promo: promo,
                  discount: bogoDiscount,
                  priority: promo.priority,
                  quantity: itemsToDiscountCount
                });
                
                console.log(`      🏆 New best for item "${buyItemName}": ${promo.original.name} (₱${bogoDiscount.toFixed(2)} > ₱${currentBest?.discount.toFixed(2) || 0})`);
              }
            }
          } else {
            const buyItemsInCart = cartItems.find(item => item.name === buyItemName);
            const getItemsInCart = cartItems.find(item => item.name === getItemName);
            const getItemIndex = cartItems.findIndex(item => item.name === getItemName);
            
            if (!buyItemsInCart || !getItemsInCart || !promo.buyQuantity) continue;
            
            const getItemDiscountedQty = appliedDiscounts.reduce((total, discountData) => {
              const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === getItemIndex);
              return total + (itemDiscountInfo ? itemDiscountInfo.quantity : 0);
            }, 0);
            
            const bogoSets = Math.floor(buyItemsInCart.quantity / promo.buyQuantity);
            const eligibleGetItems = bogoSets * promo.getQuantity;
            const availableGetQty = getItemsInCart.quantity - getItemDiscountedQty;
            const itemsToDiscountCount = Math.min(availableGetQty, eligibleGetItems);
            
            if (itemsToDiscountCount > 0) {
              const getItemPrice = getItemsInCart.price;
              let bogoDiscount = 0;
              
              if (promo.bogoDiscountType === 'percentage') {
                bogoDiscount = itemsToDiscountCount * (getItemPrice * (promo.discountValue / 100));
              } else {
                bogoDiscount = itemsToDiscountCount * Math.min(getItemPrice, promo.discountValue);
              }
              
              console.log(`    ✓ BOGO "${getItemName}" discount: ₱${bogoDiscount.toFixed(2)} (priority: ${promo.priority})`);
              
              const currentBest = itemBestPromotion.get(getItemIndex);
              const shouldReplace = !currentBest || bogoDiscount > currentBest.discount;
              
              if (shouldReplace) {
                itemBestPromotion.set(getItemIndex, {
                  promo: promo,
                  discount: bogoDiscount,
                  priority: promo.priority,
                  quantity: itemsToDiscountCount
                });
                
                console.log(`      🏆 New best for item "${getItemName}": ${promo.original.name} (₱${bogoDiscount.toFixed(2)} > ₱${currentBest?.discount.toFixed(2) || 0})`);
              }
            }
          }
        }
      }
      
      const allItemPromotions = [];
      let totalDiscountAmount = 0;
      const promotionsUsed = new Set();
      
      itemBestPromotion.forEach((bestPromoData, itemIndex) => {
        totalDiscountAmount += bestPromoData.discount;
        promotionsUsed.add(bestPromoData.promo.original.name);
        
        allItemPromotions.push({
          itemIndex: itemIndex,
          quantity: bestPromoData.quantity,
          promotionAmount: bestPromoData.discount,
          promotionName: bestPromoData.promo.original.name
        });
      });
      
      if (allItemPromotions.length > 0) {
        const firstPromoData = Array.from(itemBestPromotion.values())[0];
        const promotionNames = Array.from(promotionsUsed);
        
        console.log(`💰 Multiple promotions applied: ${promotionNames.join(', ')}`);
        console.log(`💰 Total discount: ₱${totalDiscountAmount.toFixed(2)}`);
        
        bestOverallPromo = {
          ...firstPromoData.promo.original,
          name: promotionNames.length > 1 ? promotionNames.join(' + ') : promotionNames[0],
          discountAmount: totalDiscountAmount,
          itemPromotions: allItemPromotions,
          isMultiPromotion: promotionNames.length > 1,
          promotionsUsed: promotionNames
        };
        
        console.log(`🎉 Best promotion(s) selected: "${bestOverallPromo.name}" with total discount: ₱${bestOverallPromo.discountAmount.toFixed(2)}`);
      } else {
        console.log("❌ No applicable promotions found");
      }
      
      setAutoPromotion(bestOverallPromo);
    };
    
    calculateBestPromotion();
  }, [cartItems, promotions, isCartOpen, appliedDiscounts]);

  useEffect(() => {
    if (!isCartOpen) {
      setCartItems([]);
      setAppliedDiscounts([]);
      setAutoPromotion(null);
      setPaymentMethod('Cash');
      setOrderType('Dine in');
    }
  }, [isCartOpen, setCartItems, setPaymentMethod, setOrderType]);

  const getTotalAddonsCost = () => cartItems.reduce((acc, item) => acc + (getTotalAddonsPrice(item.addons) * item.quantity), 0);

  const getItemDiscount = (itemIndex) => {
    return appliedDiscounts.reduce((total, discountData) => {
      const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === itemIndex);
      return total + (itemDiscountInfo ? itemDiscountInfo.discountAmount : 0);
    }, 0);
  };

  const getItemDiscountedQty = (itemIndex) => {
    return appliedDiscounts.reduce((total, discountData) => {
      const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === itemIndex);
      return total + (itemDiscountInfo ? itemDiscountInfo.quantity : 0);
    }, 0);
  };

  const getItemPromotion = (itemIndex) => {
    if (!autoPromotion || !autoPromotion.itemPromotions) return 0;
    const itemPromo = autoPromotion.itemPromotions.find(p => p.itemIndex === itemIndex);
    return itemPromo ? itemPromo.promotionAmount : 0;
  };

  const getItemPromotionQty = (itemIndex) => {
    if (!autoPromotion || !autoPromotion.itemPromotions) return 0;
    const itemPromo = autoPromotion.itemPromotions.find(p => p.itemIndex === itemIndex);
    return itemPromo ? itemPromo.quantity : 0;
  };

  const getItemPromotionName = (itemIndex) => {
    if (!autoPromotion || !autoPromotion.itemPromotions) return '';
    const itemPromo = autoPromotion.itemPromotions.find(p => p.itemIndex === itemIndex);
    return itemPromo ? itemPromo.promotionName : '';
  };

  const getCombinedItemDiscounts = (itemIndex) => {
    const discountGroups = {};
    appliedDiscounts.forEach((discountData) => {
      const itemDiscountInfo = discountData.itemDiscounts?.find(d => d.itemIndex === itemIndex);
      if (!itemDiscountInfo || itemDiscountInfo.discountAmount === 0) return;
      const discountName = discountData.discount?.name || 'Discount';
      if (!discountGroups[discountName]) {
        discountGroups[discountName] = { name: discountName, totalQuantity: 0, totalAmount: 0 };
      }
      discountGroups[discountName].totalQuantity += itemDiscountInfo.quantity;
      discountGroups[discountName].totalAmount += itemDiscountInfo.discountAmount;
    });
    return Object.values(discountGroups);
  };

  const getTotalManualDiscount = () => {
    return appliedDiscounts.reduce((total, discountData) => total + (discountData.totalDiscount || 0), 0);
  };

  const promotionalDiscountValue = autoPromotion?.discountAmount || 0;
  const manualDiscountValue = getTotalManualDiscount();

  const getTotal = () => {
    const total = getSubtotal() + getTotalAddonsCost() - manualDiscountValue - promotionalDiscountValue;
    return Math.max(0, parseFloat(total.toFixed(2)));
  };

  const openDiscountsModal = () => setShowDiscountsModal(true);
  const closeDiscountsModal = () => setShowDiscountsModal(false);

  // ✅ FIXED: Remove promotions when applying discount
  const applyDiscountWithItems = (discountData) => {
    // Remove promotions when discount is applied
    setAutoPromotion(null);
    setAppliedDiscounts(prev => [...prev, discountData]);
    setShowDiscountsModal(false);
  };

  const removeDiscount = (discountIndex) => {
    setAppliedDiscounts(prev => prev.filter((_, idx) => idx !== discountIndex));
  };

  const removeAllDiscounts = () => setAppliedDiscounts([]);

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

  const updateAddons = (addonId, addonName, price, quantity) => {
    setAddons(prev => {
      const existingIndex = prev.findIndex(a => a.addonId === addonId);
      let newAddons = [...prev];
      if (quantity <= 0) return newAddons.filter(a => a.addonId !== addonId);
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

  const checkQuantityConflicts = async (cartItemToIncrease, simulatedCart) => {
    const token = localStorage.getItem('authToken');
    if (!token) return { canAdd: true, conflicts: [] };
    try {
      const response = await fetch(`${PRODUCTS_API_URL}/is_products/products/check-quantity-increase`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart_items: simulatedCart })
      });
      if (!response.ok) return { canAdd: true, conflicts: [] };
      return await response.json();
    } catch (error) {
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
        const conflictMessages = conflictCheck.conflicts.map(c => 
          `• ${c.type.toUpperCase()}: ${c.name}\n  Needs ${c.needed}, only ${c.available} available`
        ).join('\n\n');
        alert(`❌ Cannot increase quantity for "${currentItem.name}".\n\n${conflictMessages}`);
        return;
      }
    }
    
    setCartItems(prev => {
      const updated = [...prev];
      if (amount > 0 && currentItem.maxQuantity && newQuantity > currentItem.maxQuantity) {
        alert(`Maximum quantity of ${currentItem.maxQuantity} reached for ${currentItem.name}.`);
        return prev;
      }
      if (newQuantity <= 0) {
        const hasDiscount = appliedDiscounts.some(d => d.selectedItemsQty?.[index]);
        if (hasDiscount) {
          setAppliedDiscounts(prevDiscounts => prevDiscounts.filter(d => !d.selectedItemsQty?.[index]));
        }
        
        if (autoPromotion && autoPromotion.itemPromotions) {
          const itemHasPromotion = autoPromotion.itemPromotions.some(p => p.itemIndex === index);
          if (itemHasPromotion) {
            setAutoPromotion(null);
          }
        }
        
        return updated.filter((_, i) => i !== index);
      } else {
        const totalDiscountedQty = appliedDiscounts.reduce((sum, d) => sum + (d.selectedItemsQty?.[index] || 0), 0);
        if (newQuantity < totalDiscountedQty) {
          alert(`Cannot reduce quantity below ${totalDiscountedQty}. Remove discounts first.`);
          return prev;
        }
        updated[index] = { ...currentItem, quantity: newQuantity };
        return updated;
      }
    });
  };

  const removeFromCart = (index) => {
    const hasDiscount = appliedDiscounts.some(d => d.selectedItemsQty?.[index]);
    if (hasDiscount) {
      setAppliedDiscounts(prevDiscounts => prevDiscounts.filter(d => !d.selectedItemsQty?.[index]));
    }
    
    if (autoPromotion && autoPromotion.itemPromotions) {
      const itemHasPromotion = autoPromotion.itemPromotions.some(p => p.itemIndex === index);
      if (itemHasPromotion) {
        setAutoPromotion(null);
      }
    }
    
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessTransaction = () => {
    if (cartItems.length === 0) {
      alert('Please add items to your cart before processing.');
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
      cartItems: cartItems.map(item => ({ ...item, addons: item.addons || [] })),
      orderType,
      paymentMethod,
      appliedDiscounts: appliedDiscounts.map(d => ({
        discountName: d.discount.name,
        discountId: d.discount.id,
        itemDiscounts: d.itemDiscounts || []
      })),
      appliedPromotions: autoPromotion && autoPromotion.itemPromotions ? [{
        promotionName: autoPromotion.name,
        promotionId: autoPromotion.id,
        itemPromotions: autoPromotion.itemPromotions.map(ip => ({
          itemIndex: ip.itemIndex,
          quantity: ip.quantity,
          promotionAmount: ip.promotionAmount
        }))
      }] : [],
      promotionalDiscountAmount: promotionalDiscountValue,
      promotionalDiscountName: autoPromotion?.name || null,
      manualDiscountAmount: manualDiscountValue,
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
            {cartItems.length > 0 ? (
              cartItems.map((item, index) => (
                <div key={item.cartId || `${item.id}-${index}`} className="cart-item">
                  <img src={item.image} alt={item.name} />
                  <div className="item-details">
                    <div className="item-name">{item.name}</div>
                    {item.maxQuantity && item.quantity >= item.maxQuantity * 0.8 && (
                      <div className="max-qty-warning" style={{fontSize: '11px', color: '#ff9800', marginTop: '2px'}}>
                        Max: {item.maxQuantity} {item.limitedBy ? `(${item.limitedBy})` : ''}
                      </div>
                    )}
                    {item.type === 'product' && (
                      <div className="addons-link" onClick={() => openAddonsModal(index)}>Add on</div>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <div className="addons-summary">
                        {item.addons.map(addon => (
                          <span key={addon.addonId}>
                            +₱{(addon.price * addon.quantity * item.quantity).toFixed(2)} : {addon.addonName} (x{addon.quantity * item.quantity})
                          </span>
                            ))}
                      </div>
                    )}
                    {getItemDiscount(index) > 0 && (
                      <div className="promodis-summary">
                        {getCombinedItemDiscounts(index).map((discount, discIdx) => (
                          <div key={discIdx}>
                            <span>-₱{discount.totalAmount.toFixed(2)} : {discount.name} (x{discount.totalQuantity})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {getItemPromotion(index) > 0 && (
                      <div className="promodis-summary">
                        <span>-₱{getItemPromotion(index).toFixed(2)} : {getItemPromotionName(index)} (x{getItemPromotionQty(index)})</span>
                      </div>
                    )}
                    <div className="flex-spacer" />
                    <div className="qty-price">
                      <button onClick={() => updateQuantity(index, -1)}><FiMinus /></button>
                      <span>{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(index, 1)} 
                        disabled={item.maxQuantity && item.quantity >= item.maxQuantity}
                        style={{ 
                          opacity: item.maxQuantity && item.quantity >= item.maxQuantity ? 0.5 : 1, 
                          cursor: item.maxQuantity && item.quantity >= item.maxQuantity ? 'not-allowed' : 'pointer' 
                        }}
                      >
                        <FiPlus />
                      </button>
                      <span className="item-price">₱{((item.price + getTotalAddonsPrice(item.addons)) * item.quantity).toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="item-actions">
                    <button className="remove-item" onClick={() => removeFromCart(index)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: '#999' }}>Your cart is empty.</div>
            )}
          </div>

          <div className="discount-section" onClick={openDiscountsModal}>
            <div className="discount-input-wrapper">
              <div className="discount-row">
                <input type="text" placeholder="Discounts:" readOnly />
                <div className="discount-tags">
                  {autoPromotion && autoPromotion.isMultiPromotion ? (
                    autoPromotion.promotionsUsed.map((promoName, idx) => (
                      <span key={idx} className="discount-tag">{promoName}</span>
                    ))
                  ) : autoPromotion ? (
                    <span className="discount-tag">{autoPromotion.name}</span>
                  ) : null}
                  {appliedDiscounts.map((discount, idx) => (
                    <span key={idx} className="discount-tag removable" onClick={(e) => { e.stopPropagation(); removeDiscount(idx); }} title="Click to remove">
                      {discount.discount.name} ×
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="summary">
              <div className="line"><span>Subtotal:</span><span>₱{getSubtotal().toFixed(2)}</span></div>
              {getTotalAddonsCost() > 0 && <div className="line"><span>Add-ons:</span><span>₱{getTotalAddonsCost().toFixed(2)}</span></div>}
              {promotionalDiscountValue > 0 && (
                <div className="line">
                  <span>{autoPromotion?.isMultiPromotion ? 'Promotions' : (autoPromotion?.name || 'Promotion')}:</span>
                  <span>-₱{promotionalDiscountValue.toFixed(2)}</span>
                </div>
              )}
              {manualDiscountValue > 0 && (
                <div className="line">
                  <span>{appliedDiscounts.length === 1 ? appliedDiscounts[0].discount?.name : `${appliedDiscounts.length} Discounts`}:</span>
                  <span>-₱{manualDiscountValue.toFixed(2)}</span>
                </div>
              )}
              <hr />
              <div className="line total"><span>Total:</span><span>₱{getTotal().toFixed(2)}</span></div>
            </div>
          </div>

          <div className="payment-section">
            <h3>Payment Method</h3>
            <div className="payment-options">
              <button className={`cash ${paymentMethod === 'Cash' ? 'active' : ''}`} onClick={() => setPaymentMethod('Cash')}>
                <FontAwesomeIcon icon={faMoneyBills} />
                <span>Cash</span>
              </button>
              <button className={`gcash ${paymentMethod === 'GCash' ? 'active' : ''}`} onClick={() => setPaymentMethod('GCash')}>
                <FontAwesomeIcon icon={faQrcode} />
                <span>GCash</span>
              </button>
            </div>
          </div>

          <button className="process-button" onClick={handleProcessTransaction} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Process Transaction'}
          </button>
        </div>
      </div>

      <DiscountsModal
        showDiscountsModal={showDiscountsModal}
        closeDiscountsModal={closeDiscountsModal}
        isLoading={isLoading}
        error={error}
        availableDiscounts={filteredAvailableDiscounts}
        cartItems={cartItems}
        getSubtotal={getSubtotal}
        getTotalAddonsPrice={getTotalAddonsPrice}
        applyDiscountWithItems={applyDiscountWithItems}
        appliedDiscounts={appliedDiscounts}
        removeAllDiscounts={removeAllDiscounts}
        autoPromotion={autoPromotion}
      />

      <AddonsModal 
        showAddonsModal={showAddonsModal} 
        closeAddonsModal={closeAddonsModal} 
        addons={addons} 
        availableAddons={availableAddons} 
        isLoading={isAddonsLoading} 
        updateAddons={updateAddons} 
        saveAddons={saveAddons} 
      />

      <TransactionSummaryModal
        showTransactionSummary={showTransactionSummary}
        setShowTransactionSummary={setShowTransactionSummary}
        cartItems={cartItems}
        orderType={orderType}
        paymentMethod={paymentMethod}
        appliedDiscounts={appliedDiscounts}
        getTotalAddonsPrice={getTotalAddonsPrice}
        getSubtotal={getSubtotal}
        promotionalDiscountValue={promotionalDiscountValue}
        manualDiscountValue={manualDiscountValue}
        autoPromotion={autoPromotion}
        getTotal={getTotal}
        confirmTransaction={handleConfirmTransaction}
        isProcessing={isProcessing}
        getItemDiscount={getItemDiscount}
        getItemDiscountedQty={getItemDiscountedQty}
        getItemPromotion={getItemPromotion}
        getItemPromotionQty={getItemPromotionQty}
      />

      <GCashReferenceModal 
        showGCashReference={showGCashReference} 
        setShowGCashReference={setShowGCashReference} 
        onSubmit={handleGCashSubmit} 
        isProcessing={isProcessing} 
        error={error}
      />

      <OrderConfirmationModal 
        showConfirmation={showConfirmation} 
        setShowConfirmation={setShowConfirmation} 
        onClose={() => setShowConfirmation(false)} 
      />
    </>
  );
};

export default CartPanel;