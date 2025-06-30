import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axios";

const DatasetPage = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        console.log("=== DatasetPage Fetch Datasets Debug ===");
        const storedUser = JSON.parse(localStorage.getItem("user"));
        console.log("Stored user:", storedUser);

        if (!storedUser || !storedUser.id) {
          setError("Please login to view dataset list!");
          return;
        }

        console.log("Fetching datasets...");
        const response = await axios.get(
          `/api/dataset?userId=${storedUser.id}`
        );
        console.log("API Response:", response.data);
        setDatasets(response.data);
      } catch (err) {
        console.error("Error fetching datasets:", err);
        setError(err.message || "Unable to load dataset list");
      } finally {
        setLoading(false);
      }
    };
    fetchDatasets();
  }, []);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        flexDirection: "column",
      }}
    >
      <h2
        style={{
          marginBottom: 40,
          fontSize: 32,
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        Dataset List
      </h2>
      {loading ? (
        <div style={{ textAlign: "center", fontSize: 22, width: 600 }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{ color: "red", textAlign: "center", fontSize: 20 }}>
          {error}
        </div>
      ) : datasets.length === 0 ? (
        <div style={{ textAlign: "center", fontSize: 22 }}>
          No datasets yet.
        </div>
      ) : (
        <div style={{ width: 600 }}>
          {datasets.map((ds) => (
            <div
              key={ds._id}
              className="dataset-card-hover"
              style={{
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 6px 20px 0 rgba(0,0,0,0.10)",
                padding: "28px 32px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
              onClick={() => navigate(`/dataset/${ds._id}/stats`)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/dataset/${ds._id}/stats`);
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 6 }}>
                  {ds.name}
                </div>
                <div style={{ color: "#444", fontSize: 16 }}>
                  {ds.images ? ds.images.length : 0} images
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`
        .dataset-card-hover:hover, .dataset-card-hover:focus {
          box-shadow: 0 8px 28px 0 rgba(25, 118, 210, 0.18);
          transform: translateY(-2px) scale(1.02);
          outline: none;
        }
      `}</style>
    </div>
  );
};

export default DatasetPage;
