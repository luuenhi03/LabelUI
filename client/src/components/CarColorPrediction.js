import React, { useState } from "react";
import "./CarColorPrediction.css";

const CarColorPrediction = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Server B URL (change according to server IP address)
  const serverBUrl = "http://localhost:5001";

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResult(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePredict = async () => {
    if (!selectedFile) {
      setError("Please select an image first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await fetch(serverBUrl, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.result) {
        setResult(data.result);
      } else {
        setError("No result returned from server.");
      }
    } catch (err) {
      setError("Connection error to server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="car-color-prediction">
      <h1>Car Color Prediction</h1>

      <div className="upload-section">
        <input
          accept="image/*"
          style={{ display: "none" }}
          id="image-input"
          type="file"
          onChange={handleFileSelect}
        />
        <label htmlFor="image-input" className="upload-button">
          Choose Image
        </label>
        {selectedFile && <p className="file-name">{selectedFile.name}</p>}
      </div>

      {preview && (
        <div className="preview-section">
          <img src={preview} alt="Preview" className="preview-image" />
        </div>
      )}

      {selectedFile && (
        <div className="predict-section">
          <button
            className="predict-button"
            onClick={handlePredict}
            disabled={loading}
          >
            Predict
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {result && result.prediction && (
        <div className="result-message">
          Predicted color: {result.prediction.predicted_class} <br />
          Confidence: {result.prediction.confidence}
        </div>
      )}
    </div>
  );
};

export default CarColorPrediction;
