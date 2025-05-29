import { Link } from "react-router-dom";
import UserMenu from "./UserMenu";
import "./TopNavBar.scss";

export default function TopNavBar() {
  // Lấy user từ localStorage
  const storedUser = JSON.parse(localStorage.getItem("user")) || {
    email: "user@gmail.com",
    avatar: null,
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
        <Link to="/modelling">Modelling</Link>
      </div>
      <div className="profile">
        <UserMenu user={storedUser} onLogout={handleLogout} />
      </div>
    </nav>
  );
}
