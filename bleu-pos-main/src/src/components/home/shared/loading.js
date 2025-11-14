import React from "react";
import Lottie from "lottie-react";
import loadingAnimation from "../../../assets/animation/loading.json";
import '../../confirmAlertCustom.css';

const Loading = () => {
  return (
    <div className="loading-container">
      <div className="loading-bg">
        <Lottie 
          animationData={loadingAnimation} 
          loop={true} 
          className="loading-animation" 
        />
      </div>
    </div>
  );
};

export default Loading;