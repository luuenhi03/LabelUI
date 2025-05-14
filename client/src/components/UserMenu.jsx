import React, { useState, useRef, useEffect } from "react";
import "./UserMenu.css";

const UserMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="user-menu-container" ref={menuRef}>
      <div className="avatar" onClick={() => setOpen(!open)}>
        {user.avatar ? (
          <img src={user.avatar} alt="avatar" className="avatar-img" />
        ) : (
          <i
            className="fa-solid fa-user"
            style={{
              fontSize: 28,
              color: "#888",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          ></i>
        )}
      </div>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-email">
            <b>{user.email}</b>
          </div>
          <div className="user-menu-item">Đổi ảnh</div>
          <div className="user-menu-item">Đổi mật khẩu</div>
          <div className="user-menu-item">Lịch sử</div>
          <div className="user-menu-item">Xóa tài khoản</div>
          <div className="user-menu-item logout" onClick={onLogout}>
            Đăng xuất
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
