import React, { useState, useEffect } from 'react';
import { Upload, Link } from 'lucide-react';
import "../receipt/receipt.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header";
import Loading from "../shared/loading";
import axios from 'axios';
import QRCode from 'qrcode';
import dayjs from 'dayjs';

const API_BASE_URL = 'http://127.0.0.1:9006/api';

function Receipt() {
  const [receiptData, setReceiptData] = useState({
    storeName: '',
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
  const [blockchainQRCode, setBlockchainQRCode] = useState(null);

  // Get token from localStorage
  const getToken = () => {
    return localStorage.getItem('authToken') || 
           localStorage.getItem('token') || 
           localStorage.getItem('access_token');
  };

  // Fetch receipt configuration on component mount
  useEffect(() => {
    fetchReceiptConfig();
  }, []);

  // Generate QR codes when link changes
  useEffect(() => {
    if (receiptData.qrType === 'link' && receiptData.qrLink) {
      generateQRCode(receiptData.qrLink, setGeneratedQRCode);
    } else {
      setGeneratedQRCode(null);
    }
    
    // Always generate blockchain QR code for preview
    const blockchainUrl = `${window.location.origin}/blockchain?SAMPLE123`;
    generateQRCode(blockchainUrl, setBlockchainQRCode);
  }, [receiptData.qrType, receiptData.qrLink]);

  const generateQRCode = async (url, setQRCodeState) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQRCodeState(qrDataUrl);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setQRCodeState(null);
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

      if (config.qrImagePath) {
        setQrImagePreview(config.qrImagePath);
      }

      setConfigExists(true);
    } catch (err) {
      if (err.response?.status === 404) {
        setConfigExists(false);
        setReceiptData({
          storeName: 'BLEU BEAN CAFE',
          address1: 'Don Fabian St., Commonwealth',
          address2: 'Quezon City, Philippines',
          telephone: '0917XXXXXXX',
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
      // Validate file size (e.g., max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size should be less than 2MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setQrImagePreview(base64String);
        handleInputChange('qrImagePath', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const token = getToken();
      
      const payload = {
        storeName: receiptData.storeName,
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
        await axios.put(`${API_BASE_URL}/receipt/`, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        alert('Receipt configuration updated successfully!');
      } else {
        await axios.post(`${API_BASE_URL}/receipt/`, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        alert('Receipt configuration created successfully!');
        setConfigExists(true);
      }

      await fetchReceiptConfig();
    } catch (err) {
      console.error('Error saving receipt config:', err);
      let errorMessage = 'Failed to save receipt configuration';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map(err => `${err.loc?.slice(-1)?.[0] || 'Field'}: ${err.msg}`).join('; ');
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      }
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='receipt-editor'>
        <Sidebar />
        <div className="receipt-container">
          <Header pageTitle="Receipt Configuration" />
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
        <Header pageTitle="Receipt Configuration" />
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
              <h2 className="editReceipt-title">Non-Official Receipt Configuration</h2>
              
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
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>

            {/* Preview Panel */}
            <div className="editReceipt-preview-panel">
              <div className="editReceipt-preview-wrapper">
                <h3 className="editReceipt-preview-title">Receipt Preview</h3>
                
                <div className="editReceipt-receipt-print">
                  <div className="editReceipt-receipt-header">
                    <div className="editReceipt-store-name">{receiptData.storeName || 'STORE NAME'}</div>
                    <div className="editReceipt-store-address">{receiptData.address1 || 'Address Line 1'}</div>
                    <div className="editReceipt-store-address">{receiptData.address2 || 'Address Line 2'}</div>
                    <div className="editReceipt-store-contact">TEL #: {receiptData.telephone || '0000000000'}</div>
                  </div>

                  <div className="editReceipt-receipt-divider">----------------------------------------</div>

                  <div className="editReceipt-receipt-info">
                    <div className="editReceipt-receipt-info-left">
                      <div>DATE: {dayjs().format("MM/DD/YYYY")}</div>
                      <div>TIME: {dayjs().format("hh:mm A")}</div>
                      <div>CASHIER: SAMPLE CASHIER</div>
                      <div>ORDER TYPE: DINE IN</div>
                    </div>
                  </div>

                  <div className="editReceipt-receipt-divider">----------------------------------------</div>

                  <div className="editReceipt-receipt-body">
                    <div className="editReceipt-receipt-item">
                      <div className="editReceipt-receipt-line">
                        <span className="editReceipt-receipt-item-name">Sample Item 1</span>
                      </div>
                      <div className="editReceipt-receipt-line editReceipt-receipt-qty-price">
                        <span>150.00 x 2</span>
                        <span>300.00</span>
                      </div>
                    </div>
                    <div className="editReceipt-receipt-item">
                      <div className="editReceipt-receipt-line">
                        <span className="editReceipt-receipt-item-name">Sample Item 2</span>
                      </div>
                      <div className="editReceipt-receipt-line editReceipt-receipt-qty-price">
                        <span>200.00 x 1</span>
                        <span>200.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="editReceipt-receipt-divider">----------------------------------------</div>

                  <div className="editReceipt-receipt-summary">
                    <div className="editReceipt-receipt-line" style={{ fontWeight: '600', margin: '4px 0' }}>
                      <span>NET AMOUNT</span>
                      <span>500.00</span>
                    </div>

                    <div className="editReceipt-receipt-divider">----------------------------------------</div>

                    <div className="editReceipt-receipt-line editReceipt-receipt-total">
                      <span>TOTAL</span>
                      <span>500.00</span>
                    </div>

                    <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '11px', fontWeight: 'bold' }}>
                      <div>NON-VAT</div>
                      <div>EXEMPT</div>
                    </div>

                    <div className="editReceipt-receipt-divider">----------------------------------------</div>

                    <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '10px', fontWeight: 'bold', lineHeight: '1.4' }}>
                      <div>THIS IS NOT AN OFFICIAL RECEIPT</div>
                    </div>

                    <div className="editReceipt-receipt-divider">----------------------------------------</div>

                    <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '11px', fontWeight: 'bold', lineHeight: '1.6' }}>
                      <div>THANK YOU FOR YOUR PURCHASE!</div>
                      <div>PLEASE COME AGAIN</div>
                    </div>
                  </div>

                  {/* Dual QR Code Section - Same as OrderModal */}
                  <div className="editReceipt-receipt-footer">
                    <div className="editReceipt-dual-qr-section">
                      {/* First QR Code - Feedback/OOS */}
                      {receiptData.showQR && (
                        <div className="editReceipt-qr-item">
                          {receiptData.qrType === 'image' && qrImagePreview ? (
                            <img 
                              src={qrImagePreview} 
                              alt="QR Code" 
                              className="editReceipt-qr-image" 
                            />
                          ) : receiptData.qrType === 'link' && generatedQRCode ? (
                            <img 
                              src={generatedQRCode} 
                              alt="Feedback QR Code" 
                              className="editReceipt-qr-image" 
                            />
                          ) : (
                            <div className="editReceipt-qr-placeholder">QR CODE</div>
                          )}
                          <div className="editReceipt-qr-text">
                            {receiptData.qrText || 'SCAN FOR FEEDBACK'}
                          </div>
                        </div>
                      )}
                      
                      {/* Second QR Code - Blockchain Transaction */}
                      <div className="editReceipt-qr-item">
                        {blockchainQRCode ? (
                          <img 
                            src={blockchainQRCode} 
                            alt="Blockchain Transaction QR Code" 
                            className="editReceipt-qr-image" 
                          />
                        ) : (
                          <div className="editReceipt-qr-placeholder">QR CODE</div>
                        )}
                        <div className="editReceipt-qr-text">
                          Verify Blockchain Transaction
                        </div>
                      </div>
                    </div>
                    
                    {receiptData.additionalText && (
                      <div className="editReceipt-additional-text">{receiptData.additionalText}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Receipt;