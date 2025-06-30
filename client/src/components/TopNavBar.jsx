import { Link } from "react-router-dom";
import UserMenu from "./UserMenu";
import "./TopNavBar.scss";
import { useState, useEffect } from "react";
import axios from "../utils/axios";

export default function TopNavBar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const storedUser = JSON.parse(localStorage.getItem("user")) || {
    email: "user@gmail.com",
    avatar: null,
  };

  useEffect(() => {
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    try {
      console.log("Checking admin role...");
      const response = await axios.get("/api/auth/me");
      console.log("User data:", response.data);
      const isUserAdmin = response.data.role === "admin";
      console.log("Is admin?", isUserAdmin);
      setIsAdmin(isUserAdmin);
    } catch (error) {
      console.error("Error checking admin role:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <nav className="top-navbar">
      <div className="logo">ColorVision</div>
      <div className="menu">
        <Link to="/upload">Upload image</Link>
        <Link to="/dataset">Dataset</Link>
        <Link to="/label">Label</Link>
        <Link to="/color-detection">Predict</Link>
      </div>
      <div className="profile">
        <UserMenu user={storedUser} onLogout={handleLogout} />
      </div>
    </nav>
  );
}
