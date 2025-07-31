import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/products.css"; 
import Sidebar from "../sidebar";
import Header from "../admin/header"; // Import the Header component
import DataTable from "react-data-table-component";

const API_BASE_URL = "http://127.0.0.1:8001";
const getAuthToken = () => localStorage.getItem("authToken");

function Products() {
  const navigate = useNavigate();

  // Remove all header-related state since Header component handles it
  const [activeTab, setActiveTab] = useState(null);
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Remove handleLogout since Header component handles it
  
  const fetchProductTypes = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ProductType/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch product types");
      const data = await response.json();
      setProductTypes(data);
      if (data.length > 0) {
        setActiveTab(currentTab => currentTab === null ? data[0].productTypeID : currentTab);
      }
    } catch (err) {
      console.error(err);
      setError(error => error || err.message);
    }
  }, []);

  const fetchProducts = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/is_products/products/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError(error => error || err.message);
    }
  }, []);

  // Simplified useEffect - Header component handles authentication
  useEffect(() => {
    const token = getAuthToken();
    
    if (!token) {
      navigate('/');
      return;
    }
    
    setIsLoading(true);
    Promise.all([
      fetchProductTypes(token),
      fetchProducts(token)
    ]).catch(err => {
      console.error("Error during data fetching:", err);
      setError("Could not load all required data.");
    }).finally(() => {
      setIsLoading(false);
    });
  }, [navigate, fetchProductTypes, fetchProducts]);

  const filteredProductsForActiveTab = useMemo(() => {
    if (!activeTab || products.length === 0) return [];
    
    return products.filter(product => {
      const matchesTab = product.ProductTypeID === activeTab;
      const matchesSearch = (product.ProductName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "" || product.ProductCategory === categoryFilter;
      const matchesSize = sizeFilter === "" || (product.ProductSizes && product.ProductSizes.includes(sizeFilter));
      
      return matchesTab && matchesSearch && matchesCategory && matchesSize;
    });
  }, [activeTab, products, searchTerm, categoryFilter, sizeFilter]);

  // Get unique categories and sizes for the current tab
  const uniqueCategories = useMemo(() => {
    if (!activeTab || products.length === 0) return [];
    const currentTabProducts = products.filter(product => product.ProductTypeID === activeTab);
    return [...new Set(currentTabProducts.map(item => item.ProductCategory).filter(Boolean))];
  }, [activeTab, products]);

  const uniqueSizes = useMemo(() => {
    if (!activeTab || products.length === 0) return [];
    const currentTabProducts = products.filter(product => product.ProductTypeID === activeTab);
    const allSizes = currentTabProducts.flatMap(item => item.ProductSizes || []);
    return [...new Set(allSizes)];
  }, [activeTab, products]);

  // Reset filters when tab changes
  useEffect(() => {
    setCategoryFilter("");
    setSizeFilter("");
    setSearchTerm("");
  }, [activeTab]);

  const DEFAULT_PRODUCT_IMAGE = "/images/default-product.png"; // adjust as needed

  const columns = [
    {
      name: "PRODUCT",
      selector: (row) => row.ProductName,
      cell: (row) => (
        <div className="food-info">
          <img
            src={row.ProductImage || DEFAULT_PRODUCT_IMAGE}
            alt={row.ProductName}
            className="food-photo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = DEFAULT_PRODUCT_IMAGE;
            }}
          />
          <div>
            <div className="food-name">{row.ProductName}</div>
          </div>
        </div>
      ),
      sortable: true,
      width: "20%",
    },
    {
      name: "DESCRIPTION",
      selector: (row) => row.ProductDescription,
      wrap: true,
      width: "20%",
    },
    {
      name: "CATEGORY",
      selector: (row) => row.ProductCategory,
      center: true,
      sortable: true,
      width: "20%",
    },
    {
      name: "SIZES",
      selector: (row) => row.ProductSizes?.join(" & ") || "N/A",
      center: true,
      width: "20%",
    },
    {
      name: "PRICE",
      selector: (row) => `₱${parseFloat(row.ProductPrice).toFixed(2)}`,
      center: true,
      sortable: true,
      width: "20%",
    },
  ];

  return (
    <div className="productList">
      <Sidebar />
      <div className="products">
        <Header pageTitle="Products" />
        
        <div className="products-content">
          {isLoading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'start', 
              alignItems: 'start', 
              height: '400px',
              fontSize: '18px'
            }}>
              <p>Loading Products...</p>
            </div>
          ) : error ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '400px',
              fontSize: '18px',
              color: 'red'
            }}>
              Error: {error}
            </div>
          ) : (
            <>
              <div className="tabs">
                {productTypes.map((type) => (
                  <button 
                    key={type.productTypeID} 
                    className={`tab ${activeTab === type.productTypeID ? "active-tab" : ""}`} 
                    onClick={() => setActiveTab(type.productTypeID)}
                  >
                    {type.productTypeName}
                  </button>
                ))}
              </div>
              
              <div className="tab-content">
                <div className="filter-bar">
                  <input 
                    type="text" 
                    placeholder="Search Products..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select 
                    value={categoryFilter} 
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">Category: All</option>
                    {uniqueCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select 
                    value={sizeFilter} 
                    onChange={(e) => setSizeFilter(e.target.value)}
                  >
                    <option value="">Size: All</option>
                    {uniqueSizes.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                
                <div className="products-table-container">
                <DataTable 
                  columns={columns} 
                  data={filteredProductsForActiveTab} 
                  striped 
                  highlightOnHover 
                  responsive 
                  pagination
                  fixedHeader
                  fixedHeaderScrollHeight="60vh"
                  noDataComponent={
                    <div style={{padding: "24px"}}>
                      No products found in this category.
                    </div>
                  }
                  customStyles={{
                        headCells: {
                          style: {
                            backgroundColor: "#4B929D",
                            color: "#fff",
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Products;