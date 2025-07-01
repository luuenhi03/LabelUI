import React, { useState } from "react";
import axios from "axios";
import "./CarColorPrediction.css";

const CarColorPrediction = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [prediction, setPrediction] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    handleFile(file);
  };

  const handleFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsLoading(true);
    reader.onloadend = () => {
      setSelectedFile(file);
      setPreviewUrl(reader.result);
      setPrediction("");
      setError("");
      setIsLoading(false);
    };
    reader.onerror = () => {
      setError("Could not read file. Please try again.");
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setPrediction("");
    setError("");
    setIsLoading(false);
    if (document.getElementById("file-input")) {
      document.getElementById("file-input").value = "";
    }
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
    setPrediction("");

    try {
      const response = await axios.post(
        "http://localhost:3001/classify",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.success && response.data.prediction) {
        const result = response.data.prediction;
        if (result.predicted_class) {
          setPrediction(
            `${result.predicted_class} (${(result.confidence * 100).toFixed(
              1
            )}%)`
          );
        } else {
          throw new Error("Invalid prediction format");
        }
      } else {
        throw new Error(response.data.error || "Invalid server response");
      }
    } catch (error) {
      console.error("Error details:", error);

      if (error.response) {
        setError(
          error.response.data.message ||
            error.response.data.error ||
            "Failed to predict color"
        );
      } else if (error.request) {
        setError("Server is not responding. Please try again later.");
      } else {
        setError(error.message || "Failed to predict color");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="prediction-container">
      <h1>Car Color Prediction</h1>

      <div className="prediction-content">
        <div
          className={`image-upload-section ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!previewUrl ? (
            <>
              <input
                type="file"
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: "none" }}
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="choose-image-btn"
                style={{ opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? "Processing..." : "Choose Image"}
              </label>
              <div className="upload-hint">or drag and drop image here</div>
            </>
          ) : (
            <>
              <img
                src={previewUrl}
                alt="Preview"
                className="preview-image"
                style={{ opacity: isLoading ? 0.7 : 1 }}
              />
              <div className="button-group">
                <button
                  className="predict-btn"
                  onClick={handlePredict}
                  disabled={isLoading}
                >
                  {isLoading ? "Predicting..." : "Predict Color"}
                </button>
                <button
                  className="exit-btn"
                  onClick={handleReset}
                  disabled={isLoading}
                >
                  Exit
                </button>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z"
                fill="currentColor"
              />
            </svg>
            {error}
          </div>
        )}

        {prediction && !error && (
          <div className="prediction-result">
            <h3>Prediction Result:</h3>
            <div className="color-prediction">
              {prediction.split("(")[0]}
              <span>Accuracy: {prediction.match(/\((.*?)\)/)[1]}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarColorPrediction;
