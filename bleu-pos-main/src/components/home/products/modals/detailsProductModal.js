import "./detailsProductModal.css";
import { FaTimes } from "react-icons/fa";

const DetailsProductModal = ({ product, onClose }) => {
  if (!product) return null;

  const productImage =
    product.ProductImg || product.ProductImage || product.ImageUrl || "/placeholder.png";

  return (
    <div className="details-product-modal-overlay" onClick={onClose}>
      <div
        className="details-product-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="details-product-close-button" onClick={onClose}>
          <FaTimes />
        </button>

        <div className="details-product-image-wrapper">
          <img
            src={productImage}
            alt={product.ProductName}
            className="details-product-image"
          />
        </div>

        <h2 className="details-product-name">{product.ProductName}</h2>
        <hr className="details-product-divider" />

        <div className="details-product-modal-content">
          <div className="details-product-label">Category</div>
          <div className="details-product-value">{product.ProductCategory}</div>

          <div className="details-product-label">Description</div>
          <div className="details-product-description">
            {product.ProductDescription || "No description available."}
          </div>

          <div className="details-product-label">Size</div>
          <div className="details-product-value">
            {Array.isArray(product.ProductSizes) && product.ProductSizes.length > 0
              ? product.ProductSizes.join(", ")
              : product.ProductSize || "N/A"}
          </div>

          <div className="details-product-label">Price</div>
          <div className="details-product-value">
            ₱{Number(product.ProductPrice).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsProductModal;
