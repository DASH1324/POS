import html2pdf from 'html2pdf.js';
import ReactDOM from "react-dom";
import { ExportModal, NoDataModal } from "../shared/exportModal";

// Helper function to format currency
const formatCurrency = (value) => {
  const num = parseFloat(value || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const generatePDFReport = async (reportData, reportTotals, activeTab, currentPeriodText, selectedCashier) => {
  try {
    const reportDate = new Date().toLocaleString();

    // Generate product table rows
    const productRows = (reportData || []).map((item) => {
      return `
        <tr>
          <td>${item.product || 'N/A'}</td>
          <td class="text-center">${item.category || 'N/A'}</td>
          <td class="text-center">${item.units || 0}</td>
          <td class="text-right bold">₱${formatCurrency(item.total)}</td>
        </tr>
      `;
    }).join('');

    // Generate refund table rows if available
    const refundRows = (reportTotals.refundsList || []).map((item) => {
      return `
        <tr>
          <td class="text-center">${item.id || 'N/A'}</td>
          <td class="text-center">${item.date || 'N/A'}</td>
          <td>${item.product || 'N/A'}</td>
          <td class="text-right">₱${formatCurrency(item.amount)}</td>
          <td>${item.reason || 'N/A'}</td>
          <td class="text-center">${item.cashier || 'N/A'}</td>
        </tr>
      `;
    }).join('');

    // Complete HTML with page-break-friendly CSS
    const htmlContent = `
      <div id="pdfContent">
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; padding: 15px; margin: 0; font-size: 10px; }
          
          .export-header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 3px solid #4B929D; 
            padding-bottom: 15px; 
          }
          .export-header h1 { 
            margin: 0 0 8px 0; 
            font-size: 20px; 
            color: #333; 
          }
          .export-header p { 
            margin: 3px 0; 
            font-size: 10px; 
            color: #666; 
          }

          .summary { 
            margin-top: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid; 
          }
          .summary h3 { 
            margin-bottom: 10px; 
            color: #333; 
            font-size: 14px; 
            border-bottom: 2px solid #4B929D; 
            padding-bottom: 5px; 
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #f8fcfd;
            border: 1px solid #4B929D;
            border-radius: 8px;
            padding: 12px;
          }
          .summary-card-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .summary-card-value {
            font-size: 16px;
            font-weight: bold;
            color: #333;
          }

          .financial-section {
            margin-top: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .financial-section h3 {
            margin-bottom: 10px;
            color: #333;
            font-size: 14px;
            border-bottom: 2px solid #4B929D;
            padding-bottom: 5px;
          }
          .financial-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            background: #f9f9f9;
            padding: 12px;
            border-radius: 8px;
          }
          .financial-item {
            display: flex;
            justify-content: space-between;
            padding: 6px 8px;
            background: white;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
          }
          .financial-label {
            font-size: 9px;
            color: #666;
            font-weight: 500;
          }
          .financial-value {
            font-size: 10px;
            font-weight: bold;
            color: #333;
          }
          .financial-highlight {
            background: #fef3c7;
            border: 2px solid #f59e0b;
          }

          .payment-section {
            margin-top: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .payment-section h3 {
            margin-bottom: 10px;
            color: #333;
            font-size: 14px;
            border-bottom: 2px solid #4B929D;
            padding-bottom: 5px;
          }
          .payment-cards {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .payment-card {
            background: #f8fcfd;
            border: 1px solid #4B929D;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          .payment-card-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .payment-card-value {
            font-size: 16px;
            font-weight: bold;
            color: #333;
          }

          .data-section {
            margin-top: 20px;
            page-break-before: always;
          }
          .data-section h3 {
            margin-bottom: 10px;
            color: #333;
            font-size: 14px;
            border-bottom: 2px solid #4B929D;
            padding-bottom: 5px;
          }

          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px; 
            font-size: 9px; 
            page-break-inside: auto; 
          }
          thead { display: table-header-group; }
          tbody { display: table-row-group; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { 
            border: 1px solid #333; 
            padding: 6px 4px; 
            text-align: left; 
          }
          th { 
            background-color: #4B929D !important; 
            color: #fff !important; 
            font-weight: bold; 
            text-align: center; 
            font-size: 8px; 
            text-transform: uppercase; 
            letter-spacing: 0.3px; 
          }
          tr:nth-child(even) { background-color: #f9f9f9 !important; }
          
          .bold { font-weight: 700; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }

          .approved { 
            margin-top: 30px; 
            text-align: right; 
            page-break-inside: avoid; 
          }
          .signature { 
            margin-top: 20px; 
            display: inline-block; 
            border-top: 1px solid #000; 
            padding-top: 5px; 
            min-width: 180px; 
            text-align: center; 
            font-size: 10px; 
          }
        </style>

        <div class="export-header">
          <h1>Sales Report</h1>
          <p><strong>Generated On:${reportDate}</p>
          <p>${currentPeriodText}</p>
          ${selectedCashier && selectedCashier !== 'all' ? `<p><strong>Cashier:</strong> ${selectedCashier}</p>` : ''}
        </div>

        <div class="summary">
          <h3>Sales Summary</h3>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-card-label">Total Cash Sales</div>
              <div class="summary-card-value">₱${formatCurrency(reportTotals.totalSales)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-label">Cash in Drawer</div>
              <div class="summary-card-value">₱${formatCurrency(reportTotals.cashInDrawer)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-label">Cash Discrepancy</div>
              <div class="summary-card-value">₱${formatCurrency(Math.abs(reportTotals.discrepancy || 0))} ${(reportTotals.discrepancy || 0) < 0 ? 'Short' : 'Over'}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-label">Total Transactions</div>
              <div class="summary-card-value">${reportTotals.transactions ?? 0}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-label">Refunds/Returns</div>
              <div class="summary-card-value">₱${formatCurrency(reportTotals.refunds)}</div>
            </div>
          </div>
        </div>

        <div class="payment-section">
          <h3>Payment Breakdown</h3>
          <div class="payment-cards">
            <div class="payment-card">
              <div class="payment-card-label">Cash Payments</div>
              <div class="payment-card-value">₱${formatCurrency(reportTotals.cashAmount || 0)}</div>
            </div>
            <div class="payment-card">
              <div class="payment-card-label">GCash Payments</div>
              <div class="payment-card-value">₱${formatCurrency(reportTotals.gcashAmount || 0)}</div>
            </div>
          </div>
        </div>

        <div class="financial-section">
          <h3>Cash Drawer Details</h3>
          <div class="financial-grid">
            <div class="financial-item">
              <span class="financial-label">Opening Balance:</span>
              <span class="financial-value">₱${formatCurrency(reportTotals.cashDrawerOpening)}</span>
            </div>
            <div class="financial-item">
              <span class="financial-label">Total Cash Sales:</span>
              <span class="financial-value">₱${formatCurrency(reportTotals.cashDrawerSales)}</span>
            </div>
            <div class="financial-item">
              <span class="financial-label">Total Refunds:</span>
              <span class="financial-value">₱${formatCurrency(reportTotals.cashDrawerRefunds)}</span>
            </div>
            <div class="financial-item">
              <span class="financial-label">Expected Cash:</span>
              <span class="financial-value">₱${formatCurrency(reportTotals.cashDrawerExpected)}</span>
            </div>
            <div class="financial-item">
              <span class="financial-label">Actual Cash Counted:</span>
              <span class="financial-value">₱${formatCurrency(reportTotals.cashDrawerActual)}</span>
            </div>
            <div class="financial-item financial-highlight">
              <span class="financial-label">Discrepancy:</span>
              <span class="financial-value">₱${formatCurrency(Math.abs(reportTotals.cashDrawerDiscrepancy || 0))} ${(reportTotals.cashDrawerDiscrepancy || 0) < 0 ? 'Short' : 'Over'}</span>
            </div>
            <div class="financial-item">
              <span class="financial-label">Reported By:</span>
              <span class="financial-value">${reportTotals.reportedBy || 'N/A'}</span>
            </div>
            <div class="financial-item">
              <span class="financial-label">Verified By:</span>
              <span class="financial-value">${reportTotals.verifiedBy || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="data-section">
          <h3>Product Sales Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>UNITS SOLD</th>
                <th>TOTAL SALES</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
            </tbody>
          </table>
        </div>

        ${refundRows ? `
        <div class="data-section" style="page-break-before: auto; margin-top: 20px;">
          <h3>Refunds & Returns</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>DATE</th>
                <th>PRODUCT</th>
                <th>AMOUNT</th>
                <th>REASON</th>
                <th>CASHIER</th>
              </tr>
            </thead>
            <tbody>
              ${refundRows}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="approved">
          <p><strong>Approved By:</strong></p>
          <div class="signature">Signature</div>
        </div>
      </div>
    `;

    // Temporary container
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    // PDF options
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Sales_Report_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Generate PDF and download
    await html2pdf().set(opt).from(container).save();

    // Remove container
    document.body.removeChild(container);

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating PDF. Please try again.");
  }
};

// ============================================
// CSV GENERATION FUNCTION
// ============================================

export const generateCSVReport = (reportData) => {
  const headers = ['Product', 'Category', 'Units Sold', 'Total Sales'];
  
  const rows = (reportData || []).map(item => {
    return [
      item.product || 'N/A',
      item.category || 'N/A',
      item.units || 0,
      formatCurrency(item.total)
    ];
  });

  // Escape CSV values properly
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================
// MAIN EXPORT HANDLER
// ============================================

const handleSalesReportExport = (reportData, reportTotals, activeTab, currentPeriodText, selectedCashier = 'all') => {
  // If there's no data, show the No Data modal immediately
  if (!reportData || !reportData.length) {
    const noDataContainer = document.createElement("div");
    document.body.appendChild(noDataContainer);
    const noDataRoot = ReactDOM.createRoot(noDataContainer);

    const cleanupNoData = () => {
      noDataRoot.unmount();
      document.body.removeChild(noDataContainer);
    };

    noDataRoot.render(<NoDataModal onClose={cleanupNoData} />);
    return;
  }

  // Otherwise, show export modal
  const modalContainer = document.createElement("div");
  document.body.appendChild(modalContainer);
  const root = ReactDOM.createRoot(modalContainer);

  const cleanup = () => {
    root.unmount();
    document.body.removeChild(modalContainer);
  };

  const handleExportPDF = () => {
    cleanup();
    
    // Create enhanced totals object with all necessary data
    const enhancedTotals = {
      totalSales: reportTotals?.totalSales || 0,
      cashInDrawer: reportTotals?.cashInDrawer || 0,
      discrepancy: reportTotals?.discrepancy || 0,
      transactions: reportTotals?.transactions || 0,
      refunds: reportTotals?.refunds || 0,
      cashAmount: reportTotals?.cashAmount || 0,
      gcashAmount: reportTotals?.gcashAmount || 0,
      cashDrawerOpening: reportTotals?.cashDrawerOpening || 0,
      cashDrawerSales: reportTotals?.cashDrawerSales || 0,
      cashDrawerRefunds: reportTotals?.cashDrawerRefunds || 0,
      cashDrawerExpected: reportTotals?.cashDrawerExpected || 0,
      cashDrawerActual: reportTotals?.cashDrawerActual || 0,
      cashDrawerDiscrepancy: reportTotals?.cashDrawerDiscrepancy || 0,
      reportedBy: reportTotals?.reportedBy || 'N/A',
      verifiedBy: reportTotals?.verifiedBy || 'N/A',
      refundsList: reportTotals?.refundsList || []
    };
    
    generatePDFReport(reportData, enhancedTotals, activeTab, currentPeriodText, selectedCashier);
  };

  const handleExportCSV = () => {
    cleanup();
    generateCSVReport(reportData);
  };

  // Render export format modal
  root.render(
    <ExportModal
      onClose={cleanup}
      onExportPDF={handleExportPDF}
      onExportCSV={handleExportCSV}
    />
  );
};

export default handleSalesReportExport;