import React, { useState } from 'react';
import { Upload, Link } from 'lucide-react';
import "../receipt/receipt.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import Loading from "../shared/loading";
import dayjs from 'dayjs';

function Receipt() {
  const [receiptData, setReceiptData] = useState({
    storeName: 'BLEU BEAN CAFE',
    vatRegTin: 'XXX-XXX-XXX-XXX',
    address1: 'Don Fabian St., Commonwealth',
    address2: 'Quezon City, Philippines',
    telephone: 'NULL',
    showQR: true,
    qrType: 'link',
    qrLink: '',
    qrImage: null,
    qrText: 'Scan to learn more about us!',
    additionalText: ''
  });

  const [previewOrder] = useState({
    id: '12345',
    date: new Date(),
    cashierName: 'John Doe',
    orderItems: [
      {
        name: 'Caramel Macchiato',
        price: 150,
        quantity: 2,
        addons: [
          { name: 'Extra Shot', price: 30, quantity: 1 }
        ],
        itemDiscounts: [],
        itemPromotions: []
      },
      {
        name: 'Blueberry Cheesecake',
        price: 120,
        quantity: 1,
        addons: [],
        itemDiscounts: [
          { discountName: 'Senior', quantityDiscounted: 1, discountAmount: 24 }
        ],
        itemPromotions: []
      }
    ]
  });

  const handleInputChange = (field, value) => {
    setReceiptData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptData(prev => ({
          ...prev,
          qrImage: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    console.log('Saving receipt data:', receiptData);
    alert('Receipt settings saved successfully!');
  };

  const getTotalRefundAmount = () => 0;
  const hasRefunds = false;

  return (
    <div className='receipt-editor'>
      <Sidebar />
      <div className="receipt-container">
        <Header pageTitle="Receipt" />
        <div className="receipt-content">
          
          <div className="editReceipt-container">
            {/* Editor Panel */}
            <div className="editReceipt-editor-panel">
              <h2 className="editReceipt-title">Store Information</h2>
              
              <div className="editReceipt-form-grid">
                {/* First Column */}
                <div className="editReceipt-form-column">
                  <div className="editReceipt-field">
                    <label className="editReceipt-label">
                      Store Name
                    </label>
                    <input
                      type="text"
                      value={receiptData.storeName}
                      onChange={(e) => handleInputChange('storeName', e.target.value)}
                      placeholder="Enter store name"
                      className="editReceipt-input"
                    />
                  </div>

                  <div className="editReceipt-field">
                    <label className="editReceipt-label">
                      VAT REG TIN
                    </label>
                    <input
                      type="text"
                      value={receiptData.vatRegTin}
                      onChange={(e) => handleInputChange('vatRegTin', e.target.value)}
                      placeholder="XXX-XXX-XXX-XXX"
                      className="editReceipt-input"
                    />
                  </div>

                  <div className="editReceipt-field">
                    <label className="editReceipt-label">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={receiptData.address1}
                      onChange={(e) => handleInputChange('address1', e.target.value)}
                      placeholder="Street address"
                      className="editReceipt-input"
                    />
                  </div>

                  <div className="editReceipt-field">
                    <label className="editReceipt-label">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={receiptData.address2}
                      onChange={(e) => handleInputChange('address2', e.target.value)}
                      placeholder="City, Province"
                      className="editReceipt-input"
                    />
                  </div>

                  <div className="editReceipt-field">
                    <label className="editReceipt-label">
                      Telephone
                    </label>
                    <input
                      type="text"
                      value={receiptData.telephone}
                      onChange={(e) => handleInputChange('telephone', e.target.value)}
                      placeholder="Contact number"
                      className="editReceipt-input"
                    />
                  </div>
                </div>

                {/* Second Column - QR Settings */}
                <div className="editReceipt-form-column">
                  <div className="editReceipt-field">
                    <label className="editReceipt-checkbox-label">
                      <input
                        type="checkbox"
                        checked={receiptData.showQR}
                        onChange={(e) => handleInputChange('showQR', e.target.checked)}
                        className="editReceipt-checkbox"
                      />
                      <span>Show QR Code on Receipt</span>
                    </label>
                  </div>

                  {receiptData.showQR && (
                    <>
                      <div className="editReceipt-field">
                        <label className="editReceipt-label">
                          QR Code Type
                        </label>
                        <div className="editReceipt-qr-type-options">
                          <label className={`editReceipt-qr-option ${receiptData.qrType === 'link' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="qrType"
                              value="link"
                              checked={receiptData.qrType === 'link'}
                              onChange={(e) => handleInputChange('qrType', e.target.value)}
                            />
                            <Link size={16} />
                            <span>Link/URL</span>
                          </label>
                          <label className={`editReceipt-qr-option ${receiptData.qrType === 'image' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="qrType"
                              value="image"
                              checked={receiptData.qrType === 'image'}
                              onChange={(e) => handleInputChange('qrType', e.target.value)}
                            />
                            <Upload size={16} />
                            <span>Image</span>
                          </label>
                        </div>
                      </div>

                      {receiptData.qrType === 'link' ? (
                        <div className="editReceipt-field">
                          <label className="editReceipt-label">
                            QR Code Link
                          </label>
                          <input
                            type="url"
                            value={receiptData.qrLink}
                            onChange={(e) => handleInputChange('qrLink', e.target.value)}
                            placeholder="https://example.com"
                            className="editReceipt-input"
                          />
                        </div>
                      ) : (
                        <div className="editReceipt-field">
                          <label className="editReceipt-label">
                            Upload QR Code Image
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="editReceipt-input editReceipt-file-input"
                          />
                          {receiptData.qrImage && (
                            <div className="editReceipt-qr-preview">
                              <img 
                                src={receiptData.qrImage} 
                                alt="QR Preview"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="editReceipt-field">
                        <label className="editReceipt-label">
                          QR Code Caption
                        </label>
                        <input
                          type="text"
                          value={receiptData.qrText}
                          onChange={(e) => handleInputChange('qrText', e.target.value)}
                          placeholder="e.g., Scan to learn more!"
                          className="editReceipt-input"
                        />
                      </div>

                      <div className="editReceipt-field">
                        <label className="editReceipt-label">
                          Additional Text
                        </label>
                        <textarea
                          value={receiptData.additionalText}
                          onChange={(e) => handleInputChange('additionalText', e.target.value)}
                          placeholder="Add more information..."
                          className="editReceipt-input editReceipt-textarea"
                          rows="3"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handleSave}
                className="editReceipt-save-btn"
              >
                Save
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="editReceipt-preview-panel">
              <div className="editReceipt-preview-wrapper">
                <h3 className="editReceipt-preview-title">Receipt Preview</h3>
                
                <div className="editReceipt-receipt-print" id="editReceipt-print-section">
                  <div className="editReceipt-receipt-header">
                    <div className="editReceipt-store-name">{receiptData.storeName}</div>
                    <div className="editReceipt-store-tin">VATREGTIN: {receiptData.vatRegTin}</div>
                    <div className="editReceipt-store-address">{receiptData.address1}</div>
                    <div className="editReceipt-store-address">{receiptData.address2}</div>
                    <div className="editReceipt-store-contact">TEL #: {receiptData.telephone}</div>
                    <div className="editReceipt-receipt-divider">
                      {dayjs(previewOrder.date).format("MM/DD/YYYY")} {dayjs(previewOrder.date).format("hh:mm A")}
                    </div>
                    <div className="editReceipt-receipt-info">
                      <div className="editReceipt-receipt-info-left">
                        <div>INVOICE: #{previewOrder.id}</div>
                        <div>STAFF: {previewOrder.cashierName}</div>
                      </div>
                    </div>    
                  </div>

                  <div className="editReceipt-receipt-body">
                    {(() => {
                      let totalNetAmt = 0;
                      let totalScPwdDisc = 0;
                      
                      return previewOrder.orderItems.map((item, i) => {
                        const itemTotal = item.price * item.quantity;
                        const addonsTotal = item.addons?.reduce((sum, addon) => sum + ((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)), 0) || 0;
                        const fullItemTotal = itemTotal + addonsTotal;
                        
                        const itemDiscounts = (item.itemDiscounts || []).map(d => ({ name: d.discountName, quantity: d.quantityDiscounted, amount: d.discountAmount }));
                        const itemPromotions = (item.itemPromotions || []).map(p => ({ name: p.promotionName, quantity: p.quantityPromoted, amount: p.promotionAmount }));
                        
                        const combinedDiscounts = {};
                        const scPwdDiscounts = [];
                        [...itemDiscounts, ...itemPromotions].forEach(d => {
                          if (d.name === 'PWD' || d.name === 'Senior') {
                            scPwdDiscounts.push(d);
                            totalScPwdDisc += d.amount;
                          } else {
                            if (!combinedDiscounts[d.name]) combinedDiscounts[d.name] = { name: d.name, totalQuantity: 0, totalAmount: 0 };
                            combinedDiscounts[d.name].totalQuantity += d.quantity;
                            combinedDiscounts[d.name].totalAmount += d.amount;
                          }
                        });
                        
                        const totalItemDiscount = Object.values(combinedDiscounts).reduce((sum, d) => sum + d.totalAmount, 0) + scPwdDiscounts.reduce((sum, d) => sum + d.amount, 0);
                        const netAmt = fullItemTotal - totalItemDiscount;
                        totalNetAmt += netAmt;
                        
                        return (
                          <div key={i} className="editReceipt-receipt-item">
                            <div className="editReceipt-receipt-line">
                              <span className="editReceipt-receipt-item-name">{item.name}</span>
                            </div>
                            <div className="editReceipt-receipt-line editReceipt-receipt-qty-price">
                              <span>{item.price.toFixed(2)} x {item.quantity}</span>
                              <span>{itemTotal.toFixed(2)}</span>
                            </div>
                            {item.addons?.length > 0 && item.addons.map((addon, idx) => (
                              <div key={idx} className="editReceipt-receipt-line editReceipt-receipt-qty-price">
                                <span>{addon.name} {addon.price.toFixed(2)} x {(addon.quantity || 1) * (item.quantity || 1)}</span>
                                <span>{((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)).toFixed(2)}</span>
                              </div>
                            ))}
                            {Object.values(combinedDiscounts).map((discount, discIdx) => (
                              <div key={discIdx} className="editReceipt-receipt-line editReceipt-receipt-qty-price">
                                <span>{discount.name}{discount.totalQuantity > 1 ? ` (x${discount.totalQuantity})` : ''}</span>
                                <span>-{discount.totalAmount.toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="editReceipt-receipt-line editReceipt-receipt-net-amt">
                              <span>NET AMT:</span>
                              <span>{netAmt.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="editReceipt-receipt-divider">------------------------------------------</div>

                  <div className="editReceipt-receipt-summary">
                    {(() => {
                      let totalNetAmt = 0;
                      let totalScPwdDisc = 0;
                      previewOrder.orderItems.forEach(item => {
                        const itemTotal = item.price * item.quantity;
                        const addonsTotal = item.addons?.reduce((sum, addon) => sum + ((addon.price || 0) * (addon.quantity || 1) * (item.quantity || 1)), 0) || 0;
                        const fullItemTotal = itemTotal + addonsTotal;
                        
                        const itemDiscounts = (item.itemDiscounts || []).map(d => ({ name: d.discountName, amount: d.discountAmount }));
                        const itemPromotions = (item.itemPromotions || []).map(p => ({ name: p.promotionName, amount: p.promotionAmount }));
                        
                        const totalItemDiscount = [...itemDiscounts, ...itemPromotions].reduce((sum, d) => {
                          if (d.name === 'PWD' || d.name === 'Senior Citizen') {
                            totalScPwdDisc += d.amount;
                          }
                          return sum + d.amount;
                        }, 0);
                        
                        const netAmt = fullItemTotal - totalItemDiscount;
                        totalNetAmt += netAmt;
                      });
                      
                      return (
                        <>
                          <div className="editReceipt-receipt-line editReceipt-receipt-total">
                            <span>TOTAL:</span>
                            <span>{totalNetAmt.toFixed(2)}</span>
                          </div>

                          {hasRefunds && (
                            <div className="editReceipt-receipt-line">
                              <span>REFUND:</span>
                              <span>-₱{getTotalRefundAmount().toFixed(2)}</span>
                            </div>
                          )}            

                          <div className="editReceipt-receipt-qty-price">
                            <div className="editReceipt-receipt-line">
                              <span>Vatable:</span>
                              <span>0.00</span>
                            </div>
                            <div className="editReceipt-receipt-line">
                              <span>VAT_Amt:</span>
                              <span>0.00</span>
                            </div>
                            <div className="editReceipt-receipt-line">
                              <span>Zero-Rated Sales:</span>
                              <span>0.00</span>
                            </div>
                            <div className="editReceipt-receipt-line">
                              <span>VAT Exempt Sales:</span>
                              <span>{(totalNetAmt - getTotalRefundAmount()).toFixed(2)}</span>
                            </div>
                            {totalScPwdDisc > 0 && (
                              <div className="editReceipt-receipt-line">
                                <span>TOTAL SC/PWD DISC:</span>
                                <span>{totalScPwdDisc.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="editReceipt-receipt-divider">------------------------------------------</div>
                  
                  {receiptData.showQR && (
                    <div className="editReceipt-receipt-footer">
                      <div className="editReceipt-qr-section">
                        {receiptData.qrType === 'image' && receiptData.qrImage ? (
                          <img 
                            src={receiptData.qrImage} 
                            alt="QR Code"
                            className="editReceipt-qr-image"
                          />
                        ) : (
                          <div className="editReceipt-qr-placeholder">
                            {receiptData.qrType === 'link' && receiptData.qrLink ? 
                              `QR: ${receiptData.qrLink.substring(0, 20)}...` : 
                              'QR CODE'}
                          </div>
                        )}
                        <div className="editReceipt-qr-text">{receiptData.qrText}</div>
                        {receiptData.additionalText && (
                          <div className="editReceipt-additional-text">
                            {receiptData.additionalText}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Receipt