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
            // User không tồn tại hoặc token hết hạn
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            navigate("/login");
          }
        })
        .catch(() => {
          // Lỗi kết nối hoặc backend, cũng đăng xuất
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
          maxWidth: 1200,
          margin: "0 auto",
          paddingTop: 24,
          padding: "24px",
        }}
      >
        {children}
      </div>
    </div>
  );
}
