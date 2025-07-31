import React from "react";
import "../admin/transRep.css";
import Sidebar from "../sidebar";
import Header from "../admin/header"; 

function TransactionReports() {
  
  return (
    <div className='transaction-reports'>
        <Sidebar />
        <div className='transRep'>
        <Header pageTitle="Transaction Reports" />
        </div> 
    </div>
  )
}

export default TransactionReports