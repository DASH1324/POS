import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Loading from "../home/shared/loading";
import './menu.css';

const PromotionsList = React.memo(({ addToCart, products = [] }) => {
  const placeholderImage = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93';
  const [addingPromo, setAddingPromo] = useState(null);
  const [bogoPromotions, setBogoPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isPromotionAvailable = (promo) => {
    const applicableProducts = promo.bogoProducts 
      ? promo.bogoProducts.map(p => p.product_name) 
      : [];
    
    for (const productName of applicableProducts) {
      const product = products.find(p => p.name === productName);
      if (!product || product.status === 'Unavailable') {
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const fetchBogoPromotions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('http://127.0.0.1:9002/api/promotions/bogo', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch BOGO promotions: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Fetched BOGO promotions:', data);
        setBogoPromotions(data);
      } catch (err) {
        console.error('Error fetching BOGO promotions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBogoPromotions();
  }, []);

  const handleAddPromotion = async (promo) => {
    if (addingPromo) return;
    
    setAddingPromo(promo.id);

    try {
      const applicableProducts = promo.bogoProducts 
        ? promo.bogoProducts.map(p => p.product_name) 
        : [];

      const buyQty = promo.buyQuantity || 1;
      const getQty = promo.getQuantity || 1;

      console.log('🎯 Promotion clicked:', promo.name);
      console.log('📦 Applicable products:', applicableProducts);
      console.log('🔢 Buy quantity:', buyQty, 'Get quantity:', getQty);

      if (applicableProducts.length === 0) {
        toast.error('No products found for this promotion.');
        setAddingPromo(null);
        return;
      }

      // ✅ CRITICAL FIX: Generate unique group ID for this promotion instance
      const uniqueGroupId = `bogo-${promo.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('🔑 Generated unique group ID:', uniqueGroupId);

      // Find all products first and validate they exist
      const productsToAdd = [];
      
      for (const productName of applicableProducts) {
        const product = products.find(p => p.name === productName);
        if (!product) {
          toast.error(`Product "${productName}" not found in menu.`);
          setAddingPromo(null);
          return;
        }
        console.log('✅ Found product:', product.name);
        productsToAdd.push(product);
      }

      // Case 1: Same product (Buy X, Get Y of the same product)
      if (applicableProducts.length === 1) {
        const product = productsToAdd[0];
        const totalQty = buyQty + getQty;
        
        console.log(`➕ Adding ${totalQty} of "${product.name}" to cart with group ID: ${uniqueGroupId}`);
        
        // ✅ CRITICAL FIX: All items in this promotion instance share the SAME groupId
        const productWithBogoFlags = {
          ...product,
          isFromBogo: true,
          bogoPromoId: promo.id,
          bogoGroupId: uniqueGroupId, // ✅ NEW: Unique group identifier
          bogoPromoName: promo.name,
          bogoPromoImage: promo.bogoPromotionImage || placeholderImage,
          bogoDiscountType: promo.bogoDiscountType,
          bogoDiscountValue: promo.bogoDiscountValue || 0
        };
        
        // Add all items sequentially with a delay between each
        for (let i = 0; i < totalQty; i++) {
          console.log(`  Adding item ${i + 1}/${totalQty} with groupId: ${uniqueGroupId}`);
          await addToCart(productWithBogoFlags);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        toast.success(`Added ${totalQty} ${product.name} to cart!\nPromotion: ${promo.name}`);
      } 
      // Case 2: Different products (Buy X of Product A, Get Y of Product B)
      else if (applicableProducts.length === 2) {
        const buyProduct = productsToAdd[0];
        const getProduct = productsToAdd[1];
        
        console.log(`➕ Adding ${buyQty} "${buyProduct.name}" and ${getQty} "${getProduct.name}" with group ID: ${uniqueGroupId}`);
        
        // ✅ CRITICAL FIX: Both products share the SAME groupId for this promotion instance
        const buyProductWithFlags = {
          ...buyProduct,
          isFromBogo: true,
          bogoPromoId: promo.id,
          bogoGroupId: uniqueGroupId, // ✅ NEW: Same group ID
          bogoPromoName: promo.name,
          bogoPromoImage: promo.bogoPromotionImage || placeholderImage,
          bogoDiscountType: promo.bogoDiscountType,
          bogoDiscountValue: promo.bogoDiscountValue || 0
        };
        
        const getProductWithFlags = {
          ...getProduct,
          isFromBogo: true,
          bogoPromoId: promo.id,
          bogoGroupId: uniqueGroupId, // ✅ NEW: Same group ID
          bogoPromoName: promo.name,
          bogoPromoImage: promo.bogoPromotionImage || placeholderImage,
          bogoDiscountType: promo.bogoDiscountType,
          bogoDiscountValue: promo.bogoDiscountValue || 0
        };
        
        // Add the "buy" products first
        for (let i = 0; i < buyQty; i++) {
          console.log(`  Adding buy product ${i + 1}/${buyQty}: ${buyProduct.name} with groupId: ${uniqueGroupId}`);
          await addToCart(buyProductWithFlags);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Then add the "get" products
        for (let i = 0; i < getQty; i++) {
          console.log(`  Adding get product ${i + 1}/${getQty}: ${getProduct.name} with groupId: ${uniqueGroupId}`);
          await addToCart(getProductWithFlags);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        toast.success(`Added promotion to cart!\n${buyQty} ${buyProduct.name} + ${getQty} ${getProduct.name}\nPromotion: ${promo.name}`);
      }
      
      console.log('✅ Promotion added successfully with unique group ID:', uniqueGroupId);
      
    } catch (error) {
      console.error('❌ Error adding promotion:', error);
      toast.error('Failed to add promotion to cart. Please try again.');
    } finally {
      setAddingPromo(null);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="menu-error">
        Error loading promotions: {error}
      </div>
    );
  }

  if (bogoPromotions.length === 0) {
    return (
      <div className="menu-no-products">
        No active BOGO promotions available at the moment.
      </div>
    );
  }

  return (
    <div className="menu-product-grid">
      {bogoPromotions.map(promo => {
        const applicableProducts = promo.bogoProducts 
          ? promo.bogoProducts.map(p => p.product_name) 
          : [];

        const buyQty = promo.buyQuantity || 1;
        const getQty = promo.getQuantity || 1;
        
        let discountText = '';
        if (promo.bogoDiscountType === 'percentage') {
          discountText = `${promo.bogoDiscountValue || 0}% off`;
        } else if (promo.bogoDiscountType === 'fixed_amount') {
          discountText = `₱${parseFloat(promo.bogoDiscountValue || 0).toFixed(2)} off`;
        }

        let promoDescription = '';
        if (applicableProducts.length === 1) {
          promoDescription = `Buy ${buyQty} ${applicableProducts[0]}, Get ${getQty} ${applicableProducts[0]}`;
        } else if (applicableProducts.length === 2) {
          promoDescription = `Buy ${buyQty} ${applicableProducts[0]}, Get ${getQty} ${applicableProducts[1]}`;
        }

        const isAdding = addingPromo === promo.id;
        const isAvailable = isPromotionAvailable(promo);

        const badgeText = discountText ? `BOGO - ${discountText}` : 'BOGO PROMO';

        return (
          <div key={promo.id} className="menu-product-item menu-promo-item">
            {!isAvailable && (
              <div className="menu-product-unavailable-overlay">
                <span>Unavailable</span>
              </div>
            )}
            <div className="menu-promo-badge">{badgeText}</div>
            
            <div className="menu-product-main">
              <div className="menu-product-img-container">
                <img 
                  src={promo.bogoPromotionImage || placeholderImage} 
                  alt={promo.name}
                  onError={(e) => {
                    e.target.src = placeholderImage;
                  }}
                />
              </div>
              
              <div className="menu-product-details">
                <div className="menu-product-title">{promo.name}</div>
                
                {promo.description && (
                  <div className="menu-promo-subtitle">
                    {promo.description}
                  </div>
                )}
                
                <div className="menu-promo-description">
                  {promoDescription}
                </div>
                
                <div className="menu-promo-validity">
                  Valid: {promo.validFrom} to {promo.validTo}
                </div>
              </div>
            </div>
            
            <button 
              className="menu-add-button"
              onClick={() => handleAddPromotion(promo)}
              disabled={isAdding || !isAvailable}
              style={{
                opacity: (isAdding || !isAvailable) ? 0.6 : 1,
                cursor: (isAdding || !isAvailable) ? 'not-allowed' : 'pointer'
              }}
            >
              {isAdding ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default PromotionsList;