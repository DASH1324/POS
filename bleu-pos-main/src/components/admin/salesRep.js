import React from "react";
import "../admin/salesRep.css";
import Sidebar from "../sidebar";
import Header from "../admin/header"; 

function SalesReports() {
  return (
    <div className='sales-reports'>
        <Sidebar />
        <div className='salesRep'>
        <Header pageTitle="Sales Reports" />
        </div>
    </div>
  )
}

export default SalesReports