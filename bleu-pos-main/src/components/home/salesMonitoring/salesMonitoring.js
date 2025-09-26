import React from "react";
import "./salesMonitoring.css";
import Sidebar from "../shared/sidebar";
import Header from "../shared/header"; 

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