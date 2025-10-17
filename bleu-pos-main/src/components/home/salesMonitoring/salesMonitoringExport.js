export const generatePDFReport = (metrics, selectedProduct, selectedCategory) => {
  const reportDate = new Date().toLocaleString();
  const htmlContent = `
    <html>
      <head>
        <title>Sales Monitoring Report - EOD</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            padding: 30px; 
            background: #f5f5f5; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .salesMonExportHeader { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 3px solid #4B929D; 
            padding-bottom: 20px; 
          }
          .salesMonExportHeader h1 { 
            margin: 0; 
            color: #333; 
            font-size: 24px; 
          }
          .salesMonExportHeader p { 
            margin: 5px 0; 
            color: #666; 
            font-size: 13px; 
          }
          .salesMonExportMetrics { 
            display: grid; 
            grid-template-columns: 1fr 1fr 1fr 1fr; 
            gap: 15px; 
            margin-bottom: 30px; 
          }
          .salesMonExportMetricCard { 
            background: white; 
            padding: 15px; 
            border-radius: 6px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            border-left: 4px solid #4B929D; 
          }
          .salesMonExportMetricLabel { 
            color: #666; 
            font-size: 11px; 
            text-transform: uppercase; 
            margin-bottom: 5px; 
          }
          .salesMonExportMetricValue { 
            font-size: 24px; 
            font-weight: bold; 
            color: #333; 
          }
          .salesMonExportMetricUnit { 
            font-size: 11px; 
            color: #999; 
          }
          .salesMonExportTable { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px; 
            background: white; 
          }
          .salesMonExportTable th, 
          .salesMonExportTable td { 
            padding: 10px; 
            text-align: left; 
            border-bottom: 1px solid #ddd; 
            font-size: 12px; 
          }
          .salesMonExportTable th { 
            background: #4B929D !important; 
            color: white !important; 
            font-weight: bold; 
          }
          .salesMonExportTable tr:nth-child(even) { 
            background: #f9f9f9; 
          }
          .salesMonExportFooter { 
            margin-top: 30px; 
            text-align: right; 
            font-size: 11px; 
            color: #999; 
            border-top: 1px solid #ddd; 
            padding-top: 15px; 
          }
          .salesMonExportSectionTitle { 
            font-size: 14px; 
            font-weight: bold; 
            color: #333; 
            margin-top: 25px; 
            margin-bottom: 10px; 
            background: #f0f0f0; 
            padding: 8px; 
          }
          .salesMonExportPageBreak { 
            page-break-after: always; 
          }
        </style>
      </head>
      <body>
        <div class="salesMonExportHeader">
          <h1>End-of-Day Sales Report</h1>
          <p>Generated on: ${reportDate}</p>
          <p>Product: ${selectedProduct !== 'all' ? selectedProduct : 'All Products'} | Category: ${selectedCategory !== 'all' ? selectedCategory : 'All Categories'}</p>
        </div>

        <div class="salesMonExportSectionTitle">Key Metrics Summary</div>
        <div class="salesMonExportMetrics">
          <div class="salesMonExportMetricCard">
            <div class="salesMonExportMetricLabel">Total Revenue</div>
            <div class="salesMonExportMetricValue">₱${metrics.totalRevenue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</div>
          </div>
          <div class="salesMonExportMetricCard">
            <div class="salesMonExportMetricLabel">Gross Profit</div>
            <div class="salesMonExportMetricValue">₱${metrics.totalProfit.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</div>
          </div>
          <div class="salesMonExportMetricCard">
            <div class="salesMonExportMetricLabel">Quantity Sold</div>
            <div class="salesMonExportMetricValue">${metrics.totalQuantity}</div>
            <div class="salesMonExportMetricUnit">items</div>
          </div>
          <div class="salesMonExportMetricCard">
            <div class="salesMonExportMetricLabel">Profit Margin</div>
            <div class="salesMonExportMetricValue">${metrics.profitMargin}%</div>
          </div>
        </div>

        <div class="salesMonExportSectionTitle">Product Performance</div>
        <table class="salesMonExportTable">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Revenue</th>
              <th>Profit</th>
              <th>Quantity</th>
              <th>Order Type</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.filtered.map(item => `
              <tr>
                <td>${item.product}</td>
                <td>${item.category}</td>
                <td>₱${item.revenue.toFixed(2)}</td>
                <td>₱${item.profit.toFixed(2)}</td>
                <td>${item.quantity}</td>
                <td>${item.orderType}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="salesMonExportFooter">
          <p>This is an automatically generated End-of-Day (EOD) report. For inquiries, contact management.</p>
        </div>
      </body>
    </html>
  `;

  const newWindow = window.open('', '_blank');
  newWindow.document.write(htmlContent);
  newWindow.document.close();
  setTimeout(() => newWindow.print(), 250);
};

export const generateCSVReport = (metrics) => {
  const headers = ['Product', 'Category', 'Revenue', 'Profit', 'Quantity', 'Order Type', 'Date'];
  const rows = metrics.filtered.map(item => [
    item.product,
    item.category,
    item.revenue,
    item.profit,
    item.quantity,
    item.orderType,
    item.date
  ]);

  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};