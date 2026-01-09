import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faMoneyBills, faQrcode } from '@fortawesome/free-solid-svg-icons';
import { FiMinus, FiPlus } from "react-icons/fi";
import { toast } from 'react-toastify';
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

// ✅ CRITICAL FIX: Helper function to group cart items by promotion TYPE with INSTANCES
const groupCartItemsByPromotion = (items) => {
  const groups = [];
  const processedIndices = new Set();
  
  console.log('🔍 Grouping cart items:', items.length, 'items');
  
  items.forEach((item, index) => {
    if (processedIndices.has(index)) return;
    
    if (item.isFromBogo && item.bogoPromoId) {
      const bogoGroup = {
        type: 'bogo',
        promoId: item.bogoPromoId,
        groupId: item.bogoGroupId,
        promoName: item.bogoPromoName,
        promoImage: item.bogoPromoImage,
        discountType: item.bogoDiscountType,
        discountValue: item.bogoDiscountValue,
        items: [] // Each item here is a SINGLE INSTANCE (quantity: 1)
      };
      
      console.log(`  Creating BOGO group for promoId: ${item.bogoPromoId}`);
      
      // ✅ FIX: Expand items with quantity > 1 into individual instances
      items.forEach((otherItem, otherIndex) => {
        if (otherItem.isFromBogo && otherItem.bogoPromoId === item.bogoPromoId) {
          // Split item into individual instances based on quantity
          for (let i = 0; i < otherItem.quantity; i++) {
            const instanceId = `${otherItem.cartId || otherItem.id}-instance-${i}`;
            
            bogoGroup.items.push({
              item: {
                ...otherItem,
                quantity: 1, // ✅ Each instance has quantity 1
                instanceId: instanceId,
                instanceNumber: i + 1,
                originalIndex: otherIndex,
                // ✅ Deep clone addons to prevent shared references
                addons: otherItem.addons ? JSON.parse(JSON.stringify(otherItem.addons)) : []
              },
              index: otherIndex,
              instanceId: instanceId
            });
          }
          processedIndices.add(otherIndex);
        }
      });
      
      console.log(`  ✅ BOGO group created with ${bogoGroup.items.length} instances`);
      groups.push(bogoGroup);
    } else if (!processedIndices.has(index)) {
      console.log(`  Creating regular group for: ${item.name}`);
      groups.push({
        type: 'regular',
        items: [{ item, index }]
      });
      processedIndices.add(index);
    }
  });
  
  console.log(`📦 Total groups created: ${groups.length}`);
  return groups;
};

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

  const [selectedInstanceId, setSelectedInstanceId] = useState(null);

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

  const getItemPromotionAmount = (itemIndex) => {
    if (!autoPromotion || !autoPromotion.itemPromotions) return 0;
    const itemPromo = autoPromotion.itemPromotions.find(p => p.itemIndex === itemIndex);
    if (!itemPromo) return 0;
    
    const item = cartItems[itemIndex];
    if (!item) return 0;
    
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
        if (item.isFromBogo) return false;
        
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
            
            const itemPromotionAmount = getItemPromotionAmount(itemIndex);
            
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
      if (!cartItems.length || !promotions.length) {
        setAutoPromotion(null);
        return;
      }

      // ✅ FIXED: Calculate BOGO promotions AND regular item promotions separately
      const bogoGroupPromotions = new Map();
      const regularItemPromotions = new Map();
      
      const hasBogoItems = cartItems.some(item => item.isFromBogo);
      
      if (hasBogoItems) {
        const bogoGroups = new Map();
        
        cartItems.forEach((item, itemIndex) => {
          if (item.isFromBogo && item.bogoGroupId) {
            if (!bogoGroups.has(item.bogoGroupId)) {
              bogoGroups.set(item.bogoGroupId, []);
            }
            bogoGroups.get(item.bogoGroupId).push({ item, itemIndex });
          }
        });
        
        console.log(`📊 Found ${bogoGroups.size} BOGO groups:`, Array.from(bogoGroups.keys()));
        
        bogoGroups.forEach((groupItems, groupId) => {
          const firstItem = groupItems[0].item;
          const bogoPromo = promotions.find(p => p.id === firstItem.bogoPromoId);
          
          if (!bogoPromo) return;
          
          const bogoProducts = bogoPromo.products.split(',').map(p => p.trim());
          
          if (bogoProducts.length === 1) {
            const productItems = groupItems.filter(gi => gi.item.name === bogoProducts[0]);
            if (productItems.length === 0) return;
            
            const totalQty = productItems.reduce((sum, gi) => sum + gi.item.quantity, 0);
            const buyQty = bogoPromo.buyQuantity || 1;
            const getQty = bogoPromo.getQuantity || 1;
            const bundleSize = buyQty + getQty;
            const numBundles = Math.floor(totalQty / bundleSize);
            const itemsToDiscount = numBundles * getQty;
            
            if (itemsToDiscount > 0) {
              let bogoDiscount = 0;
              const itemPrice = productItems[0].item.price;
              
              if (firstItem.bogoDiscountType === 'percentage') {
                bogoDiscount = itemsToDiscount * (itemPrice * (firstItem.bogoDiscountValue / 100));
              } else {
                bogoDiscount = itemsToDiscount * Math.min(itemPrice, firstItem.bogoDiscountValue);
              }
              
              const itemPromotions = productItems.map(pi => ({
                itemIndex: pi.itemIndex,
                quantity: Math.floor(pi.item.quantity * (itemsToDiscount / totalQty)),
                promotionAmount: bogoDiscount * (pi.item.quantity / totalQty),
                promotionName: firstItem.bogoPromoName
              }));
              
              bogoGroupPromotions.set(groupId, {
                groupId,
                promoId: bogoPromo.id,
                name: firstItem.bogoPromoName,
                discountAmount: bogoDiscount,
                itemPromotions: itemPromotions
              });
            }
          // In cartPanel.jsx, around line 420-470
// Replace the 2-product BOGO calculation with this:

} else if (bogoProducts.length === 2) {
  const buyProductItems = groupItems.filter(gi => gi.item.name === bogoProducts[0]);
  const getProductItems = groupItems.filter(gi => gi.item.name === bogoProducts[1]);
  
  if (buyProductItems.length === 0 || getProductItems.length === 0) return;
  
  const buyTotalQty = buyProductItems.reduce((sum, gi) => sum + gi.item.quantity, 0);
  const getTotalQty = getProductItems.reduce((sum, gi) => sum + gi.item.quantity, 0);
  
  const buyQty = bogoPromo.buyQuantity || 1;
  const getQty = bogoPromo.getQuantity || 1;
  const bogoSets = Math.floor(buyTotalQty / buyQty);
  const itemsToDiscount = Math.min(getTotalQty, bogoSets * getQty);
  
  if (itemsToDiscount > 0) {
    const getItemPrice = getProductItems[0].item.price;
    const buyItemPrice = buyProductItems[0].item.price;
    
    // ✅ FIXED: Apply promotion to BOTH buy and get items
    let getItemDiscount = 0;
    let buyItemDiscount = 0;
    
    // Calculate discount on "get" items (usually the bigger discount)
    if (firstItem.bogoDiscountType === 'percentage') {
      getItemDiscount = itemsToDiscount * (getItemPrice * (firstItem.bogoDiscountValue / 100));
      // Small discount on "buy" items (optional, for BOGO display consistency)
      buyItemDiscount = bogoSets * (buyItemPrice * 0.05); // 5% on buy items
    } else {
      getItemDiscount = itemsToDiscount * Math.min(getItemPrice, firstItem.bogoDiscountValue);
      buyItemDiscount = bogoSets * Math.min(buyItemPrice * 0.05, 10); // Max ₱10 on buy items
    }
    
    const totalDiscount = getItemDiscount + buyItemDiscount;
    
    // ✅ FIXED: Create item promotions for BOTH products
    const itemPromotions = [];
    
    // Add promotions for "buy" items
    buyProductItems.forEach(pi => {
      const buyItemShare = (pi.item.quantity / buyTotalQty) * buyItemDiscount;
      const buyItemQty = Math.floor((pi.item.quantity / buyTotalQty) * bogoSets);
      
      if (buyItemQty > 0) {
        itemPromotions.push({
          itemIndex: pi.itemIndex,
          quantity: buyItemQty,
          promotionAmount: buyItemShare,
          promotionName: firstItem.bogoPromoName
        });
      }
    });
    
    // Add promotions for "get" items  
    getProductItems.forEach(pi => {
      const getItemShare = (pi.item.quantity / getTotalQty) * getItemDiscount;
      const getItemQty = Math.floor((pi.item.quantity / getTotalQty) * itemsToDiscount);
      
      if (getItemQty > 0) {
        itemPromotions.push({
          itemIndex: pi.itemIndex,
          quantity: getItemQty,
          promotionAmount: getItemShare,
          promotionName: firstItem.bogoPromoName
        });
      }
    });
    
    bogoGroupPromotions.set(groupId, {
      groupId,
      promoId: bogoPromo.id,
      name: firstItem.bogoPromoName,
      discountAmount: totalDiscount, // ✅ Total of both buy and get discounts
      itemPromotions: itemPromotions // ✅ Now includes BOTH products
    });
  }
}
        });
      }

      // ✅ FIXED: Calculate promotions for NON-BOGO items
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

      for (const promo of parsedPromotions) {
        if (!Array.isArray(promo.selectedProducts)) continue;
        
        // ✅ FIXED: Only apply to NON-BOGO items
        const eligibleItems = cartItems.filter((item, itemIndex) => {
          if (item.type !== 'product') return false;
          if (item.isFromBogo) return false; // ✅ Skip BOGO items
          
          if (promo.applicationType === 'all_products') {
            return true;
          }
          
          if (promo.applicationType === 'specific_categories') {
            return promo.selectedProducts.includes(item.category);
          }
          
          if (promo.applicationType === 'specific_products') {
            const matchesProductName = promo.selectedProducts.includes(item.name);
            const matchesCategory = promo.selectedProducts.includes(item.category);
            return matchesProductName || matchesCategory;
          }
          
          return false;
        });
        
        if (!eligibleItems.length) continue;

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
              
              const currentBest = regularItemPromotions.get(itemIndex);
              const shouldReplace = !currentBest || itemPromotionAmount > currentBest.discount;
              
              if (shouldReplace) {
                regularItemPromotions.set(itemIndex, {
                  itemIndex: itemIndex,
                  promo: promo,
                  discount: itemPromotionAmount,
                  priority: promo.priority,
                  quantity: eligibleQty
                });
              }
            }
          });
        }
      }
      
      // ✅ FIXED: Combine BOTH BOGO and regular promotions
      const allItemPromotions = [];
      let totalDiscountAmount = 0;
      const promotionNames = [];
      
      bogoGroupPromotions.forEach((promoData) => {
        totalDiscountAmount += promoData.discountAmount;
        promotionNames.push(promoData.name);
        allItemPromotions.push(...promoData.itemPromotions);
      });
      
      regularItemPromotions.forEach((bestPromoData) => {
        totalDiscountAmount += bestPromoData.discount;
        promotionNames.push(bestPromoData.promo.original.name);
        
        allItemPromotions.push({
          itemIndex: bestPromoData.itemIndex,
          quantity: bestPromoData.quantity,
          promotionAmount: bestPromoData.discount,
          promotionName: bestPromoData.promo.original.name
        });
      });
      
      if (allItemPromotions.length > 0) {
        setAutoPromotion({
          name: promotionNames.length > 1 ? promotionNames.join(' + ') : promotionNames[0],
          discountAmount: totalDiscountAmount,
          itemPromotions: allItemPromotions,
          isMultiPromotion: promotionNames.length > 1,
          promotionsUsed: promotionNames,
          bogoGroups: Array.from(bogoGroupPromotions.values())
        });
        
        console.log(`🎯 Applied ${bogoGroupPromotions.size} BOGO + ${regularItemPromotions.size} regular promotion(s) - Total: ₱${totalDiscountAmount.toFixed(2)}`);
      } else {
        setAutoPromotion(null);
      }
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

  const applyDiscountWithItems = (discountData) => {
    setAutoPromotion(null);
    setAppliedDiscounts(prev => [...prev, discountData]);
    setShowDiscountsModal(false);
  };

  const removeDiscount = (discountIndex) => {
    setAppliedDiscounts(prev => prev.filter((_, idx) => idx !== discountIndex));
  };

  const removeAllDiscounts = () => setAppliedDiscounts([]);

  // ✅ FIX: Updated openAddonsModal to handle instances
  const openAddonsModal = async (itemIndex, instanceId = null) => {
    const item = cartItems[itemIndex];
    if (!item || !item.id) return;
    
    setSelectedItemIndex(itemIndex);
    setSelectedInstanceId(instanceId); // Track which instance we're editing
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
      
      // ✅ Load addons for this specific instance or the main item
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

  // ✅ FIX: Updated saveAddons to handle instances
  const saveAddons = () => {
    if (selectedItemIndex !== null) {
      const updatedCart = [...cartItems];
      
      // If editing a BOGO instance, we need special handling
      if (selectedInstanceId) {
        // The addons are already set correctly for this instance
        // because group.items contains individual instances
        updatedCart[selectedItemIndex].addons = addons;
      } else {
        // Regular item
        updatedCart[selectedItemIndex].addons = addons;
      }
      
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

  const updateBogoGroupQuantity = async (promoId, change) => {
    const groupItems = cartItems.filter(item => item.bogoPromoId === promoId);
    if (groupItems.length === 0) return;

    const firstItem = groupItems[0];
    const bogoPromo = promotions.find(p => p.id === firstItem.bogoPromoId);
    if (!bogoPromo) return;

    const buyQty = bogoPromo.buyQuantity || 1;
    const getQty = bogoPromo.getQuantity || 1;
    const bundleSize = buyQty + getQty;

    if (change < 0) {
      // Decreasing: remove one complete bundle
      setCartItems(prev => {
        let updatedCart = [...prev];
        const bogoProducts = bogoPromo.products.split(',').map(p => p.trim());

        if (bogoProducts.length === 1) {
          // Same product BOGO - remove bundleSize instances
          const itemsToUpdate = updatedCart.filter(item => 
            item.bogoPromoId === promoId && item.name === bogoProducts[0]
          );
          
          let remaining = bundleSize;
          for (let i = itemsToUpdate.length - 1; i >= 0 && remaining > 0; i--) {
            const itemIndex = updatedCart.findIndex(ci => ci.cartId === itemsToUpdate[i].cartId);
            if (itemIndex === -1) continue;

            const item = updatedCart[itemIndex];
            // ✅ Each instance has quantity: 1, so just remove it
            if (item.quantity <= 1) {
              updatedCart = updatedCart.filter((_, idx) => idx !== itemIndex);
              remaining -= 1;
            } else {
              // This shouldn't happen with instance-based items
              updatedCart[itemIndex] = { ...item, quantity: item.quantity - 1 };
              remaining -= 1;
            }
          }
        } else if (bogoProducts.length === 2) {
          // Different products BOGO
          const buyItems = updatedCart.filter(item => 
            item.bogoPromoId === promoId && item.name === bogoProducts[0]
          );
          const getItems = updatedCart.filter(item => 
            item.bogoPromoId === promoId && item.name === bogoProducts[1]
          );

          // Remove buyQty instances from buy products
          for (let i = 0; i < buyQty && buyItems.length > 0; i++) {
            const itemToRemove = buyItems[buyItems.length - 1 - i];
            const itemIndex = updatedCart.findIndex(ci => ci.cartId === itemToRemove.cartId);
            if (itemIndex !== -1) {
              updatedCart = updatedCart.filter((_, idx) => idx !== itemIndex);
            }
          }

          // Remove getQty instances from get products
          for (let i = 0; i < getQty && getItems.length > 0; i++) {
            const itemToRemove = getItems[getItems.length - 1 - i];
            const itemIndex = updatedCart.findIndex(ci => ci.cartId === itemToRemove.cartId);
            if (itemIndex !== -1) {
              updatedCart = updatedCart.filter((_, idx) => idx !== itemIndex);
            }
          }
        }

        return updatedCart;
      });
    } else {
      // Increasing: add one complete bundle (instances already created in cart)
      // This requires the BOGO modal to add items with quantity: 1 each time
      console.log('⚠️ To add a BOGO bundle, add items individually from the BOGO modal');
    }
  };

  // ✅ NEW: Function to remove entire BOGO group (by promoId)
  const removeBogoGroup = (promoId) => {
    setCartItems(prev => {
      const filtered = prev.filter(item => item.bogoPromoId !== promoId);
      
      const removedIndices = prev
        .map((item, idx) => item.bogoPromoId === promoId ? idx : -1)
        .filter(idx => idx !== -1);
      
      setAppliedDiscounts(prevDiscounts => 
        prevDiscounts.filter(d => 
          !removedIndices.some(idx => d.selectedItemsQty?.[idx])
        )
      );
      
      if (autoPromotion && autoPromotion.itemPromotions) {
        const hasRemovedItems = autoPromotion.itemPromotions.some(p => 
          removedIndices.includes(p.itemIndex)
        );
        if (hasRemovedItems) {
          setAutoPromotion(null);
        }
      }
      
      return filtered;
    });
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
        toast.error(`Cannot increase quantity for "${currentItem.name}".\n\n${conflictMessages}`);
        return;
      }
    }
    
    setCartItems(prev => {
      const updated = [...prev];
      if (amount > 0 && currentItem.maxQuantity && newQuantity > currentItem.maxQuantity) {
        toast.error(`Maximum quantity of ${currentItem.maxQuantity} reached for ${currentItem.name}.`);
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
          toast.error(`Cannot reduce quantity below ${totalDiscountedQty}. Remove discounts first.`);
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
      toast.error('Please add items to your cart before processing.');
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
    toast.error("Authentication error. Please log in again.");
    setIsProcessing(false);
    return;
  }
  
  // ✅ CRITICAL FIX: Build appliedPromotions to include ALL promotion types
  let appliedPromotions = [];
  
  if (autoPromotion && autoPromotion.itemPromotions && autoPromotion.itemPromotions.length > 0) {
    // Group promotions by their actual promotion name to find unique promotions
    const promotionGroups = new Map();
    
    autoPromotion.itemPromotions.forEach(itemPromo => {
      const promoName = itemPromo.promotionName || autoPromotion.name;
      
      if (!promotionGroups.has(promoName)) {
        promotionGroups.set(promoName, {
          promotionName: promoName,
          promotionId: 0, // Will be determined later
          itemPromotions: []
        });
      }
      
      promotionGroups.get(promoName).itemPromotions.push({
        itemIndex: itemPromo.itemIndex,
        quantity: itemPromo.quantity,
        promotionAmount: itemPromo.promotionAmount
      });
    });
    
    // Convert Map to array and try to find promotion IDs
    promotionGroups.forEach((promoData, promoName) => {
      // Try to find the promotion ID from the promotions list
      const matchingPromo = promotions.find(p => p.name === promoName);
      if (matchingPromo) {
        promoData.promotionId = matchingPromo.id;
      } else if (autoPromotion.bogoGroups) {
        // Check if it's a BOGO promotion
        const bogoGroup = autoPromotion.bogoGroups.find(bg => bg.name === promoName);
        if (bogoGroup) {
          promoData.promotionId = bogoGroup.promoId;
        }
      }
      
      appliedPromotions.push(promoData);
    });
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
    appliedPromotions: appliedPromotions, // ✅ Use the properly structured array
    promotionalDiscountAmount: promotionalDiscountValue,
    promotionalDiscountName: autoPromotion?.name || null,
    manualDiscountAmount: manualDiscountValue,
    gcashReference: gcashRef
  };
  
  console.log('📤 Sending sale data:', JSON.stringify(saleData, null, 2));
  
  try {
    const response = await fetch(`${SALES_API_URL}/auth/sales/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(saleData)
    });
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ Server error:', responseData);
      throw new Error(responseData.detail || 'Failed to process transaction.');
    }
    
    console.log('✅ Sale processed successfully:', responseData);
    setShowTransactionSummary(false);
    setShowGCashReference(false);
    setShowConfirmation(true);
    setCartItems([]);
    setAppliedDiscounts([]);
  } catch (err) {
    console.error('❌ Transaction error:', err);
    setError(err.message);
    toast.error(`Error: ${err.message}`);
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
              (() => {
                const groupedItems = groupCartItemsByPromotion(cartItems);

            return groupedItems.map((group, groupIndex) => {
                if (group.type === 'bogo') {
                  // Get BOGO promotion details
                  const firstItem = group.items[0].item;
                  const bogoPromo = promotions.find(p => p.id === firstItem.bogoPromoId);
                  const bogoProducts = bogoPromo ? bogoPromo.products.split(',').map(p => p.trim()) : [];
                  
                  // Create BOGO description
                  let bogoDescription = '';
                  if (bogoPromo && bogoProducts.length === 1) {
                    bogoDescription = `Buy ${bogoPromo.buyQuantity || 1}, Get ${bogoPromo.getQuantity || 1} ${bogoProducts[0]}`;
                  } else if (bogoPromo && bogoProducts.length === 2) {
                    bogoDescription = `Buy ${bogoPromo.buyQuantity || 1} ${bogoProducts[0]}, Get ${bogoPromo.getQuantity || 1} ${bogoProducts[1]}`;
                  }

                  return (
                    <div key={`bogo-${group.promoId}-${groupIndex}`} className="cart-bogo-single-item">
                      <div className="cart-item">
                        <img src={group.promoImage} alt={group.promoName} className="cart-bogo-promo-image" />
                        <div className="item-details">
                          <div className="item-name">{group.promoName}</div>
                          <div className="bogo-description">{bogoDescription}</div>
                          
                          {/* Show all items in this BOGO with their addons */}
                          <div className="bogo-items-list">
                            {group.items.map(({ item, instanceId }) => (
                              <div key={instanceId} className="bogo-item-row">
                                <div className="bogo-item-header">
                                  <span className="bogo-item-name">{item.name}</span>
                                  {group.items.filter(gi => gi.item.name === item.name).length > 1 && (
                                    <span className="instance-indicator">#{item.instanceNumber}</span>
                                  )}
                                  {item.type === 'product' && (
                                    <div 
                                      className="addons-link" 
                                      onClick={() => openAddonsModal(item.originalIndex, instanceId)}
                                    >
                                      Add on
                                    </div>
                                  )}
                                </div>
                                {item.addons && item.addons.length > 0 && (
                                  <div className="addons-summary">
                                    {item.addons.map(addon => (
                                      <span key={addon.addonId}>
                                        +₱{(addon.price * addon.quantity).toFixed(2)} : {addon.addonName} (x{addon.quantity})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="promodis-summary">
                            <span>
                              {group.discountType === 'percentage'
                                ? `${group.discountValue}% off`
                                : `₱${group.discountValue} off`}
                            </span>
                          </div>

                          <div className="flex-spacer" />
                          
                          <div className="qty-price">
                            <button onClick={() => updateBogoGroupQuantity(group.promoId, -1)}>
                              <FiMinus />
                            </button>
                            <span>{(() => {
                              const buyQty = bogoPromo ? (bogoPromo.buyQuantity || 1) : 1;
                              const getQty = bogoPromo ? (bogoPromo.getQuantity || 1) : 1;
                              const bundleSize = buyQty + getQty;
                              return Math.floor(group.items.length / bundleSize);
                            })()}</span>
                            <button onClick={() => updateBogoGroupQuantity(group.promoId, 1)}>
                              <FiPlus />
                            </button>
                            <span className="item-price">
                              ₱{group.items.reduce((sum, { item }) => 
                                sum + item.price + getTotalAddonsPrice(item.addons), 0
                              ).toFixed(0)}
                            </span>
                          </div>
                        </div>
                        <div className="item-actions">
                          <button 
                            className="remove-item" 
                            onClick={() => removeBogoGroup(group.promoId)}
                            title="Remove BOGO promotion"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Regular items - FULL RENDERING
                  const { item, index } = group.items[0];
                  return (
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
                  );
                }
              });
              })()
            ) : (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: '#999' }}>Your cart is empty.</div>
            )}
          </div>

          <div className="discount-section" onClick={openDiscountsModal}>
            <div className="discount-input-wrapper">
              <div className="discount-row">
                <input type="text" placeholder="Discounts:" readOnly />
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