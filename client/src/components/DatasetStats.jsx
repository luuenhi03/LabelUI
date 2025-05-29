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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log("Fetching dataset with ID:", id);
        const res = await axios.get(`/api/dataset/${id}`);
        console.log("Dataset response:", res.data);
        const ds = res.data;
        setDataset(ds);

        // Calculate basic stats
        const totalImages = ds.images ? ds.images.length : 0;
        const labeledImages = ds.images
          ? ds.images.filter((img) => img.label && img.label.trim() !== "")
              .length
          : 0;
        setTotal(totalImages);
        setLabeled(labeledImages);
        setUnlabeled(totalImages - labeledImages);

        // Group images by label consistency
        const consistent = [];
        const inconsistent = [];

        ds.images.forEach((img) => {
          if (!img.labels || img.labels.length === 0) return;

          // Get unique labels
          const uniqueLabels = new Set(img.labels.map((l) => l.label));

          if (uniqueLabels.size === 1) {
            // All labels are the same
            consistent.push(img);
          } else {
            // Multiple different labels
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
        setError("Failed to load dataset stats");
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
      <h1 className="dataset-title">{dataset.name}</h1>
      <div className="stats-box-row">
        <div className="stats-box small">
          <div className="stats-label">Unlabeled images</div>
          <div className="stats-value">{unlabeled}</div>
        </div>
        <div className="stats-box large">
          <div className="stats-label">Total images</div>
          <div className="stats-value">{total}</div>
        </div>
        <div className="stats-box small">
          <div className="stats-label">Labeled images</div>
          <div className="stats-value">{labeled}</div>
        </div>
      </div>

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
                  {Array.from(new Set(img.labels.map((l) => l.label))).join(
                    ", "
                  )}
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
