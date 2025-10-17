import "./detailsProductModal.css";

const DetailsProductModal = ({ product, onClose }) => {
  if (!product) return null;

  const productImage =
    product.ProductImg || product.ProductImage || product.ImageUrl || "/placeholder.png";

  return (
    <div className="details-modal-overlay" onClick={onClose}>
      <div className="details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button only */}
        <button className="details-close-modal" onClick={onClose}>
          ×
        </button>

        <div className="details-modal-content">
          <div className="details-main-section">
            {/* LEFT: IMAGE */}
            <div className="details-image-wrapper">
              <img
                src={productImage}
                alt={product.ProductName}
                className="details-image"
              />
            </div>

            {/* RIGHT: INFO */}
            <div className="details-info-section">
              <h2 className="details-product-name">{product.ProductName}</h2>

              <div className="details-info-grid">
                <div className="details-info-item">
                  <span className="details-label">Category</span>
                  <span className="details-value">{product.ProductCategory}</span>
                </div>

                <div className="details-info-item">
                  <span className="details-label">Size</span>
                  <span className="details-value">
                    {Array.isArray(product.ProductSizes) && product.ProductSizes.length > 0
                      ? product.ProductSizes.join(", ")
                      : product.ProductSize || "N/A"}
                  </span>
                </div>

                <div className="details-info-item">
                  <span className="details-label">Price</span>
                  <span className="details-value">
                    ₱{Number(product.ProductPrice).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* DESCRIPTION directly under info grid */}
              <div className="details-description-section">
                <span className="details-label">Description</span>
                <p className="details-description">
                  {product.ProductDescription || "No description available."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsProductModal;
