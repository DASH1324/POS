import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';

export const generatePDFReport = async (metrics, selectedCategory, selectedCashier) => {
  try {
    const reportDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Calculate summary statistics
    const totalTransactions = metrics.totalTransactions || 0;
    const totalItemsSold = metrics.totalItemsSold || 0;
    const totalSales = metrics.totalSales || 0;
    const averageSaleValue = metrics.averageSaleValue || 0;
    const topCashier = metrics.topCashier;

    // Capture charts as images
    let salesTrendImage = '';
    let categoryPieImage = '';
    let topProductsImage = '';

    try {
      const salesTrendChart = document.querySelector('.salesMonChartCard:nth-child(1) .recharts-wrapper');
      if (salesTrendChart) {
        const canvas = await html2canvas(salesTrendChart, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        salesTrendImage = canvas.toDataURL('image/png');
      }

      const categoryChart = document.querySelector('.salesMonChartCard:nth-child(2) .recharts-wrapper');
      if (categoryChart) {
        const canvas = await html2canvas(categoryChart, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        categoryPieImage = canvas.toDataURL('image/png');
      }

      const topProductsChart = document.querySelector('.salesMonChartCardWide .recharts-wrapper');
      if (topProductsChart) {
        const canvas = await html2canvas(topProductsChart, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        topProductsImage = canvas.toDataURL('image/png');
      }
    } catch (chartError) {
      console.warn('Error capturing charts:', chartError);
    }

    // Generate table rows
    const tableRows = metrics.filtered.map((item) => {
      const date = new Date(item.date);
      const formattedDate = date.toLocaleDateString('en-CA');
      const formattedTime = date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      });

      return `
        <tr>
          <td>${item.product}</td>
          <td>${item.category}</td>
          <td>
            <div class="date-cell">
              <div class="date-line">${formattedDate}</div>
              <div class="time-line">${formattedTime}</div>
            </div>
          </td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right bold">₱${item.revenue.toFixed(2)}</td>
          <td>${item.cashier || '—'}</td>
        </tr>
      `;
    }).join('');

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
            margin: 0 0 5px 0; 
            font-size: 22px; 
            color: #333; 
            font-weight: bold;
          }
          .export-header .business-address { 
            margin: 3px 0; 
            font-size: 10px; 
            color: #666; 
          }
          .export-header .report-type { 
            margin: 8px 0 3px 0; 
            font-size: 14px; 
            font-weight: bold;
            color: #4B929D; 
          }
          .export-header .filters { 
            margin: 3px 0; 
            font-size: 10px; 
            color: #666; 
          }
          .export-header .generated { 
            margin: 8px 0 0 0; 
            font-size: 9px; 
            color: #999; 
            font-style: italic;
          }

          .summary { 
            margin-top: 25px;
            margin-bottom: 25px;
            page-break-inside: avoid; 
          }
          .summary h3 { 
            margin-bottom: 15px; 
            color: #333; 
            font-size: 16px; 
            border-bottom: 2px solid #4B929D; 
            padding-bottom: 5px; 
          }
          .summary-table { 
            border-collapse: collapse; 
            width: 100%; 
          }
          .summary-table th, .summary-table td { 
            border: 1px solid #ddd; 
            padding: 10px 8px; 
            font-size: 11px; 
          }
          .summary-table th { 
            background-color: #f8fcfd !important;
            color: #333 !important; 
            text-align: left; 
            width: 60%; 
            font-weight: 600; 
          }
          .summary-table td { 
            text-align: right; 
            font-weight: bold;
            color: #333;
            width: 40%;
          }

          .charts-section {
            margin-top: 25px;
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .charts-section h3 {
            margin-bottom: 15px;
            color: #333;
            font-size: 16px;
            border-bottom: 2px solid #4B929D;
            padding-bottom: 5px;
          }
          .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
          }
          .chart-container {
            text-align: center;
            background: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #ddd;
          }
          .chart-container img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          .chart-title {
            font-size: 11px;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
          }
          .chart-wide {
            grid-column: 1 / -1;
          }

          .data-section {
            margin-top: 30px;
            page-break-before: always;
          }
          .data-section h3 {
            margin-bottom: 15px;
            color: #333;
            font-size: 16px;
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
            padding: 8px 5px; 
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
          
          .date-cell { line-height: 1.3; }
          .date-line { font-weight: 500; font-size: 9px; }
          .time-line { font-size: 8px; color: #666; }

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
        <div class="export-header">
          <h1>Bleu Bean Cafe</h1>
          <p class="business-address">Don Fabian St., Commonwealth, Quezon City, Philippines</p>
          <p class="report-type">Sales Monitoring Report</p>
          <p class="filters"><strong>Category:</strong> ${selectedCategory !== 'all' ? selectedCategory : 'All Categories'} | <strong>Cashier:</strong> ${selectedCashier !== 'all' ? selectedCashier : 'All Cashiers'}</p>
          <p class="generated">Date Generated: ${reportDate}</p>
        </div>

        <!-- SUMMARY SECTION -->
        <div class="summary">
          <h3>Sales Summary</h3>
          <table class="summary-table">
            <tbody>
              <tr><th>Total Sales</th><td>₱${totalSales.toFixed(2)}</td></tr>
              <tr><th>Total Transactions</th><td>${totalTransactions}</td></tr>
              <tr><th>Total Items Sold</th><td>${totalItemsSold}</td></tr>
              <tr><th>Average Sale Value</th><td>₱${averageSaleValue.toFixed(2)}</td></tr>
              ${topCashier ? `<tr><th>Top Cashier</th><td>${topCashier.name} (₱${topCashier.sales.toFixed(2)})</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        ${salesTrendImage || categoryPieImage || topProductsImage ? `
          <div class="charts-section">
            <h3>Sales Analytics</h3>
            <div class="charts-grid">
              ${salesTrendImage ? `
                <div class="chart-container">
                  <div class="chart-title">Sales Trend</div>
                  <img src="${salesTrendImage}" alt="Sales Trend Chart" />
                </div>
              ` : ''}
              ${categoryPieImage ? `
                <div class="chart-container">
                  <div class="chart-title">Sales by Category</div>
                  <img src="${categoryPieImage}" alt="Category Distribution Chart" />
                </div>
              ` : ''}
            </div>
            ${topProductsImage ? `
              <div class="chart-container chart-wide">
                <div class="chart-title">Top-Selling Products</div>
                <img src="${topProductsImage}" alt="Top Products Chart" />
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- DETAILED DATA SECTION -->
        <div class="data-section">
          <h3>Detailed Sales Data</h3>
          <table>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>DATE & TIME</th>
                <th>QTY</th>
                <th>REVENUE</th>
                <th>CASHIER</th>
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
            <p class="signature-label">Verified by:</p>
            <div class="signature-line">Signature</div>
          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Sales_Monitoring_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    await html2pdf().set(opt).from(container).save();
    document.body.removeChild(container);

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating PDF. Please try again.");
  }
};

export const generateCSVReport = (metrics) => {
  const headers = [
    'Product', 
    'Category', 
    'Date',
    'Time',
    'Quantity',
    'Revenue', 
    'Cashier'
  ];
  
  const rows = metrics.filtered.map(item => {
    const date = new Date(item.date);
    const formattedDate = date.toLocaleDateString('en-CA');
    const formattedTime = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });

    return [
      item.product,
      item.category,
      formattedDate,
      formattedTime,
      item.quantity,
      item.revenue.toFixed(2),
      item.cashier || '—'
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
  link.setAttribute('download', `Sales_Monitoring_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};