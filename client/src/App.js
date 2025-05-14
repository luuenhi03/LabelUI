import React from "react";
import { Routes, Route, useParams } from "react-router-dom";
import Signup from "./components/Signup";
import Login from "./components/Login";
import Label from "./components/Label";
import ImageUpload from "./components/ImageUpload";
import DatasetStats from "./components/DatasetStats";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Label uploadComponent={<ImageUpload />} />} />
        <Route path="/dataset/:id/stats" element={<DatasetStatsWrapper />} />
      </Routes>
    </div>
  );
}

// Wrapper để lấy id từ params và truyền vào DatasetStats
function DatasetStatsWrapper() {
  const { id } = useParams();
  return <DatasetStats datasetId={id} />;
}

export default App;
