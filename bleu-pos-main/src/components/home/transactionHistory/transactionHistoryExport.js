import html2pdf from 'html2pdf.js';

// Helper function to format currency
const formatCurrency = (value) => {
  const num = parseFloat(value || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const generatePDFReport = async (filteredTransactions, activeTab, statusFilter, exportedBy, dateFilter, cashiersMap = {}) => {
  try {
    const reportDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate summary statistics
    const totalTransactions = filteredTransactions.length;
    const completedTransactions = filteredTransactions.filter(t => t.status.toLowerCase() === 'completed').length;
    const cancelledTransactions = filteredTransactions.filter(t => t.status.toLowerCase() === 'cancelled').length;
    const refundedTransactions = filteredTransactions.filter(t => t.status.toLowerCase() === 'refunded').length;
    const totalSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    const totalItemsSold = filteredTransactions.reduce(
      (sum, t) => sum + (t.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0), 0
    );
    const totalRefunds = filteredTransactions.reduce(
      (sum, t) => sum + parseFloat(t.refundInfo?.totalRefundAmount || 0), 0
    );
    const cashSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed' && t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    const gcashSales = filteredTransactions
      .filter(t => t.status.toLowerCase() === 'completed' && t.paymentMethod === 'GCASH')
      .reduce((sum, t) => sum + parseFloat(t.total || 0), 0);

    // Generate table rows
    const tableRows = filteredTransactions.map((t) => {
      const date = new Date(t.date);
      const formattedDate = date.toLocaleDateString('en-CA');
      const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const cashierName = cashiersMap[t.cashierName] || t.cashierName || "—";
      const totalQty = t.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      const refundAmount = parseFloat(t.refundInfo?.totalRefundAmount || 0);
      const totalDiscount = (parseFloat(t.discount || 0) + parseFloat(t.promotionalDiscount || 0));
      const paymentAmount = t.status.toLowerCase() === "refunded" ? 0 : parseFloat(t.total);
      const statusClass = t.status.toLowerCase();
      const refundClass = refundAmount > 0 ? 'has-refund' : '';

      return `
        <tr>
          <td class="bold">${t.id}</td>
          <td>
            <div class="date-cell">
              <div class="date-line">${formattedDate}</div>
              <div class="time-line">${formattedTime}</div>
            </div>
          </td>
          <td>${cashierName}</td>
          <td class="text-center">${t.orderType || "—"}</td>
          <td class="items-cell">${t.items?.map(item => item.name).join(', ') || "—"}</td>
          <td class="text-center">${totalQty}</td>
          <td class="text-right bold">₱${formatCurrency(t.subtotal)}</td>
          <td class="text-right ${refundClass}">₱${formatCurrency(refundAmount)}</td>
          <td class="text-right">₱${formatCurrency(totalDiscount)}</td>
          <td>
            <div class="payment-cell">
              <div class="payment-amount bold">₱${formatCurrency(paymentAmount)}</div>
              <div class="payment-method">${t.paymentMethod || "N/A"}</div>
            </div>
          </td>
          <td class="text-center"><span class="status-badge status-${statusClass}">${t.status.toUpperCase()}</span></td>
        </tr>
      `;
    }).join('');

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
          .summary-table .highlight-row td {
            background-color: #4B929D !important;
            color: white !important;
            font-size: 12px;
            font-weight: bold;
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
          
          .date-cell { line-height: 1.4; }
          .date-line { font-weight: 600; font-size: 9px; color: #333; }
          .time-line { font-size: 8px; color: #666; margin-top: 2px; }
          
          .items-cell { font-size: 8px; line-height: 1.3; }
          
          .payment-cell { line-height: 1.4; }
          .payment-amount { font-size: 9px; color: #333; }
          .payment-method { font-size: 8px; color: #666; margin-top: 2px; }
          
          .has-refund { color: #dc3545 !important; font-weight: 700; }
          
          .status-badge { 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 7px; 
            font-weight: bold; 
            text-align: center;
            letter-spacing: 0.5px;
          }
          .status-completed { background-color: #d4edda !important; color: #28a745 !important; border: 1px solid #c3e6cb !important; }
          .status-cancelled { background-color: #e2e3e5 !important; color: #6c757d !important; border: 1px solid #d6d8db !important; }
          .status-processing { background-color: #fff3cd !important; color: #856404 !important; border: 1px solid #ffeaa7 !important; }
          .status-refunded { background-color: #f8d7da !important; color: #721c24 !important; border: 1px solid #f5c6cb !important; }
          .status-forpickup { background-color: #d1ecf1 !important; color: #0c5460 !important; border: 1px solid #bee5eb !important; }
          .status-request { background-color: #e3f2fd !important; color: #0d6efd !important; border: 1px solid #90caf9 !important; }

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
          <p class="report-type">Transaction History Report - ${activeTab}</p>
          <p class="period">Transaction Period: ${dateFilter || "All Dates"}</p>
          <p class="period">Status Filter: ${statusFilter || "All Statuses"}</p>
          <p class="generated">Date Generated: ${reportDate}</p>
          <p class="generated">Generated By: ${exportedBy || "System"}</p>
        </div>

        <!-- SUMMARY SECTION -->
        <div class="summary-section">
          <h2>Transaction Summary</h2>
          <table class="summary-table">
            <tbody>
              <tr>
                <td>Total Transactions</td>
                <td>${totalTransactions}</td>
              </tr>
              <tr>
                <td>Completed Transactions</td>
                <td>${completedTransactions}</td>
              </tr>
              <tr>
                <td>Cancelled Transactions</td>
                <td>${cancelledTransactions}</td>
              </tr>
              <tr>
                <td>Refunded Transactions</td>
                <td>${refundedTransactions}</td>
              </tr>
              <tr>
                <td>Total Items Sold</td>
                <td>${totalItemsSold}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- SALES SUMMARY -->
        <div class="summary-section">
          <h2>Sales Summary</h2>
          <table class="summary-table">
            <tbody>
              <tr>
                <td>Cash Payments</td>
                <td>₱${formatCurrency(cashSales)}</td>
              </tr>
              <tr>
                <td>GCash Payments</td>
                <td>₱${formatCurrency(gcashSales)}</td>
              </tr>
              <tr>
                <td>Total Refunds</td>
                <td>₱${formatCurrency(totalRefunds)}</td>
              </tr>
              <tr class="highlight-row">
                <td>Total Sales</td>
                <td>₱${formatCurrency(totalSales)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- DETAILED BREAKDOWN -->
        <div class="breakdown-section">
          <h2>Transaction Details</h2>
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>DATE & TIME</th>
                <th>CASHIER</th>
                <th>ORDER TYPE</th>
                <th>ITEMS</th>
                <th>QTY</th>
                <th>SUBTOTAL</th>
                <th>REFUND</th>
                <th>DISCOUNT</th>
                <th>PAYMENT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="report-footer">
          <div class="signature-section">
            <p class="signature-label">Approved by:</p>
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
      filename: `Transaction_History_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
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

export const generateCSVReport = (filteredTransactions, cashiersMap = {}) => {
  const headers = [
    "ORDER",
    "DATE",
    "TIME",
    "CASHIER",
    "ORDER TYPE",
    "ITEMS",
    "QTY",
    "SUBTOTAL",
    "REFUND",
    "DISCOUNT",
    "PAYMENT AMOUNT",
    "PAYMENT METHOD",
    "STATUS"
  ];

  const rows = filteredTransactions.map((t) => {
    const date = new Date(t.date);
    const formattedDate = date.toLocaleDateString('en-CA');
    const formattedTime = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
    
    const cashierName = cashiersMap[t.cashierName] || t.cashierName || "—";
    const totalQty = t.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    const refundAmount = parseFloat(t.refundInfo?.totalRefundAmount || 0);
    const totalDiscount = (parseFloat(t.discount || 0) + parseFloat(t.promotionalDiscount || 0));
    const paymentAmount = t.status.toLowerCase() === "refunded" ? 0 : parseFloat(t.total);

    return [
      t.id,
      formattedDate,
      formattedTime,
      cashierName,
      t.orderType || "—",
      t.items?.map(item => item.name).join('; ') || "—",
      totalQty,
      formatCurrency(t.subtotal),
      formatCurrency(refundAmount),
      formatCurrency(totalDiscount),
      formatCurrency(paymentAmount),
      t.paymentMethod || "N/A",
      t.status.toUpperCase()
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

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `transaction_history_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default { generatePDFReport, generateCSVReport };