import React from "react";
import "../admin/salesMon.css";
import Sidebar from "../sidebar";
import Header from "../admin/header"; 

function SalesMonitoring() {
  return (
    <div className='sales-monitoring'>
        <Sidebar />
        <div className='monitoring'>
        <Header pageTitle="Sales Monitoring" />
        </div>
    </div>
  )
}

export default SalesMonitoring