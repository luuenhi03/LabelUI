import React, { useState, useRef, useEffect } from "react";
import "./UserMenu.css";
import axios from "axios";

const UserMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();
  const fileInputRef = useRef();
  const [previewImage, setPreviewImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [avatar, setAvatar] = useState(user.avatar);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1); // 1: nhập mật khẩu, 2: nhập OTP
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Update avatar when user prop changes
  useEffect(() => {
    setAvatar(user.avatar);
  }, [user.avatar]);

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

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Kiểm tra xem file có phải là ảnh không
      if (!file.type.startsWith("image/")) {
        alert("Vui lòng chọn file ảnh!");
        return;
      }

      // Kiểm tra kích thước file (giới hạn 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Kích thước ảnh không được vượt quá 5MB!");
        return;
      }

      // Tạo URL để hiển thị ảnh preview
      const imageUrl = URL.createObjectURL(file);
      setPreviewImage({ file, url: imageUrl });
      setShowModal(true);
    }
  };

  const handleChangeAvatarClick = () => {
    fileInputRef.current.value = null; // reset input
    fileInputRef.current.click();
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPreviewImage(null);
  };

  const handleSaveImage = async () => {
    try {
      const formData = new FormData();
      formData.append("avatar", previewImage.file);
      formData.append("email", user.email);

      const res = await fetch("/api/auth/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại sau.");
        return;
      }

      const data = await res.json();
      const updatedUser = { ...user, avatar: data.avatar };
      setAvatar(data.avatar);
      user.avatar = data.avatar;
      setShowModal(false);
      setPreviewImage(null);
      setOpen(false);
      setSuccess("Ảnh đã được cập nhật thành công!");
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (error) {
      setError("Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại sau.");
    }
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới và xác nhận không khớp!");
      return;
    }
    try {
      const res = await fetch("/api/auth/check-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, currentPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Mật khẩu hiện tại không đúng");
        return;
      }
      // Gửi OTP
      const otpRes = await fetch("/api/auth/send-otp-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!otpRes.ok) {
        setError("Không thể gửi OTP. Vui lòng thử lại.");
        return;
      }
      setStep(2);
    } catch (err) {
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, otp, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "OTP không hợp lệ");
        return;
      }
      setSuccess("Đổi mật khẩu thành công!");
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setStep(1);
    } catch (err) {
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setDeleteLoading(true);
    try {
      // Kiểm tra mật khẩu trước khi xóa
      const checkRes = await fetch("/api/auth/check-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          currentPassword: deletePassword,
        }),
      });
      if (!checkRes.ok) {
        const data = await checkRes.json();
        setDeleteError(data.message || "Mật khẩu không đúng");
        setDeleteLoading(false);
        return;
      }
      // Gửi request xóa tài khoản
      const token = localStorage.getItem("token");
      const res = await axios.delete(`/api/auth/delete-account/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        // Xóa localStorage, đăng xuất
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        if (onLogout) onLogout();
      } else {
        setDeleteError(res.data.message || "Lỗi xóa tài khoản");
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Lỗi xóa tài khoản");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="user-menu-container" ref={menuRef}>
      <div className="avatar" onClick={() => setOpen(!open)}>
        {avatar ? (
          <img src={avatar} alt="avatar" className="avatar-img" />
        ) : (
          <img
            src="/default-avatar.png"
            alt="default avatar"
            className="avatar-img"
          />
        )}
      </div>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-email">
            <b>{user.email}</b>
          </div>
          <div className="user-menu-item" onClick={handleChangeAvatarClick}>
            Change avatar
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            style={{ display: "none" }}
          />
          <div
            className="user-menu-item"
            onClick={() => setShowChangePassword(true)}
          >
            Change password
          </div>
          <div
            className="user-menu-item"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete account
          </div>
          <div className="user-menu-item logout" onClick={onLogout}>
            Logout
          </div>
        </div>
      )}
      {showModal && previewImage && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Change avatar</h3>
            <img
              src={previewImage.url}
              alt="preview"
              style={{
                maxWidth: 300,
                maxHeight: 300,
                borderRadius: "50%",
                display: "block",
                margin: "20px auto",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
                marginTop: 24,
              }}
            >
              <button onClick={handleSaveImage} className="save-btn">
                Save
              </button>
              <button onClick={handleModalClose} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showChangePassword && (
        <div className="modal-overlay">
          <div className="modal-content change-password-modal">
            <h3 className="modal-title">Change Password</h3>
            {step === 1 ? (
              <>
                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setError("");
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError("");
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                  />
                </div>
                {error && (
                  <div style={{ color: "red", marginTop: 8 }}>{error}</div>
                )}
                <div className="modal-btn-row">
                  <button onClick={handleChangePassword} className="save-btn">
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setStep(1);
                      setError("");
                      setSuccess("");
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </div>
                {error && (
                  <div style={{ color: "red", marginTop: 8 }}>{error}</div>
                )}
                {success && (
                  <div style={{ color: "green", marginTop: 8 }}>{success}</div>
                )}
                <div className="modal-btn-row">
                  <button onClick={handleVerifyOtp} className="save-btn">
                    Confirm OTP
                  </button>
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setStep(1);
                      setError("");
                      setSuccess("");
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setOtp("");
                    }}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Xác nhận xóa tài khoản</h3>
            <div style={{ margin: "16px 0" }}>
              <input
                type="password"
                placeholder="Nhập mật khẩu để xác nhận"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                }}
              />
            </div>
            {deleteError && (
              <div style={{ color: "red", marginBottom: 8 }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button
                className="save-btn"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
