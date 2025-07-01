import React, { useState, useEffect } from "react";
import axios from "../utils/axios";
import { useParams, useNavigate } from "react-router-dom";
import "./DatasetStats.scss";

const ITEMS_PER_PAGE = 20;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [consistentPage, setConsistentPage] = useState(1);
  const [inconsistentPage, setInconsistentPage] = useState(1);

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

        console.log("All images:", ds.images);

        const totalImages = ds.images ? ds.images.length : 0;
        console.log("Total images:", totalImages);

        const labeledImages = ds.images
          ? ds.images.filter((img) => {
              const isLabeled =
                (img.label && img.label.trim() !== "") ||
                img.isCropped ||
                (img.labels && img.labels.length > 0);
              console.log(
                "Image check:",
                img.filename,
                "Label:",
                img.label,
                "IsCropped:",
                img.isCropped,
                "Labels array:",
                img.labels,
                "IsLabeled:",
                isLabeled
              );
              return isLabeled;
            }).length
          : 0;
        console.log("Labeled images count:", labeledImages);
        setTotal(totalImages);
        setLabeled(labeledImages);
        setUnlabeled(totalImages - labeledImages);

        const unlabeledImagesArr = ds.images
          ? ds.images.filter(
              (img) => (!img.label || img.label.trim() === "") && !img.isCropped
            )
          : [];
        setUnlabeledImagesList(unlabeledImagesArr);

        const consistent = [];
        const inconsistent = [];

        ds.images.forEach((img) => {
          if ((!img.label || img.label.trim() === "") && !img.isCropped) return;

          if (!img.labels || img.labels.length === 0) {
            consistent.push(img);
            return;
          }

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

        const labeledImagesArr = ds.images
          ? ds.images.filter((img) => {
              const isLabeled =
                (img.label && img.label.trim() !== "") ||
                img.isCropped ||
                (img.labels && img.labels.length > 0);
              return isLabeled;
            })
          : [];
        console.log("Final labeled images array:", labeledImagesArr);
        setLabeledImagesList(labeledImagesArr);
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

  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const totalPages = Math.ceil(consistentImages.length / ITEMS_PER_PAGE);

  const handleDeleteImage = async (imageId) => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const token = localStorage.getItem("token");

      if (!storedUser || !storedUser.id || !token) {
        setError("Vui lòng đăng nhập để xóa ảnh");
        return;
      }

      await axios.delete(`/api/dataset/${id}/images/${imageId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Cập nhật lại danh sách ảnh sau khi xóa
      const updatedLabeledImages = labeledImagesList.filter(
        (img) => img._id !== imageId
      );
      const updatedConsistentImages = consistentImages.filter(
        (img) => img._id !== imageId
      );
      const updatedInconsistentImages = inconsistentImages.filter(
        (img) => img._id !== imageId
      );

      setLabeledImagesList(updatedLabeledImages);
      setConsistentImages(updatedConsistentImages);
      setInconsistentImages(updatedInconsistentImages);
      setLabeled((prev) => prev - 1);
      setTotal((prev) => prev - 1);

      // Hiển thị thông báo thành công
      alert("Đã xóa ảnh thành công");
    } catch (err) {
      console.error("Lỗi khi xóa ảnh:", err);
      alert(
        err.response?.data?.message ||
          "Không thể xóa ảnh. Vui lòng thử lại sau."
      );
    }
  };

  const getPageData = (data, page) => {
    const startIndex = (page - 1) * 5;
    return data.slice(startIndex, startIndex + 5);
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
          className="stats-box"
          onClick={() => setShowUnlabeledList(true)}
          style={{ cursor: "pointer" }}
        >
          <div className="stats-label">Unlabeled Images</div>
          <div className="stats-value">{unlabeled}</div>
        </div>
        <div
          className="stats-box"
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                position: "sticky",
                top: 0,
                backgroundColor: "white",
                padding: "10px 0",
                zIndex: 1,
              }}
            >
              <h2>Unlabeled Images ({unlabeledImagesList.length})</h2>
              <button
                onClick={() => setShowUnlabeledList(false)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  "&:hover": {
                    backgroundColor: "#d32f2f",
                  },
                }}
              >
                Close
              </button>
            </div>
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
              minWidth: 600,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                position: "sticky",
                top: 0,
                backgroundColor: "white",
                padding: "10px 0",
                zIndex: 1,
              }}
            >
              <h2>Labeled Images ({labeledImagesList.length})</h2>
              <button
                onClick={() => setShowLabeledList(false)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  "&:hover": {
                    backgroundColor: "#d32f2f",
                  },
                }}
              >
                Close
              </button>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {labeledImagesList.map((img) => (
                <li
                  key={img._id}
                  style={{
                    cursor: "pointer",
                    fontSize: 16,
                    color: "#007bff",
                    padding: "12px 0",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onClick={() => {
                    handleImageClick(img._id);
                    setShowLabeledList(false);
                  }}
                >
                  <span>{img.filename}</span>
                  <span style={{ color: "#666", marginLeft: 12 }}>
                    {img.label
                      ? `Label: ${img.label}`
                      : img.labels && img.labels.length > 0
                      ? `Latest Label: ${
                          img.labels[img.labels.length - 1].label
                        }`
                      : ""}
                    {img.isCropped && (
                      <span style={{ color: "#4CAF50", marginLeft: 8 }}>
                        (Cropped)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Consistent Images Section */}
      <div className="image-group-section" style={{ marginBottom: "40px" }}>
        <h2 className="section-title" style={{ marginBottom: "20px" }}>
          100% Consistent Images ({consistentImages.length})
        </h2>
        <div className="image-list" style={{ marginBottom: "20px" }}>
          {getPageData(consistentImages, consistentPage).map((img, index) => (
            <div
              key={img._id}
              className="image-item"
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <div
                onClick={() => handleImageClick(img._id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                <span className="image-number" style={{ marginRight: "10px" }}>
                  {(consistentPage - 1) * 5 + index + 1}.
                </span>
                <span
                  className="image-name"
                  style={{
                    color: "#2196F3",
                    textDecoration: "none",
                    "&:hover": {
                      textDecoration: "underline",
                    },
                  }}
                >
                  {img.filename.substring(0, 8)}...{img.filename.slice(-12)}
                </span>
                <span
                  style={{
                    marginLeft: "20px",
                    color: "#666",
                    backgroundColor: "#f5f5f5",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  Labeled: {img.label}
                  {img.isCropped && (
                    <span style={{ color: "#4CAF50", marginLeft: 8 }}>
                      (Cropped)
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
        {consistentImages.length > 5 && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => setConsistentPage((prev) => Math.max(1, prev - 1))}
              disabled={consistentPage === 1}
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: consistentPage === 1 ? "#f5f5f5" : "#fff",
                cursor: consistentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              ←
            </button>
            <span>
              {consistentPage} / {Math.ceil(consistentImages.length / 5)}
            </span>
            <button
              onClick={() =>
                setConsistentPage((prev) =>
                  Math.min(Math.ceil(consistentImages.length / 5), prev + 1)
                )
              }
              disabled={
                consistentPage >= Math.ceil(consistentImages.length / 5)
              }
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background:
                  consistentPage >= Math.ceil(consistentImages.length / 5)
                    ? "#f5f5f5"
                    : "#fff",
                cursor:
                  consistentPage >= Math.ceil(consistentImages.length / 5)
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className="image-group-section">
        <h2 className="section-title" style={{ marginBottom: "20px" }}>
          Inconsistent Labeled Images ({inconsistentImages.length})
        </h2>
        <div className="image-list" style={{ marginBottom: "20px" }}>
          {getPageData(inconsistentImages, inconsistentPage).map(
            (img, index) => (
              <div
                key={img._id}
                className="image-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <div
                  onClick={() => handleImageClick(img._id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  <span
                    className="image-number"
                    style={{ marginRight: "10px" }}
                  >
                    {(inconsistentPage - 1) * 5 + index + 1}.
                  </span>
                  <span
                    className="image-name"
                    style={{
                      color: "#2196F3",
                      textDecoration: "none",
                      "&:hover": {
                        textDecoration: "underline",
                      },
                    }}
                  >
                    {img.filename.substring(0, 8)}...{img.filename.slice(-12)}
                  </span>
                  <span
                    style={{
                      marginLeft: "20px",
                      color: "#666",
                      backgroundColor: "#f5f5f5",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  >
                    Labeled: {img.label}
                    {img.isCropped && (
                      <span style={{ color: "#4CAF50", marginLeft: 8 }}>
                        (Cropped)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
        {inconsistentImages.length > 5 && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() =>
                setInconsistentPage((prev) => Math.max(1, prev - 1))
              }
              disabled={inconsistentPage === 1}
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: inconsistentPage === 1 ? "#f5f5f5" : "#fff",
                cursor: inconsistentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              ←
            </button>
            <span>
              {inconsistentPage} / {Math.ceil(inconsistentImages.length / 5)}
            </span>
            <button
              onClick={() =>
                setInconsistentPage((prev) =>
                  Math.min(Math.ceil(inconsistentImages.length / 5), prev + 1)
                )
              }
              disabled={
                inconsistentPage >= Math.ceil(inconsistentImages.length / 5)
              }
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background:
                  inconsistentPage >= Math.ceil(inconsistentImages.length / 5)
                    ? "#f5f5f5"
                    : "#fff",
                cursor:
                  inconsistentPage >= Math.ceil(inconsistentImages.length / 5)
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              →
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            background: currentPage === 1 ? "#f5f5f5" : "#fff",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
          }}
        >
          ←
        </button>
        <span>
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            background: currentPage === totalPages ? "#f5f5f5" : "#fff",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
          }}
        >
          →
        </button>
      </div>
    </div>
  );
};

export default DatasetStats;
