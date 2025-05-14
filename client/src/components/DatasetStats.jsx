import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#1976d2",
  "#ff9800",
  "#43a047",
  "#d32f2f",
  "#8e24aa",
  "#00bcd4",
];

const crown = "👑";
const warning = "⚠️";

const DatasetStats = ({ datasetId }) => {
  const [stats, setStats] = useState({
    totalImages: 0,
    labeledImages: 0,
    labelDistribution: [],
    userDistribution: [],
    userLabelDistribution: [],
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/api/dataset/${datasetId}/stats`
        );
        setStats(response.data);
      } catch (error) {
        console.error("Error fetching dataset stats:", error);
      }
    };
    if (datasetId) fetchStats();
  }, [datasetId]);

  const maxCount = Math.max(...stats.labelDistribution.map((l) => l.count), 0);
  const minCount = Math.min(
    ...stats.labelDistribution.map((l) => l.count),
    Infinity
  );

  return (
    <div
      className="dataset-stats"
      style={{
        maxWidth: 600,
        margin: "40px auto",
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 2px 16px #0001",
        padding: 32,
      }}
    >
      <button
        className="exit-stats-btn"
        style={{
          marginBottom: 24,
          float: "right",
          background: "#f5f5f5",
          border: "none",
          borderRadius: 6,
          padding: "8px 18px",
          fontWeight: 600,
          cursor: "pointer",
        }}
        onClick={() => navigate("/")}
      >
        Thoát
      </button>
      <h2
        style={{
          textAlign: "center",
          fontSize: 28,
          color: "#1976d2",
          marginBottom: 32,
          letterSpacing: 1,
        }}
      >
        Tổng số ảnh theo từng nhãn
      </h2>
      <div
        className="chart-container"
        style={{
          background: "#f8fafc",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={stats.labelDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              label={{
                value: "Nhãn",
                position: "insideBottom",
                offset: -5,
                fontWeight: 600,
              }}
              style={{ fontWeight: 600 }}
            />
            <YAxis
              label={{
                value: "Số lượng ảnh",
                angle: -90,
                position: "insideLeft",
                fontWeight: 600,
              }}
              style={{ fontWeight: 600 }}
            />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name="Số lượng" radius={[8, 8, 0, 0]}>
              {stats.labelDistribution.map((entry, idx) => (
                <Cell key={entry.label} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {stats.labelDistribution.length > 0 && (
        <div
          style={{
            background: "#f5f7fa",
            borderRadius: 10,
            padding: 20,
            marginTop: 8,
            fontSize: 16,
            boxShadow: "0 1px 4px #0001",
          }}
        >
          <b style={{ fontSize: 17 }}>Nhận xét nhanh:</b>
          <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 22 }}>
            {stats.labelDistribution.map((item, idx) => (
              <li
                key={item.label}
                style={{
                  fontWeight:
                    item.count === maxCount
                      ? "bold"
                      : item.count === minCount
                      ? "bold"
                      : "normal",
                  color:
                    item.count === maxCount
                      ? "#1976d2"
                      : item.count === minCount
                      ? "#d32f2f"
                      : "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {item.count === maxCount && <span>{crown}</span>}
                {item.count === minCount && <span>{warning}</span>}
                Nhãn <b>{item.label}</b> có <b>{item.count}</b> ảnh
                {item.count === maxCount
                  ? " (nhiều nhất)"
                  : item.count === minCount
                  ? " (ít nhất)"
                  : ""}
                .
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DatasetStats;
