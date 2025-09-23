import React, { useState, useEffect } from 'react';
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
      const response = await fetch(MERCHANDISE_API_URL, {
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
  }, [cartItems]);

  const filterProducts = () => {
    if (selectedFilter.type === 'all') return products;
    if (selectedFilter.type === 'group' && categories[selectedFilter.value]) {
      return products.filter(p => categories[selectedFilter.value].includes(p.category));
    }
    if (selectedFilter.type === 'item') {
      return products.filter(p => p.category === selectedFilter.value);
    }
    return [];
  };

  const filteredProducts = filterProducts();

  // CORRECTED: Smart addToCart function that combines items without add-ons
  const addToCart = (item, type = 'product') => {
    if (item.Status === 'Not Available' || item.status === 'Unavailable') return;
  
    if (type === 'product') {
      // For products, check if an identical item (same product, no add-ons) already exists
      const existingIndex = cartItems.findIndex(cartItem => 
        cartItem.id === item.id && 
        cartItem.type === 'product' && 
        (!cartItem.addons || cartItem.addons.length === 0)
      );

      if (existingIndex !== -1) {
        // If identical item exists (no add-ons), increment quantity
        const updatedCart = [...cartItems];
        updatedCart[existingIndex].quantity += 1;
        setCartItems(updatedCart);
      } else {
        // Create new cart item
        const newCartItem = { 
          ...item, 
          quantity: 1, 
          type: 'product', 
          addons: [],
          cartId: Date.now() + Math.random()
        };
        setCartItems(prev => [...prev, newCartItem]);
      }
    } else {
      // For merchandise, always check if it already exists and increment quantity
      const existingIndex = cartItems.findIndex(cartItem => 
        cartItem.id === item.MerchandiseID && cartItem.type === 'merchandise'
      );
    
      if (existingIndex !== -1) {
        const updatedCart = [...cartItems];
        updatedCart[existingIndex].quantity += 1;
        setCartItems(updatedCart);
      } else {
        setCartItems(prev => [...prev, { 
          id: item.MerchandiseID, 
          name: item.MerchandiseName, 
          price: 0, 
          quantity: 1, 
          type: 'merchandise',
          cartId: Date.now() + Math.random()
        }]);
      }
    }
  };

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

  const ProductList = ({ products, addToCart }) => (
    <div className="menu-product-grid">
      {products.map(product => (
        <div key={`${product.category}-${product.name}`} className="menu-product-item">
          {product.status === 'Unavailable' && (
            <div className="menu-product-unavailable-overlay">
              <span>Not Available</span>
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

  const MerchandiseList = ({ merchandise, addToCart }) => (
    <div className="menu-product-grid">
      {merchandise.map(item => (
        <div key={item.MerchandiseID} className="menu-product-item">
          {item.Status === 'Not Available' && (
            <div className="menu-product-unavailable-overlay">
              <span>Not Available</span>
            </div>
          )}
          <div className="menu-product-main">
            <div className="menu-product-details">
              <div className="menu-product-title">{item.MerchandiseName}</div>
              <div className="menu-product-category">Quantity: {item.MerchandiseQuantity}</div>
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
      />
    </div>
  );
}

export default Menu;