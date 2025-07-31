import React, { useState, useEffect } from 'react';
import DataTable from "react-data-table-component";
import './cashierSpillage.css';
import Navbar from '../navbar';

function CashierSpillage() {
  const [spillageEntries, setSpillageEntries] = useState([]);
  const [formData, setFormData] = useState({
    type: '',
    productName: '',
    category: '',
    quantitySpilled: '',
    unit: 'pieces',
    reason: '',
    location: '',
    estimatedValue: '',
    notes: ''
  });

  // Searchable dropdown states
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const types = [
    'Ingredients',
    'Product'
  ];

  const categories = [
    'Food Items',
    'Drinks',
    'Ingredients',
  ];

  const units = [
    'pieces',
    'kg',
    'grams',
    'liters',
    'ml',
    'bottles',
    'cans',
    'bags'
  ];

  // Product data organized by category
  const productsByCategory = {
    'Food Items': [
      'Chicken Breast 1kg',
      'Ground Beef 1kg',
      'White Rice 5kg',
      'Brown Rice 5kg',
      'Pasta 500g',
      'Butter 250g',
      'Eggs 12pcs',
      'Bread Loaf',
      'Cheese Slice 200g',
      'Ham 500g',
      'Lettuce 1pc',
      'Tomato 1kg',
      'Onion 1kg',
      'Garlic 500g',
      'Potato 2kg',
      'Carrot 1kg',
      'Banana 1kg',
      'Apple 1kg',
      'Orange 1kg'
    ],
    'Drinks': [
      'Coca Cola 500ml',
      'Pepsi 500ml',
      'Sprite 500ml',
      'Orange Juice 1L',
      'Apple Juice 500ml',
      'Water Bottle 500ml',
      'Milk 1L'
    ],
    'Ingredients': [
      'Coffee Beans 1kg',
      'Sugar 1kg',
      'Salt 500g',
      'Black Pepper 100g',
      'Tomato Sauce 400ml',
      'Olive Oil 500ml'
    ]
  };

  // Get available products based on type and category
  const getAvailableProducts = () => {
    if (formData.type === 'Ingredients') {
      // For ingredients, return all ingredient products
      return productsByCategory['Ingredients'] || [];
    } else if (formData.type === 'Product' && formData.category) {
      // For products, return products from selected category
      return productsByCategory[formData.category] || [];
    }
    return [];
  };

  // Filter products based on search term
  const filteredProducts = getAvailableProducts().filter(product =>
    product.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  // Reset form fields when type changes
  useEffect(() => {
    if (formData.type === 'Ingredients') {
      setFormData(prev => ({
        ...prev,
        category: '', // Clear category for ingredients
        productName: '',
      }));
      setProductSearchTerm('');
    } else if (formData.type === 'Product') {
      setFormData(prev => ({
        ...prev,
        productName: '',
      }));
      setProductSearchTerm('');
    }
  }, [formData.type]);

  // Reset product name when category changes
  useEffect(() => {
    if (formData.type === 'Product') {
      setFormData(prev => ({
        ...prev,
        productName: '',
      }));
      setProductSearchTerm('');
    }
  }, [formData.category]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProductSearch = (e) => {
    const value = e.target.value;
    setProductSearchTerm(value);
    setFormData(prev => ({
      ...prev,
      productName: value
    }));
    setIsProductDropdownOpen(true);
  };

  const handleProductSelect = (product) => {
    setFormData(prev => ({
      ...prev,
      productName: product
    }));
    setProductSearchTerm(product);
    setIsProductDropdownOpen(false);
  };

  const handleProductInputFocus = () => {
    setIsProductDropdownOpen(true);
  };

  const handleProductInputBlur = () => {
    // Delay closing to allow for click on dropdown items
    setTimeout(() => {
      setIsProductDropdownOpen(false);
    }, 200);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation based on type
    let validationErrors = [];
    
    if (!formData.type) validationErrors.push('Type');
    if (!formData.productName) validationErrors.push('Product Name');
    if (!formData.quantitySpilled) validationErrors.push('Quantity');
    if (!formData.reason) validationErrors.push('Reason');
    
    // Additional validation for Product type
    if (formData.type === 'Product' && !formData.category) {
      validationErrors.push('Category');
    }
    
    if (validationErrors.length > 0) {
      alert(`Please fill in all required fields: ${validationErrors.join(', ')}`);
      return;
    }

    const newEntry = {
      ...formData,
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      reportedBy: 'Current User'
    };

    setSpillageEntries(prev => [newEntry, ...prev]);
    
    // Reset form
    setFormData({
      type: '',
      productName: '',
      category: '',
      quantitySpilled: '',
      unit: 'pieces',
      reason: '',
      location: '',
      estimatedValue: '',
      notes: ''
    });
    setProductSearchTerm('');

    alert('Spillage logged successfully!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      setSpillageEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };

  // DataTable columns configuration
  const columns = [
    {
      name: "TYPE",
      selector: (row) => row.type,
      sortable: true,
      width: "12%",
      center: true,
    },
    {
      name: "PRODUCT NAME",
      selector: (row) => row.productName,
      cell: (row) => (
        <div className="spillage-product-cell">
          <div className="spillage-product-name">{row.productName}</div>
        </div>
      ),
      sortable: true,
      width: "18%",
    },
    {
      name: "QUANTITY",
      selector: (row) => `${row.quantitySpilled} ${row.unit}`,
      center: true,
      sortable: true,
      width: "12%",
    },
    {
      name: "CATEGORY",
      selector: (row) => row.category || '-',
      center: true,
      sortable: true,
      width: "12%",
    },
    {
      name: "REASON",
      selector: (row) => row.reason,
      wrap: true,
      width: "20%",
    },
    {
      name: "LOCATION",
      selector: (row) => row.location || '-',
      center: true,
      width: "12%",
    },
    {
      name: "TIMESTAMP",
      selector: (row) => row.timestamp,
      cell: (row) => (
        <span className="spillage-timestamp">{row.timestamp}</span>
      ),
      sortable: true,
      width: "14%",
    },
    {
      name: "ACTIONS",
      cell: (row) => (
        <button 
          onClick={() => handleDelete(row.id)}
          className="spillage-delete-btn"
        >
          ×
        </button>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: "10%",
      center: true,
    },
  ];

  return (
    <div className='cashier-spillage'>
      <Navbar />
      
      <div className="spillage-container">
        <div className="spillage-content spillage-reversed">
          {/* Spillage History - now on the left with bigger width */}
          <div className="spillage-history-section">
            {spillageEntries.length === 0 ? (
              <div className="spillage-no-entries">
                <div className="spillage-no-entries-text">No spillage entries recorded yet.</div>
              </div>
            ) : (
              <div className="spillage-datatable-container">
                <DataTable 
                  columns={columns} 
                  data={spillageEntries} 
                  striped 
                  highlightOnHover 
                  responsive 
                  pagination
                  fixedHeader
                  fixedHeaderScrollHeight="60vh"
                  noDataComponent={
                    <div style={{padding: "24px"}}>
                      No spillage entries found.
                    </div>
                  }
                  customStyles={{
                    headCells: {
                      style: {
                        fontWeight: "600",
                        fontSize: "14px",
                        padding: "12px",
                        textTransform: "uppercase",
                        textAlign: "center",
                        letterSpacing: "1px",
                      },
                    },
                    rows: {
                      style: {
                        minHeight: "55px",
                        padding: "5px",
                      },
                    },
                  }}
                />
              </div>
            )}
          </div>

          {/* Spillage Form - now on the right with smaller width */}
          <div className="spillage-form-section">
            <div className="spillage-section-title">Log New Spillage</div>
            <div className="spillage-form">
              <div className="spillage-form-row">
                <div className="spillage-form-group">
                  <label htmlFor="type" className="spillage-form-label">Type *</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="spillage-form-select"
                    required
                  >
                    <option value="">Select type</option>
                    {types.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Category field - only visible when type is 'Product' */}
                {formData.type === 'Product' && (
                  <div className="spillage-form-group">
                    <label htmlFor="category" className="spillage-form-label">Category *</label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="spillage-form-select"
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Product Name field - only show when type is selected and (for Product type, category is also selected) */}
              {(formData.type === 'Ingredients' || (formData.type === 'Product' && formData.category)) && (
                <div className="spillage-form-row">
                  <div className="spillage-form-group spillage-full-width">
                    <label htmlFor="productName" className="spillage-form-label">Product Name *</label>
                    <div className="spillage-searchable-dropdown">
                      <input
                        type="text"
                        id="productName"
                        name="productName"
                        value={productSearchTerm}
                        onChange={handleProductSearch}
                        onFocus={handleProductInputFocus}
                        onBlur={handleProductInputBlur}
                        placeholder="Search for a product..."
                        className="spillage-form-input spillage-searchable-input"
                        required
                        autoComplete="off"
                      />
                      {isProductDropdownOpen && (
                        <div className="spillage-dropdown-menu">
                          {filteredProducts.length > 0 ? (
                            filteredProducts.slice(0, 10).map((product, index) => (
                              <div
                                key={index}
                                className="spillage-dropdown-item"
                                onMouseDown={() => handleProductSelect(product)}
                              >
                                {product}
                              </div>
                            ))
                          ) : (
                            <div className="spillage-dropdown-item spillage-no-results">
                              {getAvailableProducts().length === 0 
                                ? `No products available for ${formData.type === 'Ingredients' ? 'ingredients' : formData.category}`
                                : 'No products found'
                              }
                            </div>
                          )}
                          {filteredProducts.length > 10 && (
                            <div className="spillage-dropdown-item spillage-more-results">
                              ... and {filteredProducts.length - 10} more results
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="spillage-form-row">
                <div className="spillage-form-group">
                  <label htmlFor="quantitySpilled" className="spillage-form-label">Quantity Spilled *</label>
                  <input
                    type="number"
                    id="quantitySpilled"
                    name="quantitySpilled"
                    value={formData.quantitySpilled}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="spillage-form-input"
                    required
                  />
                </div>

                <div className="spillage-form-group">
                  <label htmlFor="unit" className="spillage-form-label">Unit</label>
                  <select
                    id="unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="spillage-form-select"
                  >
                    {units.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="spillage-form-row">
                <div className="spillage-form-group spillage-full-width">
                  <label htmlFor="reason" className="spillage-form-label">Reason for Spillage *</label>
                  <input
                    type="text"
                    id="reason"
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    placeholder="Describe the reason for spillage"
                    className="spillage-form-input"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="spillage-submit-btn" onClick={handleSubmit}>
                Log Spillage
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CashierSpillage;