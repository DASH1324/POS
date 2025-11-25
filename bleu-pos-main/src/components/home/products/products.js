import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../products/products.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import DataTable from "react-data-table-component";
import DetailsProductModal from "./modals/detailsProductModal";
import Loading from "../shared/loading";
import { FaFilter, FaSearch } from "react-icons/fa";
import '../../confirmAlertCustom.css';
import { UnableToLoadData, NoData } from "../shared/exportModal";

const API_BASE_URL = "http://127.0.0.1:8001";
const MERCHANDISE_API_URL = "http://127.0.0.1:8002";
const getAuthToken = () => localStorage.getItem("authToken");

function Products() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(null);
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [merchandise, setMerchandise] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProductTypes = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ProductType/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch product types");
      const data = await response.json();
      setProductTypes(data);

      if (data.length > 0) {
        setActiveTab((currentTab) =>
          currentTab === null ? data[0].productTypeID : currentTab
        );
      }
    } catch (err) {
      console.error(err);
      setError((error) => error || err.message);
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
      setError((error) => error || err.message);
    }
  }, []);

  const fetchMerchandise = useCallback(async (token) => {
  try {
    const response = await fetch(`${MERCHANDISE_API_URL}/merchandise/menu`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch merchandise: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log("Merchandise data:", data);
    setMerchandise(data);
  } catch (err) {
    console.error("Merchandise fetch error:", err);
    setError((error) => error || err.message);
  }
}, []);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      navigate("/");
      return;
    }

    setIsLoading(true);
    Promise.all([
      fetchProductTypes(token),
      fetchProducts(token),
      fetchMerchandise(token),
    ])
      .catch((err) => {
        console.error("Error during data fetching:", err);
        setError("Could not load all required data.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [navigate, fetchProductTypes, fetchProducts, fetchMerchandise]);

  const filteredProductsForActiveTab = useMemo(() => {
    if (!activeTab) return [];

    if (activeTab === "merch") {
      return merchandise.filter((merch) => {
        const matchesSearch = (merch.MerchandiseName || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        return matchesSearch;
      });
    }

    return products.filter((product) => {
      const matchesTab = product.ProductTypeID === activeTab;
      const matchesSearch = (product.ProductName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        categoryFilter === "" || product.ProductCategory === categoryFilter;
      const matchesSize =
        sizeFilter === "" ||
        (product.ProductSizes && product.ProductSizes.includes(sizeFilter));

      return matchesTab && matchesSearch && matchesCategory && matchesSize;
    });
  }, [activeTab, products, merchandise, searchTerm, categoryFilter, sizeFilter]);

  const uniqueCategories = useMemo(() => {
    if (!activeTab || products.length === 0) return [];

    if (activeTab === "merch") {
      return [];
    }

    const currentTabProducts = products.filter(
      (product) => product.ProductTypeID === activeTab
    );
    return [
      ...new Set(
        currentTabProducts.map((item) => item.ProductCategory).filter(Boolean)
      ),
    ];
  }, [activeTab, products]);

  const uniqueSizes = useMemo(() => {
    if (!activeTab || products.length === 0) return [];

    if (activeTab === "merch") {
      return [];
    }

    const currentTabProducts = products.filter(
      (product) => product.ProductTypeID === activeTab
    );

    const allSizes = currentTabProducts.flatMap(
      (item) => item.ProductSizes || []
    );
    return [...new Set(allSizes)];
  }, [activeTab, products]);

  useEffect(() => {
    setCategoryFilter("");
    setSizeFilter("");
    setSearchTerm("");
  }, [activeTab]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setSizeFilter("");
  };

  const DEFAULT_PRODUCT_IMAGE = "/images/default-product.png";

  const columns = useMemo(() => {
    if (activeTab === "merch") {
      return [
        {
          name: "MERCHANDISE",
          selector: (row) => row.MerchandiseImage,
          cell: (row) => (
            <img
              src={row.MerchandiseImage || DEFAULT_PRODUCT_IMAGE}
              alt={row.MerchandiseName}
              className="productList-itemPhoto"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = DEFAULT_PRODUCT_IMAGE;
              }}
            />
          ),
          width: "30%"
        },
        {
          name: "MERCHANDISE NAME",
          selector: (row) => row.MerchandiseName,
          sortable: true,
          width: "40%",
        },
        {
          name: "PRICE",
          selector: (row) => `₱${parseFloat(row.MerchandisePrice || 0).toFixed(2)}`,
          sortable: true,
          width: "30%",
        },
      ];
    }

    return [
      {
        name: "PRODUCT",
        selector: (row) => row.ProductName,
        cell: (row) => (
          <div className="productList-itemInfo">
            <img
              src={row.ProductImage || DEFAULT_PRODUCT_IMAGE}
              alt={row.ProductName}
              className="productList-itemPhoto"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = DEFAULT_PRODUCT_IMAGE;
              }}
            />
            <div>
              <div className="productList-itemName">{row.ProductName}</div>
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
  }, [activeTab]);

  return (
    <div className="productList">
      <Sidebar />
      <div className="productList-container">
        <Header pageTitle="Products" />

        <div className="productList-content">
          {error ? (
            <UnableToLoadData />
          ) : (
            <>
              {/* Tabs and Filter Wrapper */}
              <div className="productList-tabs-filter-wrapper">
                {/* Tabs - Left Side */}
                <div className="productList-tabs">
                  {productTypes.map((type) => (
                    <button
                      key={type.productTypeID}
                      className={`productList-tab ${
                        activeTab === type.productTypeID ? "productList-tab--active" : ""
                      }`}
                      onClick={() => setActiveTab(type.productTypeID)}
                    >
                      {type.productTypeName}
                    </button>
                  ))}
                  <button
                    className={`productList-tab ${
                      activeTab === "merch" ? "productList-tab--active" : ""
                    }`}
                    onClick={() => setActiveTab("merch")}
                  >
                    Merchandise
                  </button>
                </div>

                {/* Filter Bar - Right Side */}
                {!isLoading && (
                  <div className={`productList-filterBar ${isFilterOpen ? "open" : "collapsed"}`}>
                    <button
                      className="productList-filter-toggle-btn"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                    >
                      <FaFilter />
                    </button>

                    <div className="productList-filter-item">
                      <div className="productList-search-wrapper">
                        <FaSearch className="productList-search-icon" />
                        <input
                          type="text"
                          placeholder={activeTab === "merch" ? "Search Merchandise..." : "Search Products..."}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="productList-search-input"
                        />
                      </div>
                    </div>

                    {activeTab !== "merch" && (
                      <>
                        <div className="productList-filter-item">
                          <span>Category:</span>
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="productList-select"
                          >
                            <option value="">All Categories</option>
                            {uniqueCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="productList-filter-item">
                          <span>Size:</span>
                          <select
                            value={sizeFilter}
                            onChange={(e) => setSizeFilter(e.target.value)}
                            className="productList-select"
                          >
                            <option value="">All Sizes</option>
                            {uniqueSizes.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <button 
                      className="productList-clearBtn" 
                      onClick={handleClearFilters}
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>

              {/* Loading State */}
              {isLoading ? (
                <Loading/>
              ) : (
                <div className="productList-tableContainer">
                  <DataTable
                    columns={columns}
                    data={filteredProductsForActiveTab}
                    striped
                    highlightOnHover
                    responsive
                    pagination
                    paginationPerPage={5} 
                    paginationRowsPerPageOptions={[5]}
                    fixedHeader
                    fixedHeaderScrollHeight="60vh"
                    onRowClicked={(row) => {
                      if (activeTab === "merch") {
                        // Normalize merchandise data to expected product properties
                        const normalizedMerch = {
                          ...row,
                          ProductImage: row.MerchandiseImage || row.ProductImage,
                          ProductName: row.MerchandiseName || row.ProductName,
                          ProductCategory: row.MerchandiseCategory || row.ProductCategory || "Merchandise",
                          ProductSizes: row.MerchandiseSizes || row.ProductSizes || [],
                          ProductSize: row.MerchandiseSize || row.ProductSize || "",
                          ProductPrice: row.MerchandisePrice || row.ProductPrice || 0,
                          ProductDescription: row.MerchandiseDescription || row.ProductDescription || "",
                          ProductImg: row.MerchandiseImage || row.ProductImg,
                          ImageUrl: row.MerchandiseImage || row.ImageUrl,
                        };
                        setSelectedProduct(normalizedMerch);
                      } else {
                        setSelectedProduct(row);
                      }
                    }}
                    noDataComponent={<NoData />}
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
                      rows: { style: { minHeight: "55px", padding: "5px" } },
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedProduct && (
        <DetailsProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

export default Products;