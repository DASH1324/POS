import React, { useState, useEffect } from 'react';
import DataTable from "react-data-table-component";
import './cashierSpillage.css';
import Navbar from '../navbar';
import { FaPlus, FaTimes } from 'react-icons/fa';

function CashierSpillage() {
  const [spillageEntries, setSpillageEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // To show a loading state
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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

  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // --- Hardcoded data (remains the same as per your UI) ---
  const types = ['Ingredients', 'Product'];
  const categories = ['Food Items', 'Drinks', 'Ingredients', 'Pasta', 'Non-Coffee']; // Added existing categories for dropdown
  const units = ['pieces', 'kg', 'grams', 'liters', 'ml', 'bottles', 'cans', 'bags'];
  const productsByCategory = {
    'Food Items': ['Chicken Breast 1kg', 'Ground Beef 1kg', 'White Rice 5kg', 'Brown Rice 5kg', 'Butter 250g', 'Eggs 12pcs', 'Bread Loaf', 'Cheese Slice 200g', 'Ham 500g', 'Lettuce 1pc', 'Tomato 1kg', 'Onion 1kg', 'Garlic 500g', 'Potato 2kg', 'Carrot 1kg', 'Banana 1kg', 'Apple 1kg', 'Orange 1kg'],
    'Pasta': ['Pasta 500g', 'Alfredo', 'Carbonara'],
    'Non-Coffee': ['Blueberry Cream'],
    'Drinks': ['Coca Cola 500ml', 'Pepsi 500ml', 'Sprite 500ml', 'Orange Juice 1L', 'Apple Juice 500ml', 'Water Bottle 500ml', 'Milk 1L'],
    'Ingredients': ['Coffee Beans 1kg', 'Sugar 1kg', 'Salt 500g', 'Black Pepper 100g', 'Tomato Sauce 400ml', 'Olive Oil 500ml']
  };
  
  // --- 1. API DATA FETCHING ---
   const fetchSpillageData = async () => {
    setIsLoading(true);
    try {
        const token = localStorage.getItem('authToken');
        const username = localStorage.getItem('username');
        if (!token) {
            throw new Error("Authentication token not found.");
        }
        if (!username) {
            throw new Error("Username not found in localStorage.");
        }
        // Build URL with cashier_name query parameter
        const url = `http://127.0.0.1:9003/wastelogs/?cashier_name=${encodeURIComponent(username)}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        // Map API data to the format your component's state expects
        const formattedData = data.map(entry => ({
            id: entry.spillage_id,
            timestamp: new Date(entry.logged_at).toLocaleString(),
            type: 'Product', // Assuming 'Product' based on data structure
            category: entry.category,
            productName: entry.product_name,
            quantitySpilled: entry.quantity,
            unit: 'pcs', // Default unit, as API doesn't provide it
            reason: entry.reason,
            reportedBy: entry.cashier_name
        }));
        setSpillageEntries(formattedData);
    } catch (error) {
        console.error("Failed to fetch spillage data:", error);
        alert("Could not fetch spillage data. Please check your connection or log in again.");
    } finally {
        setIsLoading(false);
    }
  };

  // Run the fetch function when the component mounts
  useEffect(() => {
    fetchSpillageData();
  }, []);


  // --- FORM LOGIC (mostly unchanged) ---
  const getAvailableProducts = () => {
    if (formData.type === 'Ingredients') return productsByCategory['Ingredients'] || [];
    if (formData.type === 'Product' && formData.category) return productsByCategory[formData.category] || [];
    return [];
  };
  const filteredProducts = getAvailableProducts().filter(product => product.toLowerCase().includes(productSearchTerm.toLowerCase()));
  useEffect(() => {
    setFormData(prev => ({ ...prev, productName: '', category: '' }));
    setProductSearchTerm('');
  }, [formData.type]);
  useEffect(() => {
    setFormData(prev => ({ ...prev, productName: '' }));
    setProductSearchTerm('');
  }, [formData.category]);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleProductSearch = (e) => {
    setProductSearchTerm(e.target.value);
    setIsProductDropdownOpen(true);
  };
  const handleProductSelect = (product) => {
    setFormData(prev => ({ ...prev, productName: product }));
    setProductSearchTerm(product);
    setIsProductDropdownOpen(false);
  };
  const handleProductInputFocus = () => setIsProductDropdownOpen(true);
  const handleProductInputBlur = () => setTimeout(() => setIsProductDropdownOpen(false), 200);

  const handleModalOpen = () => {
    setFormData({ type: '', productName: '', category: '', quantitySpilled: '', unit: 'pieces', reason: '' });
    setProductSearchTerm('');
    setShowModal(true);
  };
  const handleModalClose = () => {
    setShowModal(false);
  };

  // --- 2. UPDATED SUBMIT HANDLER TO POST TO API ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type || !formData.productName || !formData.quantitySpilled || !formData.reason || (formData.type === 'Product' && !formData.category)) {
      alert('Please fill in all required fields.');
      return;
    }

    // Create a payload object matching the API's expected structure
    const payload = {
        product_name: formData.productName,
        category: formData.category,
        quantity: parseInt(formData.quantitySpilled, 10), // Ensure quantity is a number
        reason: formData.reason,
        spillage_date: new Date().toISOString().split('T')[0], // Set current date
    };

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('http://127.0.0.1:9003/wastelogs/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
        }

        alert('Spillage logged successfully!');
        handleModalClose();
        fetchSpillageData(); // Refresh the data table to show the new entry

    } catch (error) {
        console.error('Failed to log spillage:', error);
        alert(`Error: ${error.message}`);
    }
  };

  // Filter logic (unchanged)
  const filteredSpillageEntries = spillageEntries.filter(entry => {
    const entryString = `${entry.productName} ${entry.type} ${entry.category} ${entry.reason}`.toLowerCase();
    const matchesSearch = entryString.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter ? entry.type === typeFilter : true;
    const matchesDate = dateFilter ? new Date(entry.timestamp).toLocaleDateString() === new Date(dateFilter).toLocaleDateString() : true;
    return matchesSearch && matchesType && matchesDate;
  });

  // DataTable columns (unchanged)
  const columns = [
    { name: "TIMESTAMP", selector: (row) => row.timestamp, sortable: true, minWidth: "180px" },
    { name: "TYPE", selector: (row) => row.type, sortable: true, minWidth: "120px" },
    { name: "CATEGORY", selector: (row) => row.category || '-', sortable: true, minWidth: "130px" },
    { name: "PRODUCT NAME", selector: (row) => row.productName, sortable: true, minWidth: "200px" },
    { name: "QUANTITY", selector: (row) => `${row.quantitySpilled} ${row.unit}`, sortable: true, minWidth: "120px" },
    { name: "REASON", selector: (row) => row.reason, wrap: true, minWidth: "200px" },
  ];

  return (
    <div className='cashier-spillage'>
      <Navbar />
      <div className="spillage-container">
        <div className="spillage-content">
          <div className="filter-bar">
            <input type="text" className="search-input" placeholder="Search spillage entries..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <input type="date" className="date-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            <select className="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {types.map((type) => (<option key={type} value={type}>{type}</option>))}
            </select>
          </div>

          <div className="spillage-table-container">
            <DataTable
              columns={columns}
              data={filteredSpillageEntries}
              progressPending={isLoading} // Show loading animation
              pagination striped highlightOnHover persistTableHead
              noDataComponent="No spillage entries found"
              customStyles={{
                headCells: { style: { backgroundColor: "#4B929D", color: "#fff", fontWeight: "600", fontSize: "14px", padding: "12px", textTransform: "uppercase" } },
                rows: { style: { minHeight: "55px", padding: "5px" } },
              }}
            />
          </div>

          {showModal && (
            <div className="cSpillage-modal-overlay" onClick={handleModalClose}>
              <div className="cSpillage-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="cSpillage-modal-header">
                  <h2 className="cSpillage-modal-title">Log New Spillage</h2>
                  <button className="cSpillage-modal-close" onClick={handleModalClose}><FaTimes /></button>
                </div>
                <div className="cSpillage-modal-body">
                  <form onSubmit={handleSubmit} className="cSpillage-form">
                    <div className="cSpillage-form-row">
                        <div className="cSpillage-form-group">
                            <label htmlFor="type" className="cSpillage-form-label">Type *</label>
                            <select id="type" name="type" value={formData.type} onChange={handleInputChange} className="cSpillage-form-input" required>
                                <option value="">Select type</option>
                                {types.map(type => (<option key={type} value={type}>{type}</option>))}
                            </select>
                        </div>
                        {formData.type === 'Product' && (
                            <div className="cSpillage-form-group">
                                <label htmlFor="category" className="cSpillage-form-label">Category *</label>
                                <select id="category" name="category" value={formData.category} onChange={handleInputChange} className="cSpillage-form-input" required>
                                    <option value="">Select category</option>
                                    {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                </select>
                            </div>
                        )}
                    </div>
                    {(formData.type === 'Ingredients' || (formData.type === 'Product' && formData.category)) && (
                        <div className="cSpillage-form-group">
                            <label htmlFor="productName" className="cSpillage-form-label">Product Name *</label>
                            <div className="cSpillage-dropdown">
                                <input type="text" id="productName" name="productName" value={productSearchTerm} onChange={handleProductSearch} onFocus={handleProductInputFocus} onBlur={handleProductInputBlur} placeholder="Search or type product..." className="cSpillage-form-input" required autoComplete="off" />
                                {isProductDropdownOpen && (
                                    <div className="cSpillage-dropdown-menu">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.map((product, index) => (<div key={index} className="cSpillage-dropdown-item" onMouseDown={() => handleProductSelect(product)}>{product}</div>))
                                        ) : (
                                            <div className="cSpillage-dropdown-item no-results">No products found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="cSpillage-form-row">
                        <div className="cSpillage-form-group">
                            <label htmlFor="quantitySpilled" className="cSpillage-form-label">Quantity Spilled *</label>
                            <input type="number" id="quantitySpilled" name="quantitySpilled" value={formData.quantitySpilled} onChange={handleInputChange} placeholder="0" min="1" className="cSpillage-form-input" required/>
                        </div>
                        <div className="cSpillage-form-group">
                            <label htmlFor="unit" className="cSpillage-form-label">Unit</label>
                            <select id="unit" name="unit" value={formData.unit} onChange={handleInputChange} className="cSpillage-form-input">
                                {units.map(unit => (<option key={unit} value={unit}>{unit}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="cSpillage-form-group">
                        <label htmlFor="reason" className="cSpillage-form-label">Reason for Spillage *</label>
                        <input type="text" id="reason" name="reason" value={formData.reason} onChange={handleInputChange} placeholder="Describe the reason" className="cSpillage-form-input" required/>
                    </div>
                    <div className="cSpillage-modal-actions">
                        <button type="button" className="cSpillage-cancel-btn" onClick={handleModalClose}>Cancel</button>
                        <button type="submit" className="cSpillage-save-btn">Log Spillage</button>
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