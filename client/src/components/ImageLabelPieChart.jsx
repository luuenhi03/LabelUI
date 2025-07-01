import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#0088FE", "#FFBB28", "#00C49F", "#FF8042", "#8884D8"];

const ImageLabelPieChart = ({
  imageId,
  datasetId,
  showNoStatsMessage = true,
}) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!datasetId || !imageId) return;
    fetch(
      `http://localhost:5000/api/dataset/${datasetId}/images/${imageId}/label-stats`
    )
      .then((res) => res.json())
      .then((stats) => {
        if (!Array.isArray(stats)) {
          console.error("Stats is not an array:", stats);
          setData([]);
          return;
        }

        fetch(
          `http://localhost:5000/api/dataset/${datasetId}/images/${imageId}`
        )
          .then((res) => res.json())
          .then((imageData) => {
            let updatedStats = [...stats];
            if (imageData.isCropped) {
              updatedStats.push({ label: "Cropped", count: 1 });
            }

            const total = updatedStats.reduce(
              (sum, item) => sum + item.count,
              0
            );

            const dataWithPercentage = updatedStats.map((item) => ({
              ...item,
              percentage: ((item.count / total) * 100).toFixed(1),
            }));
            setData(dataWithPercentage);
          })
          .catch((error) => {
            console.error("Error fetching image data:", error);
            const total = stats.reduce((sum, item) => sum + item.count, 0);
            const dataWithPercentage = stats.map((item) => ({
              ...item,
              percentage: ((item.count / total) * 100).toFixed(1),
            }));
            setData(dataWithPercentage);
          });
      })
      .catch((error) => {
        console.error("Error fetching label stats:", error);
        setData([]);
      });
  }, [datasetId, imageId]);

  if (!data.length && showNoStatsMessage)
    return <div>No statistics available</div>;
  if (!data.length) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PieChart width={320} height={180}>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx={90}
          cy={90}
          outerRadius={70}
          label={({ percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
            const RADIAN = Math.PI / 180;
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);
            return `${percent}%`;
          }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Legend />
      </PieChart>
    </div>
  );
};

export default ImageLabelPieChart;
