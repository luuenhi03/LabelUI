import React from "react";
import { Routes, Route, useParams } from "react-router-dom";
import Signup from "./components/Signup";
import Login from "./components/Login";
import Label from "./components/Label";
import ImageUpload from "./components/ImageUpload";
import DatasetStats from "./components/DatasetStats";
import MainLayout from "./components/MainLayout";
import DatasetPage from "./components/DatasetPage";
import CarColorPrediction from "./components/CarColorPrediction";
import UserManagement from "./components/UserManagement";

function App() {
  return (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/upload"
        element={
          <MainLayout>
            <ImageUpload />
          </MainLayout>
        }
      />
      <Route
        path="/dataset"
        element={
          <MainLayout>
            <DatasetPage />
          </MainLayout>
        }
      />
      <Route
        path="/label"
        element={
          <MainLayout>
            <Label />
          </MainLayout>
        }
      />
      <Route
        path="/color-detection"
        element={
          <MainLayout>
            <CarColorPrediction />
          </MainLayout>
        }
      />
      <Route
        path="/admin/users"
        element={
          <MainLayout>
            <UserManagement />
          </MainLayout>
        }
      />
      <Route path="/dataset/:id/stats" element={<DatasetStatsWrapper />} />
      <Route
        path="/*"
        element={
          <MainLayout>
            <Label />
          </MainLayout>
        }
      />
    </Routes>
  );
}

const DatasetStatsWrapper = () => {
  const { id } = useParams();
  return <DatasetStats datasetId={id} />;
};

export default App;
