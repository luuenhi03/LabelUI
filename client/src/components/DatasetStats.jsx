import React, { useState, useEffect } from "react";
import axios from "../utils/axios";
import { useParams, useNavigate } from "react-router-dom";
import "./DatasetStats.scss";

const DatasetStats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [labeled, setLabeled] = useState(0);
  const [unlabeled, setUnlabeled] = useState(0);
  const [consistentImages, setConsistentImages] = useState([]);
  const [inconsistentImages, setInconsistentImages] = useState([]);
  const [showUnlabeledList, setShowUnlabeledList] = useState(false);
  const [unlabeledImagesList, setUnlabeledImagesList] = useState([]);
  const [showLabeledList, setShowLabeledList] = useState(false);
  const [labeledImagesList, setLabeledImagesList] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (!storedUser || !storedUser.id) {
          setError("Please login to view dataset information");
          return;
        }

        console.log("Fetching dataset with ID:", id);
        const res = await axios.get(
          `/api/dataset/${id}?userId=${storedUser.id}`
        );
        console.log("Dataset response:", res.data);
        const ds = res.data;
        setDataset(ds);

        // Lấy danh sách ảnh chưa gán nhãn
        const unlabeledRes = await axios.get(
          `/api/dataset/${id}/images?type=unlabeled`
        );
        setUnlabeledImagesList(unlabeledRes.data);
        setUnlabeled(unlabeledRes.data.length);

        // Lấy danh sách ảnh đã gán nhãn
        const labeledRes = await axios.get(
          `/api/dataset/${id}/images?type=labeled`
        );
        setLabeledImagesList(labeledRes.data);
        setLabeled(labeledRes.data.length);

        // Lấy tổng số ảnh
        const totalRes = await axios.get(`/api/dataset/${id}/images?type=all`);
        setTotal(totalRes.data.length);

        // Xử lý thống kê nhãn
        const consistent = [];
        const inconsistent = [];

        labeledRes.data.forEach((img) => {
          if (!img.labels || img.labels.length === 0) return;

          const latestLabels = {};
          img.labels.forEach((label) => {
            const userId = label.labeledBy;
            if (
              !latestLabels[userId] ||
              new Date(label.labeledAt) >
                new Date(latestLabels[userId].labeledAt)
            ) {
              latestLabels[userId] = label;
            }
          });
          const uniqueLabels = new Set(
            Object.values(latestLabels).map((l) => l.label)
          );

          img.latestLabels = latestLabels;

          if (uniqueLabels.size === 1) {
            consistent.push(img);
          } else {
            inconsistent.push(img);
          }
        });

        setConsistentImages(consistent);
        setInconsistentImages(inconsistent);
      } catch (err) {
        console.error("Error fetching dataset stats:", err);
        console.error("Error details:", {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          config: err.config,
        });
        setError(
          err.response?.data?.message || "Unable to load dataset information"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [id]);

  const handleImageClick = (imageId) => {
    navigate(`/label?dataset=${id}&image=${imageId}`);
  };

  if (loading) return <div className="dataset-stats-loading">Loading...</div>;
  if (error) return <div className="dataset-stats-error">{error}</div>;
  if (!dataset) return null;

  return (
    <div className="dataset-stats-detail-container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "20px",
          gap: "20px",
        }}
      >
        <button
          onClick={() => navigate("/dataset")}
          style={{
            padding: "8px 12px",
            backgroundColor: "#fff",
            border: "1px solid #666",
            color: "#666",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            width: "40px",
            height: "40px",
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = "#f5f5f5";
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = "#fff";
          }}
        >
          ←
        </button>
        <h1 className="dataset-title" style={{ margin: 0 }}>
          {dataset.name}
        </h1>
      </div>
      <div className="stats-box-row">
        <div
          className="stats-box small"
          onClick={() => setShowUnlabeledList(true)}
          style={{ cursor: "pointer" }}
        >
          <div className="stats-label">Unlabeled Images</div>
          <div className="stats-value">{unlabeled}</div>
        </div>
        <div
          className="stats-box small"
          onClick={() => setShowLabeledList(true)}
          style={{ cursor: "pointer" }}
        >
          <div className="stats-label">Labeled Images</div>
          <div className="stats-value">{labeled}</div>
        </div>
      </div>

      {showUnlabeledList && (
        <div
          className="unlabeled-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="unlabeled-modal-content"
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              minWidth: 320,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h3>Unlabeled Images ({unlabeledImagesList.length})</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {unlabeledImagesList.map((img) => (
                <li
                  key={img._id}
                  style={{
                    cursor: "pointer",
                    color: "#007bff",
                    padding: "6px 0",
                    borderBottom: "1px solid #eee",
                  }}
                  onClick={() => {
                    handleImageClick(img._id);
                    setShowUnlabeledList(false);
                  }}
                >
                  {img.filename}
                </li>
              ))}
            </ul>
            <button
              style={{
                marginTop: 16,
                padding: "8px 24px",
                background: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.target.style.background = "#0056b3")}
              onMouseOut={(e) => (e.target.style.background = "#007bff")}
              onClick={() => setShowUnlabeledList(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showLabeledList && (
        <div
          className="labeled-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="labeled-modal-content"
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 8,
              minWidth: 320,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h3>Labeled Images ({labeledImagesList.length})</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {labeledImagesList.map((img) => (
                <li
                  key={img._id}
                  style={{
                    cursor: "pointer",
                    color: "#007bff",
                    padding: "6px 0",
                    borderBottom: "1px solid #eee",
                  }}
                  onClick={() => {
                    handleImageClick(img._id);
                    setShowLabeledList(false);
                  }}
                >
                  {img.filename}
                </li>
              ))}
            </ul>
            <button
              style={{
                marginTop: 16,
                padding: "8px 24px",
                background: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.target.style.background = "#0056b3")}
              onMouseOut={(e) => (e.target.style.background = "#007bff")}
              onClick={() => setShowLabeledList(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Consistent Images Section */}
      <div className="image-group-section">
        <h2>100% Consistent Images ({consistentImages.length})</h2>
        <div className="image-list">
          {consistentImages.map((img) => (
            <div
              key={img._id}
              className="image-list-item"
              onClick={() => handleImageClick(img._id)}
            >
              <div className="image-info">
                <span className="image-filename">{img.filename}</span>
                <span className="image-label">{img.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inconsistent Images Section */}
      <div className="image-group-section">
        <h2>Inconsistent Labeled Images ({inconsistentImages.length})</h2>
        <div className="image-list">
          {inconsistentImages.map((img) => (
            <div
              key={img._id}
              className="image-list-item"
              onClick={() => handleImageClick(img._id)}
            >
              <div className="image-info">
                <span className="image-filename">{img.filename}</span>
                <div className="image-labels">
                  {Array.from(
                    new Set(Object.values(img.latestLabels).map((l) => l.label))
                  ).join(", ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DatasetStats;
