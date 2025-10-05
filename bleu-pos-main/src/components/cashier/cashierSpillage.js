import React, { useState, useEffect } from 'react';
import DataTable from "react-data-table-component";
import './cashierSpillage.css';
import Navbar from '../navbar'; 
import { FaPlus, FaTimes } from 'react-icons/fa';

function CashierSpillage() {
  const [spillageEntries, setSpillageEntries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // New filter states
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [formData, setFormData] = useState({
    type: '',
    productName: '',
    category: '',
    quantitySpilled: '',
    unit: 'pieces',
    reason: '',
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
      return productsByCategory['Ingredients'] || [];
    } else if (formData.type === 'Product' && formData.category) {
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
        category: '',
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
    setTimeout(() => {
      setIsProductDropdownOpen(false);
    }, 200);
  };

  const handleModalOpen = () => {
    setShowModal(true);
    setFormData({
      type: '',
      productName: '',
      category: '',
      quantitySpilled: '',
      unit: 'pieces',
      reason: '',
    });
    setProductSearchTerm('');
  };

  const handleModalClose = () => {
    setShowModal(false);
    setFormData({
      type: '',
      productName: '',
      category: '',
      quantitySpilled: '',
      unit: 'pieces',
      reason: '',
    });
    setProductSearchTerm('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let validationErrors = [];

    if (!formData.type) validationErrors.push('Type');
    if (!formData.productName) validationErrors.push('Product Name');
    if (!formData.quantitySpilled) validationErrors.push('Quantity');
    if (!formData.reason) validationErrors.push('Reason');

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
      timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
      reportedBy: 'Current User'
    };

    setSpillageEntries(prev => [newEntry, ...prev]);
    setShowModal(false);

    setFormData({
      type: '',
      productName: '',
      category: '',
      quantitySpilled: '',
      unit: 'pieces',
      reason: '',
    });
    setProductSearchTerm('');

    alert('Spillage logged successfully!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      setSpillageEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };

  // Apply filters
  const filteredSpillageEntries = spillageEntries.filter(entry => {
    const matchesSearch =
      entry.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.category && entry.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      entry.reason.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter ? entry.type === typeFilter : true;
    const matchesDate = dateFilter
      ? entry.timestamp.startsWith(new Date(dateFilter).toLocaleDateString())
      : true;

    return matchesSearch && matchesType && matchesDate;
  });

  // DataTable columns configuration
  const columns = [
    {
      name: "TIMESTAMP",
      selector: (row) => row.timestamp,
      sortable: true,
      minWidth: "180px",
    },
    {
      name: "TYPE",
      selector: (row) => row.type,
      sortable: true,
      minWidth: "120px",
    },
    {
      name: "CATEGORY",
      selector: (row) => row.category || '-',
      sortable: true,
      minWidth: "130px",
    },
    {
      name: "PRODUCT NAME",
      selector: (row) => row.productName,
      sortable: true,
      minWidth: "200px",
    },
    {
      name: "QUANTITY",
      selector: (row) => `${row.quantitySpilled} ${row.unit}`,
      sortable: true,
      minWidth: "120px",
    },
    {
      name: "REASON",
      selector: (row) => row.reason,
      wrap: true,
      minWidth: "200px",
    },
  ];

  return (
    <div className='cashier-spillage'>
      <Navbar />

      <div className="spillage-container">
        <div className="spillage-content">
          {/* Filter and Add Button */}
          <div className="filter-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Search spillage entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <input
              type="date"
              className="date-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />

            <select
              className="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Spillage History Table */}
          <div className="spillage-table-container">
            <DataTable
              columns={columns}
              data={filteredSpillageEntries}
              pagination
              striped
              highlightOnHover
              persistTableHead
              noDataComponent="No spillage entries found"
              customStyles={{
                headCells: {
                  style: {
                    backgroundColor: "#4B929D",
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: "14px",
                    padding: "12px",
                    textTransform: "uppercase"
                  },
                },
                rows: {
                  style: {
                    minHeight: "55px",
                    padding: "5px"
                  },
                },
              }}
            />
          </div>

          {showModal && (
          <div className="cSpillage-modal-overlay" onClick={handleModalClose}>
            <div className="cSpillage-modal-content" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="cSpillage-modal-header">
                <h2 className="cSpillage-modal-title">Log New Spillage</h2>
                <button className="cSpillage-modal-close" onClick={handleModalClose}>
                  <FaTimes />
                </button>
              </div>

              {/* Body */}
              <div className="cSpillage-modal-body">
                <form onSubmit={handleSubmit} className="cSpillage-form">
                  <div className="cSpillage-form-row">
                    <div className="cSpillage-form-group">
                      <label htmlFor="type" className="cSpillage-form-label">Type *</label>
                      <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="cSpillage-form-input"
                        required
                      >
                        <option value="">Select type</option>
                        {types.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {formData.type === 'Product' && (
                      <div className="cSpillage-form-group">
                        <label htmlFor="category" className="cSpillage-form-label">Category *</label>
                        <select
                          id="category"
                          name="category"
                          value={formData.category}
                          onChange={handleInputChange}
                          className="cSpillage-form-input"
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

                  {(formData.type === 'Ingredients' || (formData.type === 'Product' && formData.category)) && (
                    <div className="cSpillage-form-group">
                      <label htmlFor="productName" className="cSpillage-form-label">Product Name *</label>
                      <div className="cSpillage-dropdown">
                        <input
                          type="text"
                          id="productName"
                          name="productName"
                          value={productSearchTerm}
                          onChange={handleProductSearch}
                          onFocus={handleProductInputFocus}
                          onBlur={handleProductInputBlur}
                          placeholder="Search for an item..."
                          className="cSpillage-form-input"
                          required
                          autoComplete="off"
                        />
                        {isProductDropdownOpen && (
                          <div className="cSpillage-dropdown-menu">
                            {filteredProducts.length > 0 ? (
                              filteredProducts.slice(0, 10).map((product, index) => (
                                <div
                                  key={index}
                                  className="cSpillage-dropdown-item"
                                  onMouseDown={() => handleProductSelect(product)}
                                >
                                  {product}
                                </div>
                              ))
                            ) : (
                              <div className="cSpillage-dropdown-item no-results">
                                {getAvailableProducts().length === 0
                                  ? `No products available for ${formData.type === 'Ingredients' ? 'ingredients' : formData.category}`
                                  : 'No products found'}
                              </div>
                            )}
                            {filteredProducts.length > 10 && (
                              <div className="cSpillage-dropdown-item more-results">
                                ... and {filteredProducts.length - 10} more results
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="cSpillage-form-row">
                    <div className="cSpillage-form-group">
                      <label htmlFor="quantitySpilled" className="cSpillage-form-label">Quantity Spilled *</label>
                      <input
                        type="number"
                        id="quantitySpilled"
                        name="quantitySpilled"
                        value={formData.quantitySpilled}
                        onChange={handleInputChange}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        className="cSpillage-form-input"
                        required
                      />
                    </div>

                    <div className="cSpillage-form-group">
                      <label htmlFor="unit" className="cSpillage-form-label">Unit</label>
                      <select
                        id="unit"
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                        className="cSpillage-form-input"
                      >
                        {units.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="cSpillage-form-group">
                    <label htmlFor="reason" className="cSpillage-form-label">Reason for Spillage *</label>
                    <input
                      type="text"
                      id="reason"
                      name="reason"
                      value={formData.reason}
                      onChange={handleInputChange}
                      placeholder="Describe the reason for spillage"
                      className="cSpillage-form-input"
                      required
                    />
                  </div>

                  {/* Footer actions */}
                  <div className="cSpillage-modal-actions">
                    <button type="button" className="cSpillage-cancel-btn" onClick={handleModalClose}>
                      Cancel
                    </button>
                    <button type="submit" className="cSpillage-save-btn">
                      Log Spillage
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default CashierSpillage;