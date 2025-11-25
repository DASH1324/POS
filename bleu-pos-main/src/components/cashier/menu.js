import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../navbar';
import CartPanel from './cartPanel.js';
import Loading from "../home/shared/loading";
import { toast } from 'react-toastify';
import './menu.css';

const API_BASE_URL = 'http://127.0.0.1:9001/api';
const PROMOTION_BASE_URL = 'http://127.0.0.1:9002/api';
const PRODUCTS_API_URL = 'http://127.0.0.1:8001';
const MERCHANDISE_API_URL = 'http://127.0.0.1:8002/merchandise/';

function Menu() {
  // State for UI and Cart
  const [selectedFilter, setSelectedFilter] = useState({ type: 'all', value: 'All Products' });
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Initial cash modal states
  const [showInitialCashModal, setShowInitialCashModal] = useState(false);
  const [initialCash, setInitialCash] = useState('');
  const [initialCashError, setInitialCashError] = useState('');

  // State for data fetching, loading, and errors
  const [products, setProducts] = useState([]);
  const [merchandise, setMerchandise] = useState([]);
  const [showMerchandise, setShowMerchandise] = useState(false);
  const [categories, setCategories] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- PROMOTIONS STATE ---
  const [promotions, setPromotions] = useState([]);
  const [discounts, setDiscounts] = useState([]); // ✅ NEW STATE FOR DISCOUNTS

  const [showBogoInfoModal, setShowBogoInfoModal] = useState(false);
  const [showBogoCongratsModal, setShowBogoCongratsModal] = useState(false);
  const [activeBogoPromo, setActiveBogoPromo] = useState(null);

  // State for order details
  const [orderType, setOrderType] = useState('Dine in');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // State for user info
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Cache for max quantities to avoid redundant API calls
  const [maxQuantityCache, setMaxQuantityCache] = useState({});

  const formatPromotionValue = (promo) => {
    if (promo.promotion_type === 'percentage') {
        return `${promo.promotion_value}%`;
    } else if (promo.promotion_type === 'fixed') {
        return `₱${promo.promotion_value}`;
    } else if (promo.promotion_type === 'bogo') {
        // For BOGO, format based on bogo_discount_type
        if (promo.bogo_discount_type === 'percentage') {
            return `${promo.bogo_discount_value}%`;
        } else if (promo.bogo_discount_type === 'fixed_amount') {
            return `₱${promo.bogo_discount_value}`;
        }
        return ''; // Free items in BOGO
    }
    return `${promo.promotion_value}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUsername = params.get('username');
    const urlToken = params.get('authorization');
    
    let activeToken = null;
    let activeUsername = null;

    if (urlUsername && urlToken) {
      localStorage.setItem('username', urlUsername);
      localStorage.setItem('authToken', urlToken);
      activeToken = urlToken;
      activeUsername = urlUsername;
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      activeToken = localStorage.getItem('authToken');
      activeUsername = localStorage.getItem('username');
    }

    if (activeUsername) {
      setLoggedInUser(activeUsername);
    }

    const fetchPromotions = async (token) => {
      try {
        const response = await fetch(`${PROMOTION_BASE_URL}/promotions/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch promotions.');
        }
        const data = await response.json();
        
        console.log("Raw API Response:", data);
        
        const transformedPromotions = data
          .filter(p => p.status === 'active')
          .map(promo => {
            console.log("Processing promotion:", promo);
            
            let promotionType = null;
            let buyQty = 1;
            let getQty = 1;
            let discountValue = 0;
            let bogoDiscountType = null;
            
            const typeStr = (promo.type || '').toUpperCase();
            
            if (typeStr.includes('BOGO')) {
              promotionType = 'bogo';
              const match = promo.type.match(/\((\d+)\+(\d+)\)/);
              if (match) {
                buyQty = parseInt(match[1]);
                getQty = parseInt(match[2]);
              }
            } else if (typeStr.includes('PERCENTAGE') || typeStr.includes('%')) {
              promotionType = 'percentage';
            } else if (typeStr.includes('FIXED') || typeStr.includes('₱')) {
              promotionType = 'fixed';
            }
            
            if (promo.value) {
              const numMatch = promo.value.match(/(\d+\.?\d*)/);
              if (numMatch) {
                discountValue = parseFloat(numMatch[0]);
              }
              
              if (promotionType === 'bogo') {
                if (promo.value.includes('%')) {
                  bogoDiscountType = 'percentage';
                } else if (promo.value.includes('₱') || promo.value.toLowerCase().includes('off')) {
                  bogoDiscountType = 'fixed_amount';
                }
              }
            }
            
            let productsList = [];
            let applicationType = 'specific_products';
            
            if (promo.products) {
              if (promo.products.toLowerCase() === 'all products') {
                applicationType = 'all_products';
                productsList = [];
              } else {
                productsList = promo.products.split(',').map(p => p.trim()).filter(Boolean);
              }
            }
            
            const transformed = {
              id: promo.id,
              name: promo.name,
              type: promotionType,
              promotion_type: promotionType,
              value: promo.value || '0',
              promotion_value: discountValue,
              products: promo.products || '',
              applicable_products: productsList,
              status: promo.status,
              validFrom: promo.validFrom,
              validTo: promo.validTo,
              valid_from: promo.validFrom,
              valid_to: promo.validTo,
              application_type: applicationType,
              buyQuantity: buyQty,
              getQuantity: getQty,
              buy_quantity: buyQty,
              get_quantity: getQty,
              bogoDiscountType: bogoDiscountType,
              bogo_discount_type: bogoDiscountType,
              bogo_discount_value: promotionType === 'bogo' ? discountValue : null,
              discountValue: discountValue
            };
            
            console.log("Transformed promotion:", transformed);
            return transformed;
          });
        
        setPromotions(transformedPromotions);
        console.log("Active promotions loaded and transformed:", transformedPromotions);
      } catch (error) {
        console.error("Error fetching promotions:", error.message);
      }
    };

    const initializeData = async (token, username) => {
      setIsLoading(true);
      setError(null);

      if (!token || !username) {
        setError("Authorization Error. Please log in.");
        setIsLoading(false);
        return;
      }
      
      try {
        await checkCashierSession(token, username);
        
        const headers = { 'Authorization': `Bearer ${token}` };
        const [detailsResponse, productsResponse] = await Promise.all([
          fetch(`${PRODUCTS_API_URL}/is_products/products/details/`, { headers }),
          fetch(`${PRODUCTS_API_URL}/is_products/products/`, { headers })
        ]);
        
        if (detailsResponse.status === 401 || productsResponse.status === 401) {
          throw new Error("Your session is invalid or has expired. Please log in again.");
        }
        if (!detailsResponse.ok || !productsResponse.ok) {
          throw new Error(`Failed to fetch product data.`);
        }
        
        const apiDetails = await detailsResponse.json();
        const apiProducts = await productsResponse.json(); 

        const imageMap = apiProducts.reduce((map, product) => {
          map[product.ProductName] = product.ProductImage;
          return map;
        }, {});

        const placeholderImage = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93';
        
        const mappedProducts = apiDetails.map(p => ({
          id: p.ProductID,
          name: p.ProductName,
          description: p.Description,
          price: p.Price,
          category: p.ProductCategory,
          status: p.Status,
          image: imageMap[p.ProductName] || placeholderImage, 
          sizes: p.Sizes,
          hasAddons: p.HasAddOns,
        }));
        
        setProducts(mappedProducts);

        const dynamicCategories = {};
        apiDetails.forEach(p => {
          const group = p.ProductTypeName.toUpperCase();
          const category = p.ProductCategory;
          if (!dynamicCategories[group]) dynamicCategories[group] = [];
          if (!dynamicCategories[group].includes(category)) dynamicCategories[group].push(category);
        });
        setCategories(dynamicCategories);

      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeToken && activeUsername) {
        initializeData(activeToken, activeUsername);
        fetchPromotions(activeToken);
    }

  }, []);

  const fetchMerchandise = async () => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError("Authorization Error. Please log in.");
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch(`${MERCHANDISE_API_URL}menu`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.status === 401) {
        throw new Error("Your session is invalid or has expired. Please log in again.");
      }
      if (!response.ok) {
        throw new Error('Failed to fetch merchandise.');
      }
      const data = await response.json();
      setMerchandise(data);
      setShowMerchandise(true);
      setSelectedFilter({ type: 'merchandise', value: 'Merchandise' });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const checkCashierSession = async (token, cashierName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/session/status?cashier_name=${encodeURIComponent(cashierName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to check cashier session.');
      }
      const data = await response.json();
      if (!data.hasActiveSession) {
        setShowInitialCashModal(true);
      }
    } catch (err) {
      console.error("Session check error:", err);
      setError("Could not verify session status. Please try refreshing.");
    }
  };

  useEffect(() => {
    setIsCartOpen(cartItems.length > 0);
  }, [cartItems.length]);

  const filterProducts = useCallback(() => {
    let filtered = [];
    if (selectedFilter.type === 'all') {
      filtered = products;
    } else if (selectedFilter.type === 'group' && categories[selectedFilter.value]) {
      filtered = products.filter(p => categories[selectedFilter.value].includes(p.category));
    } else if (selectedFilter.type === 'item') {
      filtered = products.filter(p => p.category === selectedFilter.value);
    }
    
    return filtered.sort((a, b) => {
      const aUnavailable = a.status === 'Unavailable';
      const bUnavailable = b.status === 'Unavailable';
      if (aUnavailable && !bUnavailable) return 1;
      if (!aUnavailable && bUnavailable) return -1;
      return 0;
    });
  }, [selectedFilter, products, categories]);

  const filteredProducts = useMemo(() => filterProducts(), [filterProducts]);

  const getDynamicMaxQuantity = useCallback(async (productName, category, productId) => {
    const cacheKey = `${productId}-${cartItems.length}-${cartItems.map(i => `${i.id}:${i.quantity}`).join(',')}`;
    
    if (maxQuantityCache[cacheKey]) {
      return maxQuantityCache[cacheKey];
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No auth token found');
      return null;
    }

    try {
      let actualProductId = productId;
      
      if (!actualProductId) {
        const lookupResponse = await fetch(`${PRODUCTS_API_URL}/is_products/products/lookup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            productName: productName,
            category: category
          })
        });

        if (!lookupResponse.ok) {
          console.error('Failed to lookup product ID');
          return null;
        }

        const lookupData = await lookupResponse.json();
        actualProductId = lookupData.productId;
      }

      const maxQtyResponse = await fetch(
        `${PRODUCTS_API_URL}/is_products/products/${actualProductId}/dynamic-max-quantity`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cart_items: cartItems
          })
        }
      );

      if (!maxQtyResponse.ok) {
        console.error('Failed to fetch dynamic max quantity');
        return null;
      }

      const maxQtyData = await maxQtyResponse.json();
      const result = {
        maxQuantity: maxQtyData.maxQuantity,
        limitedBy: maxQtyData.limitedBy,
        productName: maxQtyData.productName
      };

      setMaxQuantityCache(prev => ({ ...prev, [cacheKey]: result }));
      
      return result;

    } catch (error) {
      console.error('Error fetching dynamic max quantity:', error);
      return null;
    }
  }, [cartItems, maxQuantityCache]);

  const checkInventoryConflicts = useCallback(async (newProductId) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No auth token found');
      return { canAdd: true, conflicts: [] };
    }

    try {
      const response = await fetch(
        `${PRODUCTS_API_URL}/is_products/products/check-cart-conflicts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cart_items: cartItems,
            new_product_id: newProductId
          })
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
  }, [cartItems]);

  const addToCart = useCallback(async (item, type = 'product') => {
    console.log('=== ADD TO CART CALLED ===');
    console.log('Item:', item.name, 'Status:', item.status, 'Type:', type);
    
    if (item.Status === 'Not Available' || item.status === 'Unavailable') {
      console.log('Product is unavailable, blocking add to cart');
      return;
    }

    if (type === 'product') {
      const conflictCheck = await checkInventoryConflicts(item.id);
      
      if (!conflictCheck.canAdd) {
        const conflictMessages = conflictCheck.conflicts.map(c => 
          `• ${c.type.toUpperCase()}: ${c.name}\n  Needs ${c.needed}, only ${c.available} available\n  Conflicts with: "${c.conflictsWith}"`
        ).join('\n\n');
        
        alert(`❌ Cannot add "${item.name}" to cart.\n\nShared limited resources:\n\n${conflictMessages}`);
        return;
      }

      const maxQtyInfo = await getDynamicMaxQuantity(item.name, item.category, item.id);
      
      if (maxQtyInfo && maxQtyInfo.maxQuantity === 0) {
        alert(`Cannot add ${item.name}. ${maxQtyInfo.limitedBy || 'Insufficient stock'}`);
        return;
      }

      let previousBogoCompleted = false;
      let isFirstAdd = false;
      let wasBogoAlreadyStarted = false;
      const bogoPromo = promotions.find(p => {
        console.log("Checking promo:", p.name, "Type:", p.type, "Products:", p.products);

        if (!p.type || p.type !== 'bogo') {
          console.log("  - Skipped: not BOGO type");
          return false;
        }

        if (!p.products) {
          console.log("  - Skipped: no products");
          return false;
        }

        const applicableProducts = p.products.split(',').map(name => name.trim());
        const isApplicable = applicableProducts.includes(item.name);

        console.log("  - Applicable products:", applicableProducts);
        console.log("  - Current item:", item.name);
        console.log("  - Is applicable:", isApplicable);

        return isApplicable;
      });

      console.log("Found BOGO promo for", item.name, ":", bogoPromo)

      if (bogoPromo) {
        const buyQuantity = bogoPromo.buyQuantity;
        const getQuantity = bogoPromo.getQuantity;
        const requiredTotal = buyQuantity + getQuantity;

        const applicableProducts = bogoPromo.products.split(',').map(name => name.trim());
        const buyItemName = applicableProducts[0];
        const getItemName = applicableProducts.length > 1 ? applicableProducts[1] : buyItemName;

        const hasBuyItem = cartItems.some(cartItem => cartItem.name === buyItemName);
        const hasGetItem = cartItems.some(cartItem => cartItem.name === getItemName);
        wasBogoAlreadyStarted = hasBuyItem || hasGetItem;

        isFirstAdd = !wasBogoAlreadyStarted;

        if (buyItemName === getItemName) {
          const currentItemInCart = cartItems.find(cartItem => cartItem.name === item.name);
          const currentQuantity = currentItemInCart ? currentItemInCart.quantity : 0;
          previousBogoCompleted = currentQuantity >= requiredTotal;
        } else {
          const buyItemsInCart = cartItems.find(cartItem => cartItem.name === buyItemName);
          const getItemsInCart = cartItems.find(cartItem => cartItem.name === getItemName);
          const buyQty = buyItemsInCart ? buyItemsInCart.quantity : 0;
          const getQty = getItemsInCart ? getItemsInCart.quantity : 0;

          const bogoSets = Math.floor(buyQty / buyQuantity);
          const eligibleGetItems = bogoSets * getQuantity;
          previousBogoCompleted = (buyQty >= buyQuantity && getQty >= eligibleGetItems);
        }
      }

      setCartItems(prev => {
        const existingIndex = prev.findIndex(cartItem => 
          cartItem.id === item.id && 
          cartItem.type === 'product' && 
          (!cartItem.addons || cartItem.addons.length === 0)
        );

        let updatedCart;
        
        if (existingIndex !== -1) {
          const currentQty = prev[existingIndex].quantity;
          const maxQty = maxQtyInfo ? maxQtyInfo.maxQuantity : 999;
          
          if (currentQty >= maxQty) {
            alert(`Maximum quantity of ${maxQty} reached for ${item.name}. ${maxQtyInfo?.limitedBy || ''}`);
            return prev;
          }

          updatedCart = [...prev];
          const newQuantity = currentQty + 1;
          updatedCart[existingIndex] = {
            ...updatedCart[existingIndex],
            quantity: newQuantity,
            maxQuantity: maxQty,
            limitedBy: maxQtyInfo?.limitedBy
          };
        } else {
          const maxQty = maxQtyInfo ? maxQtyInfo.maxQuantity : 999;
          const newCartItem = { 
            ...item, 
            quantity: 1, 
            type: 'product', 
            addons: [],
            maxQuantity: maxQty,
            limitedBy: maxQtyInfo?.limitedBy,
            cartId: Date.now() + Math.random()
          };
          updatedCart = [...prev, newCartItem];
        }

        if (bogoPromo && !previousBogoCompleted) {
          const buyQuantity = bogoPromo.buyQuantity;
          const getQuantity = bogoPromo.getQuantity;

          const applicableProducts = bogoPromo.products.split(',').map(name => name.trim());
          const buyItemName = applicableProducts[0];
          const getItemName = applicableProducts.length > 1 ? applicableProducts[1] : buyItemName;

          let isNowCompleted = false;

          if (buyItemName === getItemName) {
            const requiredTotal = buyQuantity + getQuantity;
            const currentItemInCart = updatedCart.find(cartItem => cartItem.name === buyItemName);
            const currentQuantity = currentItemInCart ? currentItemInCart.quantity : 0;

            if (currentQuantity >= requiredTotal) {
              isNowCompleted = true;
            }
          } else {
            const buyItemsInCart = updatedCart.find(cartItem => cartItem.name === buyItemName);
            const getItemsInCart = updatedCart.find(cartItem => cartItem.name === getItemName);
            const buyQty = buyItemsInCart ? buyItemsInCart.quantity : 0;
            const getQty = getItemsInCart ? getItemsInCart.quantity : 0;

            if (buyQty >= buyQuantity && getQty >= getQuantity) {
              isNowCompleted = true;
            }
          }

          if (isNowCompleted) {
            console.log("BOGO Promotion completed! Showing congratulations modal:", bogoPromo);

            const valueMatch = bogoPromo.value.match(/(\d+\.?\d*)/);
            const discountValue = valueMatch ? valueMatch[0] : '0';
            const isPercentage = bogoPromo.value.includes('%');

            setTimeout(() => {
              setActiveBogoPromo({
                ...bogoPromo,
                congratsMessage: `Congratulations! You've completed the ${bogoPromo.type} promotion and received ${discountValue}${isPercentage ? '%' : '₱'} discount!`
              });
              setShowBogoCongratsModal(true);
            }, 100);
          }
        }

        return updatedCart;
      });

      if (bogoPromo && isFirstAdd && !previousBogoCompleted) {
        console.log("First BOGO product added, showing info modal:", bogoPromo);
        setActiveBogoPromo(bogoPromo);
        setShowBogoInfoModal(true);
      }

    } else if (type === 'merchandise') {
      setCartItems(prev => {
        const existingIndex = prev.findIndex(cartItem => 
          cartItem.id === item.MerchandiseID && cartItem.type === 'merchandise'
        );
      
        if (existingIndex !== -1) {
          const updatedCart = [...prev];
          if (updatedCart[existingIndex].quantity >= item.MerchandiseQuantity) {
            alert(`Maximum stock of ${item.MerchandiseQuantity} reached for ${item.MerchandiseName}`);
            return prev;
          }
          updatedCart[existingIndex] = {
            ...updatedCart[existingIndex],
            quantity: updatedCart[existingIndex].quantity + 1
          };
          return updatedCart;
        } else {
          return [...prev, { 
            id: item.MerchandiseID, 
            name: item.MerchandiseName, 
            price: item.MerchandisePrice, 
            quantity: 1, 
            type: 'merchandise',
            image: item.MerchandiseImage,
            category: 'Merchandise',
            addons: [],
            maxQuantity: item.MerchandiseQuantity,
            cartId: Date.now() + Math.random()
          }];
        }
      });
    }
  }, [checkInventoryConflicts, getDynamicMaxQuantity, promotions, cartItems]);

  const handleInitialCashSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(initialCash);
    if (isNaN(amount) || amount < 0) {
      setInitialCashError('Please enter a valid non-negative number.');
      return;
    }
    setInitialCashError('');  

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      const formData = new FormData();
      formData.append('initial_cash', amount);

      const response = await fetch(`${API_BASE_URL}/session/start`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit initial cash.');
      }
      
      console.log(`Initial cash of ₱${amount.toFixed(2)} submitted successfully.`);
      setShowInitialCashModal(false);
      toast.success(`Initial cash of ₱${amount.toFixed(2)} submitted successfully`);
      
    } catch (err) {
      setInitialCashError(err.message);
      toast.error(`Failed to submit initial cash: ${err.message}`);
    }
  };

  const ProductList = React.memo(({ products, addToCart }) => {
    return (
      <div className="menu-product-grid">
        {products.map(product => (
          <div key={`${product.category}-${product.name}`} className="menu-product-item">
            {product.status === 'Unavailable' && (
              <div className="menu-product-unavailable-overlay">
                <span>Unavailable</span>
              </div>
            )}
            <div className="menu-product-main">
              <div className="menu-product-img-container">
                <img src={product.image} alt={product.name} /> 
              </div>
              <div className="menu-product-details">
                <div className="menu-product-title">{product.name}</div>
                <div className="menu-product-category">
                  {product.category}
                  {product.sizes && product.sizes.length > 0 ? ` - ${product.sizes.map(s => `${s} oz`).join(', ')}` : ''}
                </div>
                <div className="menu-product-price">₱{product.price.toFixed(2)}</div>
              </div>
            </div>
            <button 
              className="menu-add-button" 
              onClick={() => addToCart(product)}
              disabled={product.status === 'Unavailable'}
            >
              Add Product
            </button>
          </div>
        ))}
      </div>
    );
  });

  const MerchandiseList = React.memo(({ merchandise, addToCart }) => {
    const placeholderImage = 'https://via.placeholder.com/150';

    return (
      <div className="menu-product-grid">
        {merchandise.map(item => (
          <div key={item.MerchandiseID} className="menu-product-item">
            {(item.Status === 'Not Available' || item.MerchandiseQuantity <= 0) && (
              <div className="menu-product-unavailable-overlay">
                <span>{item.MerchandiseQuantity <= 0 ? 'Out of Stock' : 'Not Available'}</span>
              </div>
            )}
            <div className="menu-product-main">
              <div className="menu-product-img-container">
                <img src={item.MerchandiseImage || placeholderImage} alt={item.MerchandiseName} />
              </div>
              <div className="menu-product-details">
                <div className="menu-product-title">{item.MerchandiseName}</div>
                <div className="menu-product-category">Quantity: {item.MerchandiseQuantity}</div>
                <div className="menu-product-price">₱{item.MerchandisePrice.toFixed(2)}</div>
              </div>
            </div>
            <button
              className="menu-add-button"
              onClick={() => addToCart(item, 'merchandise')}
              disabled={item.Status === 'Not Available'}
            >
              Add Merchandise
            </button>
          </div>
        ))}
      </div>
    );
  });

  const renderMainContent = () => {
    if (error && error.includes("Authorization Error")) return <div className="menu-status-container">{error}</div>;
    if (error && error.includes("session is invalid")) return <div className="menu-status-container">{error}</div>;
    if (error) return <div className="menu-status-container">Error: {error}</div>;
    if (showMerchandise) {
      return (
        <>
          <div className="menu-product-list-header">
            <h2 className="menu-selected-category-title">Merchandise</h2>
          </div>
          <div className="menu-product-grid-container">
            <MerchandiseList merchandise={merchandise} addToCart={addToCart} />
          </div>
        </>
      );
    }
    if (filteredProducts.length > 0) {
      return (
        <>
          <div className="menu-product-list-header">
            <h2 className="menu-selected-category-title">
              {selectedFilter.value.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </h2>
          </div>
          <div className="menu-product-grid-container">
            <ProductList products={filteredProducts} addToCart={addToCart} />
          </div>
        </>
      );
    }
    return <div className="menu-no-products">No items in this category.</div>;
  };

  return (
    <div className="menu-page">
      <Navbar user={loggedInUser} isCartOpen={isCartOpen} />

      {showInitialCashModal && <div className="initialCash-modal-blocker" />}

      {showInitialCashModal && (
        <div className="initialCash-modal-overlay">
          <div className="initialCash-modal-container">
            <div className="initialCash-modal-title">Enter Initial Cash in Drawer</div>
            <div className="initialCash-modal-description">
              Please input the initial amount of cash in the drawer to start your shift.
            </div>
            <form onSubmit={handleInitialCashSubmit}>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="₱0.00"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                className="initialCash-input"
                autoFocus
              />
              {initialCashError && (
                <div className="initialCash-error">{initialCashError}</div>
              )}
              <button type="submit" className="initialCash-submit-btn">
                Confirm
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- BOGO INFO MODAL (FIRST ADD) --- */}
      {showBogoInfoModal && activeBogoPromo && (
        <div className="initialCash-modal-overlay">
          <div className="initialCash-modal-container">
            <div className="initialCash-modal-title">Promotional Offer!</div>
            <div className="initialCash-modal-description" style={{textAlign: "left", alignSelf: 'stretch', padding: "0 20px"}}>
              This product is part of the <strong>"{activeBogoPromo.name}"</strong> promotion ({activeBogoPromo.type}).
              <br/><br/>
              <strong>Discount:</strong> {activeBogoPromo.value}
              <br/><br/>
              Add the required products to the cart to receive the promotional discount.
              <br/><br/>
              <strong>Eligible Products:</strong> {activeBogoPromo.products}
            </div>
            <button
              onClick={() => {
                setShowBogoInfoModal(false);
                setActiveBogoPromo(null);
              }}
              className="initialCash-submit-btn"
              style={{marginTop: "20px"}}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* --- BOGO CONGRATULATIONS MODAL (COMPLETION) --- */}
      {showBogoCongratsModal && activeBogoPromo && (
        <div className="initialCash-modal-overlay">
          <div className="initialCash-modal-container">
            <div className="initialCash-modal-title" style={{color: '#4CAF50'}}>
              🎉 Congratulations! 🎉
            </div>
            <div className="initialCash-modal-description" style={{textAlign: "center", alignSelf: 'stretch', padding: "0 20px"}}>
              <strong>{activeBogoPromo.congratsMessage || `You've completed the ${activeBogoPromo.type} promotion!`}</strong>
              <br/><br/>
              <div style={{textAlign: "left"}}>
                <strong>Promotion:</strong> {activeBogoPromo.name}
                <br/>
                <strong>Type:</strong> {activeBogoPromo.type}
                <br/>
                <strong>Discount:</strong> {activeBogoPromo.value}
                <br/>
                <strong>Products:</strong> {activeBogoPromo.products}
              </div>
              <br/>
              <em>The discount will be automatically applied at checkout!</em>
            </div>
            <button
              onClick={() => {
                setShowBogoCongratsModal(false);
                setActiveBogoPromo(null);
              }}
              className="initialCash-submit-btn"
              style={{marginTop: "20px", backgroundColor: '#4CAF50'}}
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      <div className={`menu-page-content ${showInitialCashModal || showBogoInfoModal || showBogoCongratsModal ? 'blurred' : ''}`}>
        {isLoading && <Loading />}
        
        {!isLoading && (
          <>
            <div className="menu-category-sidebar">
              <div className="menu-category-group">
                <div className={`menu-all-products-btn ${selectedFilter.type === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setShowMerchandise(false);
                    setSelectedFilter({ type: 'all', value: 'All Products' });
                  }}>
                  ALL PRODUCTS
                </div>
              </div>
              {Object.entries(categories).map(([group, items]) => (
                <div className="menu-category-group" key={group}>
                  <div className={`menu-group-title ${selectedFilter.type === 'group' && selectedFilter.value === group ? 'active' : ''}`}
                    onClick={() => {
                      setShowMerchandise(false);
                      setSelectedFilter({ type: 'group', value: group });
                    }}>
                    {group}
                  </div>
                  {items.map(item => (
                    <div key={item} className={`menu-category-item ${selectedFilter.type === 'item' && selectedFilter.value === item ? 'active' : ''}`}
                      onClick={() => {
                        setShowMerchandise(false);
                        setSelectedFilter({ type: 'item', value: item });
                      }}>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
              <div className="menu-category-group">
                <div className={`menu-all-products-btn ${selectedFilter.type === 'merchandise' ? 'active' : ''}`}
                  onClick={fetchMerchandise}>
                  MERCHANDISE
                </div>
              </div>
            </div>

            <div className={`menu-main-content ${isCartOpen ? 'menu-cart-open' : ''}`}>
              <div className="menu-container">
                <div className="menu-product-list">
                  {renderMainContent()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <CartPanel
        cartItems={cartItems}
        setCartItems={setCartItems}
        isCartOpen={isCartOpen}
        orderType={orderType}
        setOrderType={setOrderType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        getDynamicMaxQuantity={getDynamicMaxQuantity}
        promotions={promotions}
        discounts={discounts}
      />
    </div>
  );
}

export default Menu;