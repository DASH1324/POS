import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../navbar';
import CartPanel from './cartPanel.js';
import './menu.css';

const API_BASE_URL = 'http://127.0.0.1:9001/api';
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

  // State for order details
  const [orderType, setOrderType] = useState('Dine in');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // State for user info
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Cache for max quantities to avoid redundant API calls
  const [maxQuantityCache, setMaxQuantityCache] = useState({});

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

        // DEBUG: Check what status values are coming from API
        console.log('=== CHECKING PRODUCT STATUSES FROM API ===');
        console.log('Total products from API:', apiDetails.length);
        console.log('Sample product from API:', apiDetails[0]);
        
        const unavailableProducts = apiDetails.filter(p => p.Status === 'Unavailable');
        console.log('Unavailable products count:', unavailableProducts.length);
        if (unavailableProducts.length > 0) {
          console.log('Sample unavailable products:', unavailableProducts.slice(0, 3).map(p => ({
            name: p.ProductName,
            status: p.Status,
            category: p.ProductCategory
          })));
        }
        
        const availableProducts = apiDetails.filter(p => p.Status === 'Available');
        console.log('Available products count:', availableProducts.length);

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
          status: p.Status,  // This should be 'Available' or 'Unavailable'
          image: imageMap[p.ProductName] || placeholderImage, 
          sizes: p.Sizes,
          hasAddons: p.HasAddOns,
        }));

        // DEBUG: Verify status is preserved after mapping
        console.log('=== AFTER MAPPING ===');
        console.log('Total mapped products:', mappedProducts.length);
        console.log('Sample mapped product:', mappedProducts[0]);
        
        const unavailableMapped = mappedProducts.filter(p => p.status === 'Unavailable');
        console.log('Unavailable products after mapping:', unavailableMapped.length);
        if (unavailableMapped.length > 0) {
          console.log('Sample mapped unavailable:', unavailableMapped.slice(0, 3).map(p => ({
            name: p.name,
            status: p.status,
            category: p.category
          })));
        }
        
        const availableMapped = mappedProducts.filter(p => p.status === 'Available');
        console.log('Available products after mapping:', availableMapped.length);
        
        setProducts(mappedProducts);

        const dynamicCategories = {};
        apiDetails.forEach(p => {
          const group = p.ProductTypeName.toUpperCase() + 'S';
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

    initializeData(activeToken, activeUsername);

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
    
    // DEBUG: Check filtered products status
    console.log('=== FILTERING PRODUCTS ===');
    console.log('Filter type:', selectedFilter.type, 'Filter value:', selectedFilter.value);
    console.log('Filtered count:', filtered.length);
    const unavailableFiltered = filtered.filter(p => p.status === 'Unavailable');
    console.log('Unavailable in filtered:', unavailableFiltered.length);
    
    return filtered.sort((a, b) => {
      const aUnavailable = a.status === 'Unavailable';
      const bUnavailable = b.status === 'Unavailable';
      if (aUnavailable && !bUnavailable) return 1;
      if (!aUnavailable && bUnavailable) return -1;
      return 0;
    });
  }, [selectedFilter, products, categories]);

  const filteredProducts = useMemo(() => filterProducts(), [filterProducts]);

  // Optimized: Get dynamic max quantity with caching
  const getDynamicMaxQuantity = useCallback(async (productName, category, productId) => {
    const cacheKey = `${productId}-${cartItems.length}-${cartItems.map(i => `${i.id}:${i.quantity}`).join(',')}`;
    
    // Return cached result if available
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

      // Cache the result
      setMaxQuantityCache(prev => ({ ...prev, [cacheKey]: result }));
      
      return result;

    } catch (error) {
      console.error('Error fetching dynamic max quantity:', error);
      return null;
    }
  }, [cartItems, maxQuantityCache]);

  // Optimized: Check inventory conflicts with debouncing
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
      // Check for inventory conflicts first
      const conflictCheck = await checkInventoryConflicts(item.id);
      
      if (!conflictCheck.canAdd) {
        const conflictMessages = conflictCheck.conflicts.map(c => 
          `• ${c.type.toUpperCase()}: ${c.name}\n  Needs ${c.needed}, only ${c.available} available\n  Conflicts with: "${c.conflictsWith}"`
        ).join('\n\n');
        
        alert(`❌ Cannot add "${item.name}" to cart.\n\nShared limited resources:\n\n${conflictMessages}`);
        return;
      }

      // Fetch dynamic max quantity
      const maxQtyInfo = await getDynamicMaxQuantity(item.name, item.category, item.id);
      
      if (maxQtyInfo && maxQtyInfo.maxQuantity === 0) {
        alert(`Cannot add ${item.name}. ${maxQtyInfo.limitedBy || 'Insufficient stock'}`);
        return;
      }

      // Add or update cart item
      setCartItems(prev => {
        const existingIndex = prev.findIndex(cartItem => 
          cartItem.id === item.id && 
          cartItem.type === 'product' && 
          (!cartItem.addons || cartItem.addons.length === 0)
        );

        if (existingIndex !== -1) {
          const currentQty = prev[existingIndex].quantity;
          const maxQty = maxQtyInfo ? maxQtyInfo.maxQuantity : 999;
          
          if (currentQty >= maxQty) {
            alert(`Maximum quantity of ${maxQty} reached for ${item.name}. ${maxQtyInfo?.limitedBy || ''}`);
            return prev;
          }

          const updatedCart = [...prev];
          updatedCart[existingIndex] = {
            ...updatedCart[existingIndex],
            quantity: currentQty + 1,
            maxQuantity: maxQty,
            limitedBy: maxQtyInfo?.limitedBy
          };
          return updatedCart;
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
          return [...prev, newCartItem];
        }
      });
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
      
    } catch (err) {
      setInitialCashError(err.message);
    }
  };

  const ProductList = React.memo(({ products, addToCart }) => {
    console.log('=== RENDERING PRODUCT LIST ===');
    console.log('Total products to render:', products.length);
    const unavailableInRender = products.filter(p => p.status === 'Unavailable');
    console.log('Unavailable products in render:', unavailableInRender.length);
    if (unavailableInRender.length > 0) {
      console.log('Unavailable products:', unavailableInRender.map(p => p.name));
    }

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
            {item.Status === 'Not Available' && (
              <div className="menu-product-unavailable-overlay">
                <span>Not Available</span>
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
    if (isLoading) return <div className="menu-status-container">Loading...</div>;
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

      <div className={`menu-page-content ${showInitialCashModal ? 'blurred' : ''}`}>
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
      />
    </div>
  );
}

export default Menu;