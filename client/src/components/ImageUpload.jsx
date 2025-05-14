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
      const response = await axios.get("http://localhost:5000/api/dataset");
      setDatasets(response.data);
      setMessage("");
    } catch (error) {
      console.error("Lỗi khi lấy danh sách dataset:", error);
      setMessage("Không thể tải danh sách dataset. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const createDataset = async () => {
    if (!newDatasetName.trim()) {
      setMessage("Vui lòng nhập tên dataset!");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/api/dataset", {
        name: newDatasetName.trim(),
      });

      setDatasets([...datasets, response.data]);
      setSelectedDataset(response.data._id);
      setNewDatasetName("");
      setMessage("Tạo dataset thành công!");
    } catch (error) {
      console.error("Lỗi khi tạo dataset:", error);
      setMessage("Không thể tạo dataset. Vui lòng thử lại sau.");
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setImages(files);
  };

  const uploadImages = async () => {
    if (!selectedDataset) {
      setMessage("Vui lòng chọn dataset!");
      return;
    }

    if (images.length === 0) {
      setMessage("Vui lòng chọn ảnh để upload!");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      images.forEach((image) => {
        formData.append("images", image);
      });

      const response = await axios.post(
        `http://localhost:5000/api/dataset/${selectedDataset}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setMessage(`Upload thành công ${response.data.length} ảnh!`);
      setImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
    } catch (error) {
      console.error("Lỗi khi upload:", error);
      setMessage("Không thể upload ảnh. Vui lòng thử lại sau.");
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

  return (
    <div className="image-upload-container">
      <div className="dataset-section">
        {/* <h2>Quản lý Dataset</h2> */}

        <div className="create-dataset">
          <input
            type="text"
            value={newDatasetName}
            onChange={(e) => setNewDatasetName(e.target.value)}
            placeholder="Nhập tên dataset mới"
            className="dataset-input"
          />
          <button
            onClick={createDataset}
            className="create-btn"
            disabled={!newDatasetName.trim()}
          >
            Tạo Dataset
          </button>
        </div>

        <div className="select-dataset">
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="dataset-select"
          >
            <option value="">Chọn dataset</option>
            {datasets.map((dataset) => (
              <option key={dataset._id} value={dataset._id}>
                {dataset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="upload-area">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            ref={fileInputRef}
            className="file-input"
          />
          <div className="selected-files">
            {images.length > 0 && <p>Đã chọn {images.length} ảnh</p>}
          </div>
          <button
            onClick={uploadImages}
            disabled={!selectedDataset || images.length === 0 || uploading}
            className="upload-btn"
          >
            {uploading ? "Đang upload..." : "Upload Ảnh"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`message ${
            message.includes("thành công") ? "success" : "error"
          }`}
        >
          {message}
        </div>
      )}

      {loading && <div className="loading">Đang tải dữ liệu...</div>}
    </div>
  );
};

export default ImageUpload;
