import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./ImageUpload.scss";

const ImageUpload = ({ onUploadSuccess }) => {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [newDatasetName, setNewDatasetName] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [actionMessage, setActionMessage] = useState("");
  const [datasetsError, setDatasetsError] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setLoading(true);
        const storedUser = JSON.parse(localStorage.getItem("user"));

        const response = await axios.get("http://localhost:5000/api/dataset", {
          params: {
            userId: storedUser.id,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        setDatasets(response.data);
      } catch (error) {
        console.error("Error:", error);
        setDatasetsError("Error when fetching dataset list");
      } finally {
        setLoading(false);
      }
    };

    fetchDatasets();
  }, []);

  const createDataset = async () => {
    if (!newDatasetName.trim()) {
      setMessage("Please enter a dataset name!");
      setMessageType("error");
      return;
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (!storedUser || !storedUser.id) {
        setMessage("Please login to create a dataset!");
        setMessageType("error");
        return;
      }

      const response = await axios.post("http://localhost:5000/api/dataset", {
        name: newDatasetName.trim(),
        userId: storedUser.id.toString(),
        isPrivate: isPrivate,
      });

      setDatasets([...datasets, response.data]);
      setSelectedDataset(response.data._id);
      setNewDatasetName("");
      setMessage("Dataset created successfully!");
      setMessageType("success");
    } catch (error) {
      console.error("Error creating dataset:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Cannot create dataset. Please try again later.";
      setMessage(errorMessage);
      setMessageType("error");
    }
  };

  const handleFileSelect = (event) => {
    setMessage("");
    const files = Array.from(event.target.files);
    const maxSize = 10 * 1024 * 1024;
    const maxFiles = 10;

    if (files.length > maxFiles) {
      setMessage(`Maximum ${maxFiles} files allowed.`);
      setMessageType("error");
      return;
    }
    for (let file of files) {
      if (file.size > maxSize) {
        setMessage("File too large. Maximum allowed size is 10MB.");
        setMessageType("error");
        return;
      }
    }

    if (!selectedDataset) {
      setMessage("Please select dataset!");
    }
    setImages(files);
  };

  const handleFolderSelect = async (event) => {
    setMessage("");
    const files = event.target.files;
    if (!files.length) return;

    const imageFiles = [];
    const processFile = (file) => {
      if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      }
    };

    for (let i = 0; i < files.length; i++) {
      processFile(files[i]);
    }

    setImages(imageFiles);
  };

  const uploadImages = async () => {
    if (!window.navigator.onLine) {
      setMessage(
        "No internet connection. Please check your network and try again."
      );
      setMessageType("error");
      return;
    }
    if (!selectedDataset) {
      setMessage("Please select a dataset!");
      setMessageType("error");
      return;
    }

    if (images.length === 0) {
      setMessage("Please select images to upload!");
      setMessageType("error");
      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login to upload images!");
        setMessageType("error");
        return;
      }

      const batchSize = 5;
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        const batchFormData = new FormData();

        batch.forEach((image) => {
          batchFormData.append("images", image);
        });

        try {
          console.log(
            `Uploading batch ${i / batchSize + 1}/${Math.ceil(
              images.length / batchSize
            )}`
          );
          const response = await axios.post(
            `http://localhost:5000/api/dataset/${selectedDataset}/upload`,
            batchFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
                Authorization: `Bearer ${token}`,
              },
              timeout: 60000,
            }
          );

          if (response.data.images) {
            if (onUploadSuccess) {
              onUploadSuccess(response.data.images);
            }
          }
        } catch (error) {
          console.error("Error uploading batch:", error);
          console.error("Error details:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
          throw error;
        }
      }

      setMessage(`Successfully uploaded ${images.length} images!`);
      setMessageType("success");
      setTimeout(() => setMessage(""), 3000);
      setImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading:", error);
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Cannot upload images. Please try again later."
      );
      setMessageType("error");
    } finally {
      setUploading(false);
    }
  };

  const handleDatasetSelect = (e) => {
    setSelectedDataset(e.target.value);
    setMessage("");
  };

  return (
    <div
      className="upload-container"
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "30px",
        backgroundColor: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        className="dataset-controls"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <select
          className="dataset-select"
          value={selectedDataset}
          onChange={(e) => setSelectedDataset(e.target.value)}
          style={{
            padding: "12px 16px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            backgroundColor: "#fff",
            fontSize: "15px",
            width: "100%",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <option value="">Select dataset...</option>
          {datasets.map((dataset) => (
            <option key={dataset._id} value={dataset._id}>
              {dataset.name}
            </option>
          ))}
        </select>

        <div
          className="new-dataset"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "20px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e0e0e0",
          }}
        >
          <input
            type="text"
            className="dataset-input"
            placeholder="Enter dataset name..."
            value={newDatasetName}
            onChange={(e) => setNewDatasetName(e.target.value)}
            style={{
              padding: "12px 16px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              backgroundColor: "#fff",
              fontSize: "15px",
              transition: "all 0.2s ease",
            }}
          />

          <select
            className="privacy-select"
            value={isPrivate ? "private" : "public"}
            onChange={(e) => setIsPrivate(e.target.value === "private")}
            style={{
              padding: "12px 16px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              backgroundColor: "#fff",
              fontSize: "15px",
              width: "100%",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <option value="public">Public Dataset</option>
            <option value="private">Private Dataset</option>
          </select>

          <button
            className="create-btn"
            onClick={createDataset}
            disabled={!newDatasetName.trim()}
            style={{
              padding: "12px 24px",
              backgroundColor: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              opacity: !newDatasetName.trim() ? "0.7" : "1",
            }}
          >
            Create Dataset
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`message ${messageType}`}
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          {message}
        </div>
      )}

      <div
        className="upload-area"
        style={{
          border: "2px dashed #e0e0e0",
          borderRadius: "12px",
          padding: "30px",
          textAlign: "center",
          backgroundColor: "#fafafa",
          transition: "all 0.2s ease",
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <input
          type="file"
          ref={folderInputRef}
          webkitdirectory=""
          directory=""
          onChange={handleFolderSelect}
          style={{ display: "none" }}
        />
        <div
          style={{
            border: "2px dashed #ccc",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "center",
            gap: "20px",
          }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "180px",
              padding: "10px 0",
              backgroundColor: "#fff",
              border: "1px solid #1976d2",
              color: "#1976d2",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "15px",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#f5f9ff";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#fff";
            }}
          >
            Select Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            style={{
              width: "180px",
              padding: "10px 0",
              backgroundColor: "#fff",
              border: "1px solid #1976d2",
              color: "#1976d2",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "15px",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#f5f9ff";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#fff";
            }}
          >
            Select Folder
          </button>
        </div>
        {images.length > 0 && (
          <>
            <div
              className="selected-files"
              style={{
                color: "#666",
                fontSize: "14px",
                marginBottom: "20px",
              }}
            >
              {images.length} file(s) selected
            </div>
            <button
              onClick={uploadImages}
              disabled={!selectedDataset || images.length === 0}
              style={{
                padding: "12px 32px",
                backgroundColor: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
                opacity: !selectedDataset || images.length === 0 ? "0.7" : "1",
              }}
            >
              Upload Images
            </button>
          </>
        )}
      </div>

      <style>{`
        .upload-label:hover {
          background-color: #f5f9ff !important;
          border-color: #1565c0 !important;
          color: #1565c0 !important;
          transform: translateY(-1px);
        }
        .dataset-select:hover, .privacy-select:hover {
          border-color: #1976d2;
        }
        .dataset-select:focus, .privacy-select:focus, .dataset-input:focus {
          border-color: #1976d2;
          box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
          outline: none;
        }
        .create-btn:hover:enabled {
          background-color: #1565c0;
          transform: translateY(-1px);
        }
        .create-btn:active:enabled {
          transform: translateY(0);
        }
        .message.success {
          background-color: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #c8e6c9;
        }
        .message.error {
          background-color: #ffebee;
          color: #c62828;
          border: 1px solid #ffcdd2;
        }
        .upload-area:hover {
          border-color: #1976d2;
          background-color: #f5f9ff;
        }
        .message {
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          text-align: center;
        }
        .message.error {
          color: #721c24;
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
        }
        .message.success {
          color: #155724;
          background-color: #d4edda;
          border: 1px solid #c3e6cb;
        }
      `}</style>
    </div>
  );
};

export default ImageUpload;
