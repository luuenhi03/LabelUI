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
  const [editDatasetId, setEditDatasetId] = useState(null);
  const [editDatasetName, setEditDatasetName] = useState("");
  const [shareDatasetId, setShareDatasetId] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [datasetsError, setDatasetsError] = useState("");

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      console.log("=== Fetch Datasets Debug ===");

      const storedUser = JSON.parse(localStorage.getItem("user"));
      console.log("Stored user:", storedUser);

      // Tạm thời bỏ kiểm tra userId để test
      // if (!storedUser || !storedUser.id) {
      //   setMessage("Vui lòng đăng nhập để xem danh sách dataset!");
      //   return;
      // }

      console.log("Fetching datasets...");
      const response = await axios.get(
        `http://localhost:5000/api/dataset`
        // `http://localhost:5000/api/dataset?userId=${storedUser.id}`
      );

      console.log("API Response:", response.data);
      setDatasets(response.data);
      setMessage("");
    } catch (error) {
      console.error("Lỗi khi lấy danh sách dataset:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setMessage("Cannot load dataset list. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const createDataset = async () => {
    if (!newDatasetName.trim()) {
      setMessage("Please enter a dataset name!");
      return;
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (!storedUser || !storedUser.id) {
        setMessage("Please login to create a dataset!");
        return;
      }

      const response = await axios.post("http://localhost:5000/api/dataset", {
        name: newDatasetName.trim(),
        userId: storedUser.id,
      });

      setDatasets([...datasets, response.data]);
      setSelectedDataset(response.data._id);
      setNewDatasetName("");
      setMessage("Dataset created successfully!");
    } catch (error) {
      console.error("Lỗi khi tạo dataset:", error);
      setMessage("Cannot create dataset. Please try again later.");
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setImages(files);
  };

  const handleFolderSelect = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    const imageFiles = [];
    const processFile = (file) => {
      if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      }
    };

    // Process all files in the folder
    for (let i = 0; i < files.length; i++) {
      processFile(files[i]);
    }

    setImages(imageFiles);
  };

  const uploadImages = async () => {
    if (!selectedDataset) {
      setMessage("Please select a dataset!");
      return;
    }

    if (images.length === 0) {
      setMessage("Please select images to upload!");
      return;
    }

    try {
      setUploading(true);
      setMessage(""); // Clear any previous message immediately

      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login to upload images!");
        return;
      }

      // Upload in batches of 5 files
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
              timeout: 60000, // 60 seconds timeout
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
      setTimeout(() => setMessage(""), 3000); // Hide success after 3s
      setImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Lỗi khi upload:", error);
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Cannot upload images. Please try again later."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleEditDataset = (dataset) => {
    setEditDatasetId(dataset._id);
    setEditDatasetName(dataset.name);
    setActionMessage("");
  };

  const handleEditDatasetSave = async (datasetId) => {
    if (!editDatasetName.trim()) return;
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const email = storedUser?.email || "";

      await axios.put(`http://localhost:5000/api/dataset/${datasetId}`, {
        name: editDatasetName.trim(),
        labeledBy: email,
      });
      setActionMessage("Đã đổi tên dataset thành công!");
      setEditDatasetId(null);
      setEditDatasetName("");
      fetchDatasets();
    } catch (err) {
      setActionMessage("Lỗi khi đổi tên dataset!");
    }
  };

  const handleShareDataset = (dataset) => {
    setShareDatasetId(dataset._id);
    setShareEmail("");
    setActionMessage("");
  };

  const handleShareDatasetSend = async (datasetId) => {
    if (!shareEmail.trim()) return;
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const email = storedUser?.email || "";

      await axios.post(`http://localhost:5000/api/dataset/${datasetId}/share`, {
        email: shareEmail.trim(),
      });
      setActionMessage("Đã chia sẻ dataset thành công!");
      setShareDatasetId(null);
      setShareEmail("");
    } catch (err) {
      setActionMessage("Lỗi khi chia sẻ dataset!");
    }
  };

  const handleDatasetSelect = (e) => {
    setSelectedDataset(e.target.value);
    setMessage(""); // Clear message when selecting new dataset
  };

  return (
    <div className="image-upload-container">
      <div className="dataset-section">
        {/* <h2>Quản lý Dataset</h2> */}

        <div className="create-dataset">
          <input
            type="text"
            value={newDatasetName}
            onChange={(e) => setNewDatasetName(e.target.value)}
            placeholder="Enter new dataset name"
            className="dataset-input"
          />
          <button
            onClick={createDataset}
            className="create-btn"
            disabled={!newDatasetName.trim()}
          >
            Create Dataset
          </button>
        </div>

        <div className="select-dataset">
          <select
            value={selectedDataset}
            onChange={handleDatasetSelect}
            className="dataset-select"
          >
            <option value="">Select dataset</option>
            {datasets.map((dataset) => (
              <option key={dataset._id} value={dataset._id}>
                {dataset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="upload-area">
          <div className="upload-options">
            <div className="upload-option">
              <label className="upload-label">
                Choose file
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  className="file-input"
                />
              </label>
            </div>
            <div className="upload-option">
              <label className="upload-label">
                Choose folder
                <input
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  accept="image/*"
                  onChange={handleFolderSelect}
                  ref={folderInputRef}
                  className="file-input"
                />
              </label>
            </div>
          </div>
          <div className="selected-files">
            {images.length > 0 && <p>{images.length} images selected</p>}
          </div>
          <button
            onClick={uploadImages}
            disabled={!selectedDataset || images.length === 0 || uploading}
            className="upload-btn"
          >
            {uploading ? "Uploading..." : "Upload Images"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`message ${
            message.includes("Successfully uploaded") ||
            message.includes("Dataset created successfully")
              ? "success"
              : "error"
          }`}
          style={
            message.includes("Successfully uploaded") ||
            message.includes("Dataset created successfully")
              ? {
                  background: "#d4edda",
                  color: "#155724",
                  border: "1px solid #c3e6cb",
                }
              : {}
          }
        >
          {message}
        </div>
      )}

      {loading && <div className="loading">Đang tải dữ liệu...</div>}
    </div>
  );
};

export default ImageUpload;
