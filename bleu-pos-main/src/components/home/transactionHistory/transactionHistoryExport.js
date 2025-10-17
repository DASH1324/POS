import React from "react";
import ReactDOM from "react-dom/client";
import logo from "../../../assets/logo.png";
import { HiOutlineDocumentText, HiOutlineTable } from "react-icons/hi";
import "./transactionHistoryExport.css";

// Export Format Modal Component
const ExportModal = ({ onClose, onExportPDF, onExportCSV }) => {
  return (
    <div className="transHis-export-overlay" onClick={onClose}>
      <div className="transHis-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transHis-export-close" onClick={onClose}>
          &times;
        </div>
        <div className="transHis-export-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1>Choose Export Format</h1>
        <p>Select the file type you'd like to export.</p>

        <div className="transHis-export-button-group">
          <button onClick={onExportPDF} className="transHis-export-modal-btn transHis-export-pdf">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </button>

          <button onClick={onExportCSV} className="transHis-export-modal-btn transHis-export-csv">
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
    <div className="transHis-export-overlay" onClick={onClose}>
      <div className="transHis-export-modal transHis-export-nodata" onClick={(e) => e.stopPropagation()}>
        <div className="transHis-export-close" onClick={onClose}>
          &times;
        </div>
        <div className="transHis-export-icon transHis-export-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1>No Transactions</h1>
        <p>There are no transactions available to export.</p>
        <button onClick={onClose} className="transHis-export-btn-single">
          Okay
        </button>
      </div>
    </div>
  );
};

// Main export handler
const handleExport = (filteredTransactions, activeTab, statusFilter, exportedBy, dateFilter) => {
  // Create container for modal
  const modalContainer = document.createElement("div");
  document.body.appendChild(modalContainer);
  const root = ReactDOM.createRoot(modalContainer);

  const cleanup = () => {
    root.unmount();
    document.body.removeChild(modalContainer);
  };

  const handleExportPDF = () => {
    cleanup();

    if (!filteredTransactions.length) {
      showNoDataModal();
      return;
    }

    // Summary computation
    const totalTransactions = filteredTransactions.length;
    const totalSale = filteredTransactions.reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    const totalItems = filteredTransactions.reduce((sum, t) => sum + (t.items?.length || 0), 0);
    const discountedTransactions = filteredTransactions.filter(
      (t) => t.discountsAndPromotions && t.discountsAndPromotions !== "None"
    ).length;
    const nonDiscountedTransactions = totalTransactions - discountedTransactions;

    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
      <html>
        <head>
          <title>Transaction History Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            h1 { margin: 0; font-size: 18px; }
            .export-header { display: flex; align-items: flex-start; margin-bottom: 15px; }
            .export-header img { height: 140px; }
            .header-details { text-align: left; font-size: 13px; margin-left: 15px; }

            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; font-size: 11px; text-align: left; }
            th { background-color: #4B929D !important; color: #fff !important; font-weight: bold; text-align: center; }

            .badge { padding: 3px 6px; border-radius: 5px; font-size: 11px; font-weight: bold; }

            .summary { margin-top: 40px; font-size: 12px; text-align: center; }
            .summary h3 { margin-bottom: 10px; }
            .summary-table { border-collapse: collapse; width: 100%; }
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
              <h1>Transaction History - ${activeTab}</h1>
              <p><strong>Generated On:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Generated By:</strong> ${exportedBy || "System"}</p>
              <p><strong>Transaction Period:</strong> ${dateFilter || "All"}</p>
              <p><strong>Status Filter:</strong> ${statusFilter || "All"}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Transaction Number</th>
                <th>Date</th>
                <th>Cashier</th>
                <th>Order Type</th>
                <th>Items</th>
                <th>Discounts</th>
                <th>Total</th>
                <th>Payment Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map((t) => `
                <tr>
                  <td>${t.id}</td>
                  <td>${new Date(t.date).toLocaleDateString()}</td>
                  <td>${t.cashierName || "—"}</td>
                  <td>${t.orderType || "—"}</td>
                  <td>${t.items?.length || 0}</td>
                  <td><span class="badge discount">${t.discountsAndPromotions || "None"}</span></td>
                  <td>₱${parseFloat(t.total).toFixed(2)}</td>
                  <td>${t.paymentMethod || "N/A"}</td>
                  <td><span class="badge ${t.status.toLowerCase()}">${t.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="summary">
            <h3>Transaction Summary</h3>
            <table class="summary-table">
              <tr><th>Total Transactions</th><td>${totalTransactions}</td></tr>
              <tr><th>Total Sale</th><td>₱${totalSale.toFixed(2)}</td></tr>
              <tr><th>Total Item Ordered</th><td>${totalItems}</td></tr>
              <tr><th>Total Discounted Transactions</th><td>${discountedTransactions}</td></tr>
              <tr><th>Total Non-Discounted Transactions</th><td>${nonDiscountedTransactions}</td></tr>
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

    if (!filteredTransactions.length) {
      showNoDataModal();
      return;
    }

    const headers = [
      "Transaction Number",
      "Date",
      "Cashier",
      "Order Type",
      "Items",
      "Discounts",
      "Total",
      "Payment Method",
      "Status"
    ];

    const rows = filteredTransactions.map((t) => [
      t.id,
      new Date(t.date).toLocaleDateString(),
      t.cashierName || "—",
      t.orderType || "—",
      t.items?.length || 0,
      t.discountsAndPromotions || "None",
      `₱${parseFloat(t.total).toFixed(2)}`,
      t.paymentMethod || "N/A",
      t.status
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transaction_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showNoDataModal = () => {
    const noDataContainer = document.createElement("div");
    document.body.appendChild(noDataContainer);
    const noDataRoot = ReactDOM.createRoot(noDataContainer);

    const cleanupNoData = () => {
      noDataRoot.unmount();
      document.body.removeChild(noDataContainer);
    };

    noDataRoot.render(<NoDataModal onClose={cleanupNoData} />);
  };

  root.render(
    <ExportModal
      onClose={cleanup}
      onExportPDF={handleExportPDF}
      onExportCSV={handleExportCSV}
    />
  );
};

export default handleExport;