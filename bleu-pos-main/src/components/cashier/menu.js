import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../navbar';
import CartPanel from './cartPanel.js';
import Loading from "../home/shared/loading";
import { UnableToLoadData, NoData } from "../home/shared/exportModal";
import { toast } from 'react-toastify';
import PromotionsList from './PromotionsList';
import './menu.css';

const API_BASE_URL = 'http://127.0.0.1:9001/api';
const PROMOTION_BASE_URL = 'http://127.0.0.1:9002/api';
const PRODUCTS_API_URL = 'http://127.0.0.1:8001';
const MERCHANDISE_API_URL = 'http://127.0.0.1:8002/merchandise/';

function Menu() {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState({ type: 'all', value: 'All Products' });
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showInitialCashModal, setShowInitialCashModal] = useState(false);
  const [initialCash, setInitialCash] = useState('');
  const [initialCashError, setInitialCashError] = useState('');
  const [products, setProducts] = useState([]);
  const [merchandise, setMerchandise] = useState([]);
  const [showMerchandise, setShowMerchandise] = useState(false);
  const [showPromotions, setShowPromotions] = useState(false);
  const [categories, setCategories] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [discounts, setDiscounts] = useState([]); 
  const [orderType, setOrderType] = useState('Dine in');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [maxQuantityCache, setMaxQuantityCache] = useState({});

  const formatPromotionValue = (promo) => {
    if (promo.promotion_type === 'percentage') {
        return `${promo.promotion_value}%`;
    } else if (promo.promotion_type === 'fixed') {
        return `₱${promo.promotion_value}`;
    }
    return `${promo.promotion_value}`;
  };

  const fetchPromotions = useCallback(async (token) => {
    setIsLoadingPromotions(true);
    try {
      const response = await fetch(`${PROMOTION_BASE_URL}/promotions/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch promotions.');
      }
      const data = await response.json();
      
      const transformedPromotions = data
        .filter(p => p.status === 'active')
        .map(promo => {
          let promotionType = null;
          let discountValue = 0;
          
          const typeStr = (promo.type || '').toUpperCase();
          
          if (typeStr.includes('PERCENTAGE') || typeStr.includes('%')) {
            promotionType = 'percentage';
          } else if (typeStr.includes('FIXED') || typeStr.includes('₱')) {
            promotionType = 'fixed';
          }
          
          if (promo.value) {
            const numMatch = promo.value.match(/(\d+\.?\d*)/);
            if (numMatch) {
              discountValue = parseFloat(numMatch[0]);
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
          
          return {
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
            discountValue: discountValue
          };
        });
      
      setPromotions(transformedPromotions);
    } catch (error) {
      console.error("Error fetching promotions:", error.message);
    } finally {
      setIsLoadingPromotions(false);
    }
  }, []);

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

    const initializeData = async (token, username) => {
      setIsLoading(true);
      setError(null);

      if (!token || !username) {
        setError("Authorization Error. Please log in.");
        setIsLoading(false);
        return;
      }

      try {
        const isClosed = await checkClosedSessionToday(token, username);
        if (isClosed) {
          return; 
        }

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
  }, [fetchPromotions]);

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
      setShowPromotions(false);
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

  const checkClosedSessionToday = async (token, cashierName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/session/check-closed-today?cashier_name=${encodeURIComponent(cashierName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to check closed session.');
      }
      const data = await response.json();
      
      if (data.hasClosedSessionToday) {
        navigate('/cashier-session-summary');
        return true;
      }
      return false;
    } catch (err) {
      console.error("Closed session check error:", err);
      setError("Could not verify closed session status. Please try refreshing.");
      return false;
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
  console.log('🛒 Adding to cart:', item.name, {
    type,
    isFromBogo: item.isFromBogo,
    bogoPromoId: item.bogoPromoId,
    bogoGroupId: item.bogoGroupId,
    bogoPromoName: item.bogoPromoName
  });
  
  if (item.Status === 'Not Available' || item.status === 'Unavailable') {
    return;
  }

  if (type === 'product') {
    const conflictCheck = await checkInventoryConflicts(item.id);
    
    if (!conflictCheck.canAdd) {
      const conflictMessages = conflictCheck.conflicts.map(c => 
        `• ${c.type.toUpperCase()}: ${c.name}\n  Needs ${c.needed}, only ${c.available} available\n  Conflicts with: "${c.conflictsWith}"`
      ).join('\n\n');
      
      toast.error(`Cannot add "${item.name}" to cart.\n\nShared limited resources:\n\n${conflictMessages}`);
      return;
    }

    const maxQtyInfo = await getDynamicMaxQuantity(item.name, item.category, item.id);
    
    if (maxQtyInfo && maxQtyInfo.maxQuantity === 0) {
      toast.error(`Cannot add ${item.name}. ${maxQtyInfo.limitedBy || 'Insufficient stock'}`);
      return;
    }

    setCartItems(prev => {
      const existingIndex = prev.findIndex(cartItem => {
        if (cartItem.id !== item.id || cartItem.type !== 'product') {
          return false;
        }
        
        if (item.isFromBogo && cartItem.isFromBogo) {
          return (
            cartItem.bogoPromoId === item.bogoPromoId &&
            (!cartItem.addons || cartItem.addons.length === 0)
          );
        }
        
        if (!item.isFromBogo && !cartItem.isFromBogo) {
          return (!cartItem.addons || cartItem.addons.length === 0);
        }
        
        return false;
      });

      let updatedCart;
      
      if (existingIndex !== -1) {
        const currentQty = prev[existingIndex].quantity;
        const maxQty = maxQtyInfo ? maxQtyInfo.maxQuantity : 999;
        
        if (currentQty >= maxQty) {
          toast.error(`Maximum quantity of ${maxQty} reached for ${item.name}. ${maxQtyInfo?.limitedBy || ''}`);
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
        
        console.log(`✅ Updated existing item quantity to ${newQuantity}`);
      } else {
        const maxQty = maxQtyInfo ? maxQtyInfo.maxQuantity : 999;
        const newCartItem = { 
          ...item, 
          quantity: 1, 
          type: 'product', 
          addons: [],
          maxQuantity: maxQty,
          limitedBy: maxQtyInfo?.limitedBy,
          cartId: Date.now() + Math.random(),
          isFromBogo: item.isFromBogo || false,
          bogoPromoId: item.bogoPromoId || null,
          bogoGroupId: item.bogoGroupId || null,
          bogoPromoName: item.bogoPromoName || null,
          bogoPromoImage: item.bogoPromoImage || null,
          bogoDiscountType: item.bogoDiscountType || null,
          bogoDiscountValue: item.bogoDiscountValue || null
        };
        updatedCart = [...prev, newCartItem];
        
        console.log(`✅ Added new item with bogoGroupId: ${item.bogoGroupId || 'none'}`);
      }

      return updatedCart;
    });

  } else if (type === 'merchandise') {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(cartItem => 
        cartItem.id === item.MerchandiseID && cartItem.type === 'merchandise'
      );
    
      if (existingIndex !== -1) {
        const updatedCart = [...prev];
        if (updatedCart[existingIndex].quantity >= item.MerchandiseQuantity) {
          toast.error(`Maximum stock of ${item.MerchandiseQuantity} reached for ${item.MerchandiseName}`);
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
}, [checkInventoryConflicts, getDynamicMaxQuantity]);

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
    if (error && error.includes("Authorization Error")) return <div className="menu-status-container"><UnableToLoadData /></div>;
    if (error && error.includes("session is invalid")) return <div className="menu-status-container"><NoData /></div>;
    if (error) return <div className="menu-status-container">Error: {error}</div>;
    if (showPromotions) {
      return (
        <>
          <div className="menu-product-list-header">
            <h2 className="menu-selected-category-title">Promotions</h2>
          </div>
          <div className="menu-product-grid-container">
            {isLoadingPromotions ? (
              <Loading />
            ) : (
              <PromotionsList promotions={promotions} addToCart={addToCart} products={products} />
            )}
          </div>
        </>
      );
    }
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

      <div className={`menu-page-content ${showInitialCashModal ? 'blurred' : ''}`}>
        {isLoading && <Loading />}
        
        {!isLoading && (
          <>
            <div className="menu-category-sidebar">
              <div className="menu-category-group">
                <div className={`menu-all-products-btn ${selectedFilter.type === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setShowMerchandise(false);
                    setShowPromotions(false);
                    setSelectedFilter({ type: 'all', value: 'All Products' });
                  }}>
                  ALL PRODUCTS
                </div>  
              </div>
              <div className="menu-category-group">
                <div className={`menu-all-products-btn ${selectedFilter.type === 'promotions' ? 'active' : ''}`}
                  onClick={() => {
                    setShowMerchandise(false);
                    setShowPromotions(true);
                    setSelectedFilter({ type: 'promotions', value: 'Promotions' });
                    const token = localStorage.getItem('authToken');
                    if (token) {
                      fetchPromotions(token);
                    }
                  }}>
                  PROMOTIONS
                </div>  
              </div>
              {Object.entries(categories).map(([group, items]) => (
                <div className="menu-category-group" key={group}>
                  <div className={`menu-group-title ${selectedFilter.type === 'group' && selectedFilter.value === group ? 'active' : ''}`}
                    onClick={() => {
                      setShowMerchandise(false);
                      setShowPromotions(false);
                      setSelectedFilter({ type: 'group', value: group });
                    }}>
                    {group}
                  </div>
                  {items.map(item => (
                    <div key={item} className={`menu-category-item ${selectedFilter.type === 'item' && selectedFilter.value === item ? 'active' : ''}`}
                      onClick={() => {
                        setShowMerchandise(false);
                        setShowPromotions(false);
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