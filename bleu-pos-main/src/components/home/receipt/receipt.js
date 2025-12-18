import React, { useState, useEffect } from 'react';
import { Upload, Link } from 'lucide-react';
import "../receipt/receipt.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import Loading from "../shared/loading";
import dayjs from 'dayjs';
import axios from 'axios';
import QRCode from 'qrcode';

const API_BASE_URL = 'http://127.0.0.1:9006/api';

function Receipt() {
  const [receiptData, setReceiptData] = useState({
    storeName: '',
    vatRegTin: '',
    address1: '',
    address2: '',
    telephone: '',
    showQR: true,
    qrType: 'link',
    qrLink: '',
    qrImagePath: '',
    qrText: '',
    additionalText: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [configExists, setConfigExists] = useState(false);
  const [qrImagePreview, setQrImagePreview] = useState(null);
  const [generatedQRCode, setGeneratedQRCode] = useState(null);

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

  // Get token from localStorage
  const getToken = () => {
    // Try different possible token keys
    return localStorage.getItem('authToken') || 
           localStorage.getItem('token') || 
           localStorage.getItem('access_token');
  };

  // Fetch receipt configuration on component mount
  useEffect(() => {
    fetchReceiptConfig();
  }, []);

  // Generate QR code when link changes
  useEffect(() => {
    if (receiptData.qrType === 'link' && receiptData.qrLink) {
      generateQRCode(receiptData.qrLink);
    } else {
      setGeneratedQRCode(null);
    }
  }, [receiptData.qrType, receiptData.qrLink]);

  const generateQRCode = async (url) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setGeneratedQRCode(qrDataUrl);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setGeneratedQRCode(null);
    }
  };

  const fetchReceiptConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getToken();
      const response = await axios.get(`${API_BASE_URL}/receipt/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const config = response.data;
      setReceiptData({
        storeName: config.storeName || '',
        vatRegTin: config.vatRegTin || '',
        address1: config.address1 || '',
        address2: config.address2 || '',
        telephone: config.telephone || '',
        showQR: config.showQR ?? true,
        qrType: config.qrType || 'link',
        qrLink: config.qrLink || '',
        qrImagePath: config.qrImagePath || '',
        qrText: config.qrText || '',
        additionalText: config.additionalText || ''
      });

      // If there's a QR image path, you might want to load it
      if (config.qrImagePath) {
        setQrImagePreview(config.qrImagePath);
      }

      setConfigExists(true);
    } catch (err) {
      if (err.response?.status === 404) {
        // No config exists yet, use default values
        setConfigExists(false);
        setReceiptData({
          storeName: 'BLEU BEAN CAFE',
          vatRegTin: 'XXX-XXX-XXX-XXX',
          address1: 'Don Fabian St., Commonwealth',
          address2: 'Quezon City, Philippines',
          telephone: 'NULL',
          showQR: true,
          qrType: 'link',
          qrLink: '',
          qrImagePath: '',
          qrText: 'Scan to learn more about us!',
          additionalText: ''
        });
      } else {
        setError('Failed to load receipt configuration');
        console.error('Error fetching receipt config:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setReceiptData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Preview the image
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // TODO: Upload image to your server/storage
      // For now, we'll just store the file name
      // You'll need to implement an image upload endpoint
      // Example:
      // const formData = new FormData();
      // formData.append('file', file);
      // const uploadResponse = await axios.post(`${API_BASE_URL}/upload/qr-image`, formData);
      // const imagePath = uploadResponse.data.path;
      
      // For demonstration, using local file name
      handleInputChange('qrImagePath', file.name);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const token = getToken();
      
      const payload = {
        storeName: receiptData.storeName,
        vatRegTin: receiptData.vatRegTin,
        address1: receiptData.address1,
        address2: receiptData.address2,
        telephone: receiptData.telephone,
        showQR: receiptData.showQR,
        qrType: receiptData.qrType,
        qrLink: receiptData.qrLink || null,
        qrImagePath: receiptData.qrImagePath || null,
        qrText: receiptData.qrText || null,
        additionalText: receiptData.additionalText || null
      };

      if (configExists) {
        // Update existing configuration
        await axios.put(`${API_BASE_URL}/receipt/`, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        alert('Receipt configuration updated successfully!');
      } else {
        // Create new configuration
        await axios.post(`${API_BASE_URL}/receipt/`, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        alert('Receipt configuration created successfully!');
        setConfigExists(true);
      }

      // Refresh the data
      await fetchReceiptConfig();
    } catch (err) {
      console.error('Error saving receipt config:', err);
      setError(err.response?.data?.detail || 'Failed to save receipt configuration');
      alert(`Error: ${err.response?.data?.detail || 'Failed to save receipt configuration'}`);
    } finally {
      setSaving(false);
    }
  };

  const getTotalRefundAmount = () => 0;
  const hasRefunds = false;

  if (loading) {
    return (
      <div className='receipt-editor'>
        <Sidebar />
        <div className="receipt-container">
          <Header pageTitle="Receipt" />
          <div className="receipt-content">
            <Loading />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='receipt-editor'>
      <Sidebar />
      <div className="receipt-container">
        <Header pageTitle="Receipt" />
        <div className="receipt-content">
          
          {error && (
            <div style={{ 
              padding: '10px', 
              marginBottom: '20px', 
              backgroundColor: '#fee', 
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00'
            }}>
              {error}
            </div>
          )}

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
                          {generatedQRCode && (
                            <div className="editReceipt-qr-preview">
                              <img 
                                src={generatedQRCode} 
                                alt="QR Preview"
                              />
                            </div>
                          )}
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
                          {qrImagePreview && (
                            <div className="editReceipt-qr-preview">
                              <img 
                                src={qrImagePreview} 
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
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
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
                        {receiptData.qrType === 'image' && qrImagePreview ? (
                          <img 
                            src={qrImagePreview} 
                            alt="QR Code"
                            className="editReceipt-qr-image"
                          />
                        ) : receiptData.qrType === 'link' && generatedQRCode ? (
                          <img 
                            src={generatedQRCode} 
                            alt="QR Code"
                            className="editReceipt-qr-image"
                          />
                        ) : (
                          <div className="editReceipt-qr-placeholder">
                            QR CODE
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