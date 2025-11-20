import html2pdf from 'html2pdf.js';
import logo from "../../../assets/logo.png";

// Helper function to format currency
const formatCurrency = (value) => {
  const num = parseFloat(value || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const generatePDFReport = async (filteredTransactions, activeTab, statusFilter, exportedBy, dateFilter, cashiersMap = {}) => {
  try {
    // Convert logo to base64
    const logoBase64 = await fetch(logo)
      .then(res => res.blob())
      .then(blob => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }));

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
          <td>${t.orderType || "—"}</td>
          <td class="items-cell">${t.items?.map(item => item.name).join(', ') || "—"}</td>
          <td class="text-center">${totalQty}</td>
          <td class="bold">₱${formatCurrency(t.subtotal)}</td>
          <td class="${refundClass}">₱${formatCurrency(refundAmount)}</td>
          <td>₱${formatCurrency(totalDiscount)}</td>
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

    // Complete HTML with page-break-friendly CSS
    const htmlContent = `
      <div id="pdfContent">
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; padding: 15px; margin: 0; font-size: 10px; }
          .export-header { display: flex; align-items: flex-start; margin-bottom: 15px; border-bottom: 2px solid #4B929D; padding-bottom: 10px; }
          .export-header img { height: 60px; margin-right: 15px; }
          .header-details { flex: 1; }
          .header-details h1 { margin: 0 0 8px 0; font-size: 18px; color: #333; }
          .header-details p { margin: 2px 0; font-size: 10px; color: #666; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px; page-break-inside: auto; }
          thead { display: table-header-group; }
          tbody { display: table-row-group; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #333; padding: 6px 4px; text-align: left; }
          th { background-color: #4B929D !important; color: #fff !important; font-weight: bold; text-align: center; font-size: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
          tr:nth-child(even) { background-color: #f9f9f9 !important; }
          .bold { font-weight: 700; }
          .text-center { text-align: center; }
          .date-cell { line-height: 1.3; }
          .date-line { font-weight: 500; font-size: 9px; }
          .time-line { font-size: 8px; color: #666; }
          .items-cell { font-size: 8px; }
          .payment-cell { line-height: 1.3; }
          .payment-amount { font-size: 9px; }
          .payment-method { font-size: 8px; color: #666; }
          .has-refund { color: #dc3545 !important; font-weight: 600; }
          .status-badge { display: inline-block; padding: 3px 6px; border-radius: 3px; font-size: 8px; font-weight: bold; text-align: center; }
          .status-completed { background-color: #d4edda !important; color: #28a745 !important; border: 1px solid #c3e6cb !important; }
          .status-cancelled { background-color: #e2e3e5 !important; color: #6c757d !important; border: 1px solid #d6d8db !important; }
          .status-processing { background-color: #fff3cd !important; color: #856404 !important; border: 1px solid #ffeaa7 !important; }
          .status-refunded { background-color: #f8d7da !important; color: #721c24 !important; border: 1px solid #f5c6cb !important; }
          .status-forpickup { background-color: #d1ecf1 !important; color: #0c5460 !important; border: 1px solid #bee5eb !important; }
          .status-request { background-color: #e3f2fd !important; color: #0d6efd !important; border: 1px solid #90caf9 !important; }

          .summary { margin-top: 20px; page-break-inside: avoid; }
          .summary h3 { margin-bottom: 10px; color: #333; font-size: 14px; border-bottom: 2px solid #4B929D; padding-bottom: 5px; }
          .summary-table { border-collapse: collapse; width: 50%; margin: 0 auto; }
          .summary-table th, .summary-table td { border: 1px solid #333; padding: 6px 8px; font-size: 10px; }
          .summary-table th { background: #f2f2f2 !important; color: #333 !important; text-align: left; width: 60%; font-weight: 600; }
          .summary-table td { text-align: right; font-weight: 500; }

          .approved { margin-top: 30px; text-align: right; page-break-inside: avoid; }
          .signature { margin-top: 20px; display: inline-block; border-top: 1px solid #000; padding-top: 5px; min-width: 180px; text-align: center; font-size: 10px; }
        </style>

        <div class="export-header">
          <img src="${logoBase64}" alt="Logo" />
          <div class="header-details">
            <h1>Transaction History - ${activeTab}</h1>
            <p><strong>Generated On:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Generated By:</strong> ${exportedBy || "System"}</p>
            <p><strong>Transaction Period:</strong> ${dateFilter || "All"}</p>
            <p><strong>Status Filter:</strong> ${statusFilter || "All"}</p>
          </div>
        </div>

        <div class="summary">
          <h3>Summary</h3>
          <table class="summary-table">
            <tr><th>Total Transactions</th><td>${totalTransactions}</td></tr>
            <tr><th>Completed Transactions</th><td>${completedTransactions}</td></tr>
            <tr><th>Cancelled Transactions</th><td>${cancelledTransactions}</td></tr>
            <tr><th>Refunded Transactions</th><td>${refundedTransactions}</td></tr>
            <tr><th>Total Sales</th><td>₱${formatCurrency(totalSales)}</td></tr>
            <tr><th>Total Items Sold</th><td>${totalItemsSold}</td></tr>
            <tr><th>Total Refunds</th><td>₱${formatCurrency(totalRefunds)}</td></tr>
            <tr><th>Cash Sales</th><td>₱${formatCurrency(cashSales)}</td></tr>
            <tr><th>GCash Sales</th><td>₱${formatCurrency(gcashSales)}</td></tr>
          </table>
        </div>

        <div class="summary">
          <h3>Transactions </h3>
          <table>
            <thead>
              <tr>
                <th>ORDER</th>
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
  // CSV headers matching the UI
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
    
    // Payment amount - show 0.00 if refunded
    const paymentAmount = t.status.toLowerCase() === "refunded" 
      ? 0 
      : parseFloat(t.total);

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