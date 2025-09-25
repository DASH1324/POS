import React, { useState } from "react";
import "./salesReport.css";
import Sidebar from "../sidebar/sidebar";
import Header from "../header/header";

   function SalesReport() {
  return (
    <div className='sales-report'>
        <Sidebar />
        <div className='report'>
        <Header pageTitle="Sales Report" />
        </div>
    </div>
  )
}

export default SalesReport;