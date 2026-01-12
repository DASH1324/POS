import html2pdf from 'html2pdf.js';
import ReactDOM from "react-dom";
import { ExportModal, NoDataModal } from "../shared/exportModal";

// Helper function to format currency
const formatCurrency = (value) => {
  const num = parseFloat(value || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper function to format variance type
const formatVarianceType = (value) => {
  if (!value || value === 0) return 'Balanced';
  return value < 0 ? 'Shortage' : 'Overage';
};

export const generatePDFReport = async (reportData, reportTotals, activeTab, currentPeriodText, selectedCashier) => {
  try {
    const reportDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

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

    const grossSales = reportTotals.totalSales || 0;
    const totalRefunds = reportTotals.refunds || 0;
    const netSales = grossSales - totalRefunds;

    let reportTypeText = 'Sales Summary';
    if (activeTab === 'daily' || activeTab === 'z-reading') {
      reportTypeText = 'End-of-Day Closing (Z-Reading)';
    } else if (activeTab === 'cashier' || selectedCashier) {
      reportTypeText = 'Cashier Closing (X-Reading)';
    }
    if (selectedCashier && selectedCashier !== 'all') {
      reportTypeText += ' / Cashier Report';
    }

    const htmlContent = `
      <div id="pdfContent">
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; padding: 20px; margin: 0; font-size: 10px; }
          
          .report-header { 
            text-align: center; 
            margin-bottom: 25px; 
            border-bottom: 3px solid #4B929D; 
            padding-bottom: 15px; 
          }
          .report-header h1 { 
            margin: 0 0 5px 0; 
            font-size: 22px; 
            color: #333; 
            font-weight: bold;
          }
          .report-header .business-address { 
            margin: 3px 0; 
            font-size: 10px; 
            color: #666; 
          }
          .report-header .report-type { 
            margin: 8px 0 3px 0; 
            font-size: 14px; 
            font-weight: bold;
            color: #4B929D; 
          }
          .report-header .period { 
            margin: 3px 0; 
            font-size: 10px; 
            color: #666; 
          }
          .report-header .generated { 
            margin: 8px 0 0 0; 
            font-size: 9px; 
            color: #999; 
            font-style: italic;
          }

          .summary-section {
            margin: 25px 0;
            page-break-inside: avoid;
          }
          .summary-section h2 {
            font-size: 16px;
            color: #333;
            margin-bottom: 15px;
            border-bottom: 2px solid #4B929D;
            padding-bottom: 5px;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .summary-table td {
            padding: 10px;
            border: 1px solid #ddd;
            font-size: 11px;
          }
          .summary-table td:first-child {
            background-color: #f8fcfd;
            font-weight: 600;
            width: 60%;
            color: #333;
          }
          .summary-table td:last-child {
            text-align: right;
            font-weight: bold;
            color: #333;
            width: 40%;
          }
          .summary-table .net-sales td {
            background-color: #4B929D !important;
            color: white !important;
            font-size: 12px;
            font-weight: bold;
          }
          .summary-table .variance-shortage td:last-child {
            color: #d32f2f;
          }
          .summary-table .variance-overage td:last-child {
            color: #388e3c;
          }

          .breakdown-section {
            margin-top: 30px;
          }
          .breakdown-section h2 {
            font-size: 16px;
            color: #333;
            margin-bottom: 15px;
            border-bottom: 2px solid #4B929D;
            padding-bottom: 5px;
          }

          table.breakdown-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px; 
            font-size: 9px; 
            page-break-inside: auto; 
          }
          .breakdown-table thead { display: table-header-group; }
          .breakdown-table tbody { display: table-row-group; }
          .breakdown-table tr { page-break-inside: avoid; page-break-after: auto; }
          .breakdown-table th, .breakdown-table td { 
            border: 1px solid #333; 
            padding: 8px 5px; 
            text-align: left; 
          }
          .breakdown-table th { 
            background-color: #4B929D !important; 
            color: #fff !important; 
            font-weight: bold; 
            text-align: center; 
            font-size: 8px; 
            text-transform: uppercase; 
            letter-spacing: 0.3px; 
          }
          .breakdown-table tr:nth-child(even) { background-color: #f9f9f9 !important; }
          
          .bold { font-weight: 700; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }

          .report-footer {
            margin-top: 40px;
            page-break-inside: avoid;
          }
          .signature-section {
            margin-top: 50px;
            text-align: left;
          }
          .signature-line {
            display: inline-block;
            border-top: 2px solid #000;
            width: 250px;
            margin-top: 40px;
            text-align: center;
            padding-top: 5px;
          }
          .signature-label {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 10px;
          }
        </style>

        <!-- HEADER -->
        <div class="report-header">
          <h1>Bleu Bean Cafe</h1>
          <p class="business-address">Don Fabian St., Commonwealth, Quezon City, Philippines</p>
          <p class="report-type">${reportTypeText}</p>
          <p class="period">Reporting Period: ${currentPeriodText}</p>
          <p class="generated">Date Generated: ${reportDate}</p>
        </div>

        <!-- SUMMARY SECTION -->
        <div class="summary-section">
          <h2>Summary Section</h2>
          <table class="summary-table">
            <tbody>
              <tr>
                <td>Total Cash Sales</td>
                <td>₱${formatCurrency(reportTotals.totalSales)}</td>
              </tr>
              <tr>
                <td>Cash Drawer</td>
                <td>₱${formatCurrency(reportTotals.cashInDrawer)}</td>
              </tr>
              <tr class="${(reportTotals.discrepancy || 0) < 0 ? 'variance-shortage' : (reportTotals.discrepancy || 0) > 0 ? 'variance-overage' : ''}">
                <td>Cash Variance (${formatVarianceType(reportTotals.discrepancy)})</td>
                <td>₱${formatCurrency(Math.abs(reportTotals.discrepancy || 0))}</td>
              </tr>
              <tr>
                <td>Total Transactions</td>
                <td>${reportTotals.transactions ?? 0}</td>
              </tr>
              <tr>
                <td>Cash Payments</td>
                <td>₱${formatCurrency(reportTotals.cashAmount || 0)}</td>
              </tr>
              <tr>
                <td>GCash Payments</td>
                <td>₱${formatCurrency(reportTotals.gcashAmount || 0)}</td>
              </tr>
              <tr>
                <td>Refunds/Returns</td>
                <td>₱${formatCurrency(reportTotals.refunds)}</td>
              </tr>
              <tr class="net-sales">
                <td>Net Sales</td>
                <td>₱${formatCurrency(netSales)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Cash Drawer Details -->
        <div class="summary-section">
          <h2>Cash Drawer Details</h2>
          <table class="summary-table">
            <tbody>
              <tr>
                <td>Change Fund</td>
                <td>₱${formatCurrency(reportTotals.cashDrawerOpening)}</td>
              </tr>
              <tr>
                <td>Total Cash Sales</td>
                <td>₱${formatCurrency(reportTotals.cashDrawerSales)}</td>
              </tr>
              <tr>
                <td>Total Refunds</td>
                <td>₱${formatCurrency(reportTotals.cashDrawerRefunds)}</td>
              </tr>
              <tr>
                <td>System Cash Total</td>
                <td>₱${formatCurrency(reportTotals.cashDrawerExpected)}</td>
              </tr>
              <tr>
                <td>Actual Cash Count</td>
                <td>₱${formatCurrency(reportTotals.cashDrawerActual)}</td>
              </tr>
              <tr class="net-sales ${(reportTotals.cashDrawerDiscrepancy || 0) < 0 ? 'variance-shortage' : (reportTotals.cashDrawerDiscrepancy || 0) > 0 ? 'variance-overage' : ''}">
                <td>Cash Variance (Variance Type: ${formatVarianceType(reportTotals.cashDrawerDiscrepancy)})</td>
                <td>₱${formatCurrency(Math.abs(reportTotals.cashDrawerDiscrepancy || 0))}</td>
              </tr>
              <tr>
                <td>Reported By</td>
                <td>${reportTotals.reportedBy || 'N/A'}</td>
              </tr>
              <tr>
                <td>Verified By</td>
                <td>${reportTotals.verifiedBy || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- DETAILED BREAKDOWN -->
        <div class="breakdown-section">
          <h2>Product Sales Breakdown</h2>
          <table class="breakdown-table">
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
        <div class="breakdown-section" style="margin-top: 20px;">
          <h2>Refunds & Returns</h2>
          <table class="breakdown-table">
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

        <!-- FOOTER -->
        <div class="report-footer">
          <div class="signature-section">
            <p class="signature-label">Verified by:</p>
            <div class="signature-line">Signature</div>
          </div>
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


const handleSalesReportExport = (reportData, reportTotals, activeTab, currentPeriodText, selectedCashier = 'all') => {
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