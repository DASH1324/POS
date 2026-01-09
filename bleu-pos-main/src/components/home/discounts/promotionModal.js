import React, { useState, useEffect } from "react";
import "./discountModal.css";

const PromotionModal = ({
  showModal,
  onClose,
  editingId,
  form,
  onChange,
  onMultiSelectChange,
  onSave,
  isSaving, 
  availableProducts,
  categories,
  today,
  isLoadingChoices,
  errorChoices
}) => {
  const [errors, setErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");

  useEffect(() => {
    if (!showModal) {
      setErrors({});
      setImagePreview(null);
      setImageFile(null);
      setProductSearchTerm(""); // Add this line
    }
  }, [showModal]);

  // Load existing image if editing
  useEffect(() => {
    if (showModal && editingId && form.bogoPromotionImage) {
      setImagePreview(form.bogoPromotionImage);
    }
  }, [showModal, editingId, form.bogoPromotionImage]);

  if (!showModal) return null;

  const handleFocus = (field) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, bogoPromotionImage: "Image size must be less than 2MB" }));
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, bogoPromotionImage: "Please select a valid image file" }));
        return;
      }

      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        // Update form with base64 image
        onChange({
          target: {
            name: 'bogoPromotionImage',
            value: reader.result
          }
        });
        setErrors(prev => ({ ...prev, bogoPromotionImage: "" }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    onChange({
      target: {
        name: 'bogoPromotionImage',
        value: null
      }
    });
  };

  const validateForm = () => {
    let newErrors = {};

    // Promotion Name validation
    if (!form.promotionName || !form.promotionName.trim()) {
      newErrors.promotionName = "Promotion name is required";
    }

    // Description validation (optional but check if provided)
    if (form.description && form.description.trim().length > 500) {
      newErrors.description = "Description must not exceed 500 characters";
    }

    const isBogoType = form.promotionType === "bogo";

    // BOGO validations
    if (isBogoType) {
      // Products selection for BOGO
      if (!form.selectedProducts || form.selectedProducts.length === 0) {
        newErrors.selectedProducts = "Please select at least 1 product for BOGO promotion";
      } else if (form.selectedProducts.length > 2) {
        newErrors.selectedProducts = "BOGO promotion can only have maximum 2 products";
      }

      // Buy/Get quantity validation
      if (!form.buyQuantity || parseInt(form.buyQuantity) <= 0) {
        newErrors.buyQuantity = "Buy quantity must be greater than 0";
      }
      if (!form.getQuantity || parseInt(form.getQuantity) <= 0) {
        newErrors.getQuantity = "Get quantity must be greater than 0";
      }

      // BOGO discount value validation
      if (!form.bogoDiscountValue || parseFloat(form.bogoDiscountValue) <= 0) {
        newErrors.bogoDiscountValue = "Discount value is required and must be greater than 0";
      } else if (form.bogoDiscountType === "percentage" && parseFloat(form.bogoDiscountValue) > 100) {
        newErrors.bogoDiscountValue = "Percentage cannot exceed 100%";
      }

      // Image validation for BOGO
      if (!imagePreview && !form.bogoPromotionImage) {
        newErrors.bogoPromotionImage = "Please upload a promotion image for BOGO";
      }
    } else {
      // Non-BOGO validations
      if (form.applicationType === "specific_categories") {
        if (!form.selectedCategories || form.selectedCategories.length === 0) {
          newErrors.selectedCategories = "Please select at least one category";
        }
      } else if (form.applicationType === "specific_products") {
        if (!form.selectedProducts || form.selectedProducts.length === 0) {
          newErrors.selectedProducts = "Please select at least one product";
        }
      }

      // Promotion value validation (percentage or fixed)
      if (!form.promotionValue || parseFloat(form.promotionValue) <= 0) {
        newErrors.promotionValue = "Discount value is required and must be greater than 0";
      } else if (form.promotionType === "percentage") {
        if (parseFloat(form.promotionValue) >= 100) {
          newErrors.promotionValue = "Percentage must be less than 100%";
        }
      }

      // Minimum quantity validation (optional but must be valid if provided)
      if (form.minQuantity && parseInt(form.minQuantity) <= 0) {
        newErrors.minQuantity = "Minimum quantity must be greater than 0";
      }
    }

    // Date validation
    if (!form.validFrom) {
      newErrors.validFrom = "Valid from date is required";
    }
    if (!form.validTo) {
      newErrors.validTo = "Valid until date is required";
    }
    if (form.validFrom && form.validTo && new Date(form.validTo) < new Date(form.validFrom)) {
      newErrors.validTo = "Valid until date must be after valid from date";
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    onSave();
  };

  const handleCheckboxChange = (e, itemName, listName, list) => {
    const updatedList = e.target.checked
      ? [...list, itemName]
      : list.filter(name => name !== itemName);
    onMultiSelectChange(listName, updatedList);
    
    setErrors((prev) => ({ ...prev, [listName]: "" }));
  };

  const handleNumberInput = (e, maxLength) => {
    const value = e.target.value;
    if (value.length > maxLength) {
      e.target.value = value.slice(0, maxLength);
    }
    onChange(e);
    handleFocus(e.target.name);
  };

  const handleInputChange = (e) => {
    onChange(e);
    handleFocus(e.target.name);
  };

  const isBogoType = form.promotionType === "bogo";

  // Filter products based on search term
  const filteredProducts = availableProducts.filter(product =>
    product.ProductName.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  return (
    <div className="mngDiscounts-modal-overlay" onClick={onClose}>
      <div className="mngDiscounts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mngDiscounts-modal-header">
          <h3>{editingId ? "Edit Promotion" : "Add Promotion"}</h3>
          <button className="mngDiscounts-close-modal" onClick={onClose}>×</button>
        </div>
        
        <div className="mngDiscounts-modal-body">
          {/* Promotion Type - Moved to Top */}
          <div className="mngDiscounts-form-group">
            <label>Promotion Type</label>
            <select
              name="promotionType"
              value={form.promotionType}
              onChange={handleInputChange}
              onFocus={() => handleFocus("promotionType")}
              required
            >
              <option value="percentage">Percentage Discount</option>
              <option value="fixed">Fixed Amount Discount</option>
              <option value="bogo">Buy One Get One</option>
            </select>
          </div>

          {/* Application Type - Hidden for BOGO */}
          {!isBogoType && (
            <div className="mngDiscounts-form-group">
              <label>Application</label>
              <div className="mngDiscounts-radio-group">
                <label className="mngDiscounts-radio-label">
                  <input
                    type="radio"
                    name="applicationType"
                    value="all_products"
                    checked={form.applicationType === "all_products"}
                    onChange={handleInputChange}
                  />
                  All Products
                </label>
                <label className="mngDiscounts-radio-label">
                  <input
                    type="radio"
                    name="applicationType"
                    value="specific_categories"
                    checked={form.applicationType === "specific_categories"}
                    onChange={handleInputChange}
                  />
                  Specific Categories
                </label>
                <label className="mngDiscounts-radio-label">
                  <input
                    type="radio"
                    name="applicationType"
                    value="specific_products"
                    checked={form.applicationType === "specific_products"}
                    onChange={handleInputChange}
                  />
                  Individual Products
                </label>
              </div>
            </div>
          )}
          
          {/* Promotion Name */}
          <div className="mngDiscounts-form-group">
            <label>
              Promotion Name <span className="mngDiscounts-required">*</span>
            </label>
            <input
              name="promotionName"
              value={form.promotionName || ''}
              onChange={handleInputChange}
              onFocus={() => handleFocus("promotionName")}
              maxLength={100}
              required
              placeholder="Enter promotion name"
              className={errors.promotionName ? "mngDiscounts-error-field" : ""}
            />
            {errors.promotionName && (
              <p className="mngDiscounts-error-message">{errors.promotionName}</p>
            )}
          </div>

          {/* Description */}
          <div className="mngDiscounts-form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={form.description || ''}
              onChange={handleInputChange}
              onFocus={() => handleFocus("description")}
              maxLength={500}
              placeholder="Enter promotion description"
              rows="3"
              className={errors.description ? "mngDiscounts-error-field" : ""}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: errors.description ? '1px solid #e74c3c' : '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1a1a1a',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            {errors.description && (
              <p className="mngDiscounts-error-message">{errors.description}</p>
            )}
          </div>

          {/* BOGO Image Upload - Only visible for BOGO type */}
          {isBogoType && (
            <div className="mngDiscounts-form-group">
              <label>
                Promotion Image <span className="mngDiscounts-required">*</span>
                <span style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                  Upload an image for this BOGO promotion (Max 2MB, JPG/PNG)
                </span>
              </label>
              
              {!imagePreview ? (
                <div 
                  className={`mngDiscounts-image-upload-area ${errors.bogoPromotionImage ? "mngDiscounts-error-field" : ""}`}
                  style={{
                    border: errors.bogoPromotionImage ? '2px dashed #e74c3c' : '2px dashed #4B929D',
                    borderRadius: '8px',
                    padding: '30px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f9f9f9',
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => document.getElementById('bogoImageInput').click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.backgroundColor = '#e8f5f7';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9f9f9';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.backgroundColor = '#f9f9f9';
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      handleImageChange({ target: { files: [file] } });
                    }
                  }}
                >
                  <div style={{ fontSize: '48px', color: '#4B929D', marginBottom: '10px' }}>📷</div>
                  <p style={{ margin: '0 0 10px 0', color: '#333', fontWeight: '500' }}>
                    Click to upload or drag and drop
                  </p>
                  <p style={{ margin: '0', color: '#666', fontSize: '13px' }}>
                    JPG, PNG up to 2MB
                  </p>
                </div>
              ) : (
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  <img 
                    src={imagePreview} 
                    alt="BOGO Promotion" 
                    style={{
                      width: '100%',
                      maxHeight: '300px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              <input
                id="bogoImageInput"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              
              {errors.bogoPromotionImage && (
                <p className="mngDiscounts-error-message">{errors.bogoPromotionImage}</p>
              )}
            </div>
          )}

          {/* Loading/Error States */}
          {isLoadingChoices && (
            <div className="mngDiscounts-loading">Loading choices...</div>
          )}
          {errorChoices && (
            <div className="mngDiscounts-error">{errorChoices}</div>
          )}

          {/* BOGO Product Selection - Always Shows for BOGO */}
          {isBogoType && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>
                Select Products <span className="mngDiscounts-required">*</span>
                <span className="mngDiscounts-bogo-instruction">
                  Select 1 product for "Buy 1 take 1 same product" or 2 products for "Buy product A, get product B"
                </span>
              </label>
              
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search products..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              
              <div 
                className={`mngDiscounts-checkbox-group ${errors.selectedProducts ? "mngDiscounts-error-field" : ""}`}
                style={{ maxHeight: '250px', overflowY: 'auto' }}
              >
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(product => (
                    <label key={product.ProductName} className="mngDiscounts-checkbox-label">
                      <input
                        type="checkbox"
                        checked={(form.selectedProducts || []).includes(product.ProductName)}
                        onChange={(e) => handleCheckboxChange(e, product.ProductName, 'selectedProducts', form.selectedProducts || [])}
                        disabled={(form.selectedProducts || []).length >= 2 && !(form.selectedProducts || []).includes(product.ProductName)}
                      />
                      {product.ProductName}
                    </label>
                  ))
                ) : (
                  <p style={{ padding: '10px', color: '#666', textAlign: 'center' }}>
                    No products found matching "{productSearchTerm}"
                  </p>
                )}
              </div>
              {errors.selectedProducts && (
                <p className="mngDiscounts-error-message">{errors.selectedProducts}</p>
              )}
              {(form.selectedProducts || []).length === 1 && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '13px' }}>
                  ℹ️ Buy 1 Take 1 Same Product: {form.selectedProducts[0]}
                </div>
              )}
              {(form.selectedProducts || []).length === 2 && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '4px', fontSize: '13px' }}>
                  ℹ️ Buy {form.selectedProducts[0]}, Get {form.selectedProducts[1]}
                </div>
              )}
            </div>
          )}

          {/* Category Selection - Only for non-BOGO */}
          {!isBogoType && form.applicationType === "specific_categories" && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>
                Select Categories <span className="mngDiscounts-required">*</span>
              </label>
              <div className={`mngDiscounts-checkbox-group ${errors.selectedCategories ? "mngDiscounts-error-field" : ""}`}>
                {categories.map(category => (
                  <label key={category.id} className="mngDiscounts-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(form.selectedCategories || []).includes(category.name)}
                      onChange={(e) => handleCheckboxChange(e, category.name, 'selectedCategories', form.selectedCategories || [])}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
              {errors.selectedCategories && (
                <p className="mngDiscounts-error-message">{errors.selectedCategories}</p>
              )}
            </div>
          )}

          {/* Product Selection - Only for non-BOGO */}
          {!isBogoType && form.applicationType === "specific_products" && !isLoadingChoices && (
            <div className="mngDiscounts-form-group">
              <label>
                Select Products <span className="mngDiscounts-required">*</span>
              </label>
              
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search products..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              
              <div 
                className={`mngDiscounts-checkbox-group ${errors.selectedProducts ? "mngDiscounts-error-field" : ""}`}
                style={{ maxHeight: '250px', overflowY: 'auto' }}
              >
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(product => (
                    <label key={product.ProductName} className="mngDiscounts-checkbox-label">
                      <input
                        type="checkbox"
                        checked={(form.selectedProducts || []).includes(product.ProductName)}
                        onChange={(e) => handleCheckboxChange(e, product.ProductName, 'selectedProducts', form.selectedProducts || [])}
                      />
                      {product.ProductName}
                    </label>
                  ))
                ) : (
                  <p style={{ padding: '10px', color: '#666', textAlign: 'center' }}>
                    No products found matching "{productSearchTerm}"
                  </p>
                )}
              </div>
              {errors.selectedProducts && (
                <p className="mngDiscounts-error-message">{errors.selectedProducts}</p>
              )}
            </div>
          )}

          {/* Percentage Discount */}
          {form.promotionType === "percentage" && (
            <div className="mngDiscounts-form-group">
              <label>
                Discount Percentage (%) <span className="mngDiscounts-required">*</span>
              </label>
              <input
                name="promotionValue"
                type="number"
                min="0.1"
                max="99.9"
                step="0.1"
                value={form.promotionValue || ''}
                onInput={(e) => handleNumberInput(e, 5)}
                onFocus={() => handleFocus("promotionValue")}
                required
                placeholder="Enter percentage"
                className={errors.promotionValue ? "mngDiscounts-error-field" : ""}
              />
              {errors.promotionValue && (
                <p className="mngDiscounts-error-message">{errors.promotionValue}</p>
              )}
            </div>
          )}

          {/* Fixed Amount Discount */}
          {form.promotionType === "fixed" && (
            <div className="mngDiscounts-form-group">
              <label>
                Fixed Discount Amount (₱) <span className="mngDiscounts-required">*</span>
              </label>
              <input
                name="promotionValue"
                type="number"
                min="0.01"
                step="0.01"
                value={form.promotionValue || ''}
                onInput={(e) => handleNumberInput(e, 10)}
                onFocus={() => handleFocus("promotionValue")}
                required
                placeholder="Enter fixed amount"
                className={errors.promotionValue ? "mngDiscounts-error-field" : ""}
              />
              {errors.promotionValue && (
                <p className="mngDiscounts-error-message">{errors.promotionValue}</p>
              )}
            </div>
          )}

          {/* BOGO Configuration */}
          {form.promotionType === "bogo" && (
            <>
              <div className="mngDiscounts-form-row">
                <div className="mngDiscounts-form-group">
                  <label>
                    Buy Quantity <span className="mngDiscounts-required">*</span>
                  </label>
                  <input
                    name="buyQuantity"
                    type="number"
                    min="1"
                    value={form.buyQuantity || 1}
                    onInput={(e) => handleNumberInput(e, 3)}
                    onFocus={() => handleFocus("buyQuantity")}
                    required
                    className={errors.buyQuantity ? "mngDiscounts-error-field" : ""}
                  />
                  {errors.buyQuantity && (
                    <p className="mngDiscounts-error-message">{errors.buyQuantity}</p>
                  )}
                </div>
                <div className="mngDiscounts-form-group">
                  <label>
                    Get Quantity <span className="mngDiscounts-required">*</span>
                  </label>
                  <input
                    name="getQuantity"
                    type="number"
                    min="1"
                    value={form.getQuantity || 1}
                    onInput={(e) => handleNumberInput(e, 3)}
                    onFocus={() => handleFocus("getQuantity")}
                    required
                    className={errors.getQuantity ? "mngDiscounts-error-field" : ""}
                  />
                  {errors.getQuantity && (
                    <p className="mngDiscounts-error-message">{errors.getQuantity}</p>
                  )}
                </div>
              </div>

              {/* BOGO Discount Type */}
              <div className="mngDiscounts-form-group">
                <label>Discount on Free Items</label>
                <select
                  name="bogoDiscountType"
                  value={form.bogoDiscountType || "percentage"}
                  onChange={handleInputChange}
                  required
                >
                  <option value="percentage">Percentage Discount</option>
                  <option value="fixed_amount">Fixed Amount Discount</option>
                </select>
              </div>

              {/* BOGO Discount Value */}
              {form.bogoDiscountType === "percentage" ? (
                <div className="mngDiscounts-form-group">
                  <label>
                    Discount Percentage on Free Items (%) <span className="mngDiscounts-required">*</span>
                  </label>
                  <input
                    name="bogoDiscountValue"
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={form.bogoDiscountValue || ''}
                    onInput={(e) => handleNumberInput(e, 5)}
                    onFocus={() => handleFocus("bogoDiscountValue")}
                    required
                    placeholder="Enter percentage"
                    className={errors.bogoDiscountValue ? "mngDiscounts-error-field" : ""}
                  />
                  {errors.bogoDiscountValue && (
                    <p className="mngDiscounts-error-message">{errors.bogoDiscountValue}</p>
                  )}
                </div>
              ) : (
                <div className="mngDiscounts-form-group">
                  <label>
                    Fixed Discount Amount on Free Items (₱) <span className="mngDiscounts-required">*</span>
                  </label>
                  <input
                    name="bogoDiscountValue"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.bogoDiscountValue || ''}
                    onInput={(e) => handleNumberInput(e, 10)}
                    onFocus={() => handleFocus("bogoDiscountValue")}
                    required
                    placeholder="Enter fixed amount"
                    className={errors.bogoDiscountValue ? "mngDiscounts-error-field" : ""}
                  />
                  {errors.bogoDiscountValue && (
                    <p className="mngDiscounts-error-message">{errors.bogoDiscountValue}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Minimum Quantity - Only for non-BOGO */}
          {!isBogoType && (
            <div className="mngDiscounts-form-group">
              <label>Minimum Quantity</label>
              <input
                name="minQuantity"
                type="number"
                min="1"
                value={form.minQuantity || ''}
                onInput={(e) => handleNumberInput(e, 5)}
                onFocus={() => handleFocus("minQuantity")}
                placeholder="Optional minimum quantity"
                className={errors.minQuantity ? "mngDiscounts-error-field" : ""}
              />
              {errors.minQuantity && (
                <p className="mngDiscounts-error-message">{errors.minQuantity}</p>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="mngDiscounts-form-row">
            <div className="mngDiscounts-form-group">
              <label>
                Valid From <span className="mngDiscounts-required">*</span>
              </label>
              <input
                name="validFrom"
                type="date"
                value={form.validFrom || ''}
                onChange={handleInputChange}
                onFocus={() => handleFocus("validFrom")}
                min={today}
                required
                className={errors.validFrom ? "mngDiscounts-error-field" : ""}
              />
              {errors.validFrom && (
                <p className="mngDiscounts-error-message">{errors.validFrom}</p>
              )}
            </div>
            <div className="mngDiscounts-form-group">
              <label>
                Valid Until <span className="mngDiscounts-required">*</span>
              </label>
              <input
                name="validTo"
                type="date"
                value={form.validTo || ''}
                onChange={handleInputChange}
                onFocus={() => handleFocus("validTo")}
                min={form.validFrom || today}
                required
                className={errors.validTo ? "mngDiscounts-error-field" : ""}
              />
              {errors.validTo && (
                <p className="mngDiscounts-error-message">{errors.validTo}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="mngDiscounts-form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={handleInputChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="mngDiscounts-modal-footer">
            <button
              type="button"
              className="mngDiscounts-btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mngDiscounts-btn-save"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Promotion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionModal;