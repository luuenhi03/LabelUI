import React, { useState } from "react";
import axios from "../utils/axios";
import "./CarColorPrediction.css";

const CarColorPrediction = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [prediction, setPrediction] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPrediction("");
      setError("");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setPrediction("");
    setError("");
  };

  const handlePredict = async () => {
    if (!selectedFile) {
      setError("Please select an image first");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:5001/classify", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Classification failed");
      }

      const result = await response.json();
      setPrediction(result.prediction);
    } catch (error) {
      console.error("Error predicting color:", error);
      setError("Failed to predict color. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="prediction-container">
      <h1>Car Color Prediction</h1>

      <div className="prediction-content">
        <div className="image-upload-section">
          {!previewUrl ? (
            <>
              <input
                type="file"
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: "none" }}
                id="file-input"
              />
              <label htmlFor="file-input" className="choose-image-btn">
                Choose Image
              </label>
            </>
          ) : (
            <>
              <img src={previewUrl} alt="Preview" className="preview-image" />
              <div className="button-group">
                <button
                  className="choose-image-btn"
                  onClick={handlePredict}
                  disabled={isLoading}
                >
                  {isLoading ? "Predicting..." : "Predict Color"}
                </button>
                <button className="exit-btn" onClick={handleReset}>
                  Exit
                </button>
              </div>
            </>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {prediction && !error && (
          <div className="prediction-result">
            <h3>Predicted Color:</h3>
            <div className="color-prediction">{prediction}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarColorPrediction;
