import React from "react";
import ReactDOM from "react-dom/client";
import logo from "../../../assets/logo.png";
import "./salesReportExport.css";

// Export Format Modal Component
const ExportModal = ({ onClose, onExportPDF, onExportCSV }) => {
  return (
    <div className="salesRep-export-overlay" onClick={onClose}>
      <div className="salesRep-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="salesRep-export-close" onClick={onClose}>
          &times;
        </div>
        <div className="salesRep-export-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1>Choose Export Format</h1>
        <p>Select the file type you'd like to export.</p>

        <div className="salesRep-export-button-group">
          <button onClick={onExportPDF} className="salesRep-export-modal-btn salesRep-export-pdf">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </button>

          <button onClick={onExportCSV} className="salesRep-export-modal-btn salesRep-export-csv">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            CSV
          </button>
        </div>
      </div>
    </div>
  );
};

// No Data Modal Component
const NoDataModal = ({ onClose }) => {
  return (
    <div className="salesRep-export-overlay" onClick={onClose}>
      <div className="salesRep-export-modal salesRep-export-nodata" onClick={(e) => e.stopPropagation()}>
        <div className="salesRep-export-close" onClick={onClose}>
          &times;
        </div>
        <div className="salesRep-export-icon salesRep-export-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1>No Sales Data</h1>
        <p>There is no sales data available to export.</p>
      </div>
    </div>
  );
};

// Main export handler
const handleSalesReportExport = (reportData, reportTotals, activeTab, currentPeriodText, exportedBy = "System") => {
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
    return; // stop execution here — don’t open export modal
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

    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
      <html>
        <head>
          <title>Sales Report Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            h1 { margin: 0; font-size: 18px; }
            .export-header { display: flex; align-items: flex-start; margin-bottom: 15px; }
            .export-header img { height: 140px; }
            .header-details { text-align: left; font-size: 13px; margin-left: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; }
            th { background-color: #4B929D !important; color: #fff !important; font-weight: bold; }
            .summary { margin-top: 40px; font-size: 12px; text-align: center; }
            .summary h3 { margin-bottom: 10px; }
            .summary-table { border-collapse: collapse; width: 60%; margin: 0 auto; }
            .summary-table th, .summary-table td { border: 1px solid #000; padding: 8px 12px; font-size: 12px; text-align: left; }
            .summary-table th { background: #f2f2f2; text-align: left; width: 50%; }
            .approved { margin-top: 40px; text-align: right; }
            .signature { margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="export-header">
            <img src="${logo}" alt="Logo" />
            <div class="header-details">
              <h1>Sales Report - ${activeTab}</h1>
              <p><strong>Generated On:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Generated By:</strong> ${exportedBy}</p>
              <p><strong>Period:</strong> ${currentPeriodText}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                ${Object.keys(reportData[0]).map(key => `<th>${key.toUpperCase()}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${reportData.map(row => `
                <tr>
                  ${Object.values(row).map(val => `<td>${val}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="summary">
            <h3>Sales Summary</h3>
            <table class="summary-table">
              <tr><th>Total Transactions</th><td>${reportTotals.transactions}</td></tr>
              <tr><th>Items Sold</th><td>${reportTotals.itemsSold}</td></tr>
              <tr><th>Store Sale</th><td>₱${reportTotals.storeSale.toFixed(2)}</td></tr>
              <tr><th>Online Sale</th><td>₱${reportTotals.onlineSale.toFixed(2)}</td></tr>
              <tr><th>Total Sale</th><td>₱${reportTotals.totalSale.toFixed(2)}</td></tr>
            </table>
          </div>

          <div class="approved">
            <p>Approved By:</p>
            <div class="signature">________________________</div>
          </div>

          <script> window.onload = () => window.print(); </script>
        </body>
      </html>
    `);
    newWindow.document.close();
  };

  const handleExportCSV = () => {
    cleanup();

    const headers = Object.keys(reportData[0]);
    const rows = reportData.map(obj => headers.map(h => obj[h]));

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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