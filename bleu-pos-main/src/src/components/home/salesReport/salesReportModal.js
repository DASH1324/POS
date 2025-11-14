import React from "react";
import { FaTimes } from "react-icons/fa";
import DataTable from "react-data-table-component";
import "./salesReportModal.css";

const SalesReportModal = ({ show, onClose, data, type, periodText }) => {
  if (!show) return null;

  const formatCurrency = (value) => {
    const num = parseFloat(value || 0);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const categoryColumns = [
    { name: "CATEGORY", selector: (row) => row.category, sortable: true, width: "40%" },
    { name: "QUANTITY SOLD", selector: (row) => row.quantity || 0, center: true, sortable: true, width: "30%" },
    { name: "SALES AMOUNT", selector: (row) => `₱${formatCurrency(row.sales)}`, center: true, sortable: true, width: "30%" },
  ];

  const productColumns = [
    { name: "PRODUCT", selector: (row) => row.product, sortable: true, width: "30%" },
    { name: "CATEGORY", selector: (row) => row.category, center: true, sortable: true, width: "25%" },
    { name: "UNITS SOLD", selector: (row) => row.units || 0, center: true, sortable: true, width: "20%" },
    { name: "TOTAL SALES", selector: (row) => `₱${formatCurrency(row.total)}`, center: true, sortable: true, width: "25%" },
  ];

  const commonTableStyles = {
    headCells: { style: { fontWeight: "600", fontSize: "14px", padding: "12px", textTransform: "uppercase", textAlign: "center", letterSpacing: "1px" } },
    rows: { style: { minHeight: "55px", padding: "5px"} },
  };

  return (
    <div className="sales-report-modal-overlay" onClick={onClose}>
      <div className="sales-report-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="sales-report-modal-header">
          <div className="sales-report-modal-title-section">
            <h2>Sales Breakdown - {type === 'category' ? 'By Category' : 'By Product'}</h2>
            <p className="sales-report-modal-period">{periodText}</p>
          </div>
          <button className="sales-report-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="sales-report-modal-body">
          <DataTable
            columns={type === 'category' ? categoryColumns : productColumns}
            data={data ?? []}
            responsive
            pagination
            paginationPerPage={10}
            paginationRowsPerPageOptions={[10]}
            customStyles={commonTableStyles}
          />
        </div>
      </div>
    </div>
  );
};

export default SalesReportModal;