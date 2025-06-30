import React, { useEffect } from "react";
import TopNavBar from "./TopNavBar";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";

export default function MainLayout({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");
    if (user && token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            navigate("/login");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          navigate("/login");
        });
    }
  }, [navigate]);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6fa" }}>
      <TopNavBar />
      <div
        style={{
          width: "100%",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}
