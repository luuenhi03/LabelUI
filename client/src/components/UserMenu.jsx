import React, { useState, useRef, useEffect } from "react";
import "./UserMenu.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const UserMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const [previewImage, setPreviewImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [avatar, setAvatar] = useState(user.avatar);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsAdmin(response.data.role === "admin");
    } catch (error) {
      console.error("Error checking admin role:", error);
    }
  };

  useEffect(() => {
    setAvatar(user.avatar);
  }, [user.avatar]);

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
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file!");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Image size cannot exceed 5MB!");
        return;
      }

      const imageUrl = URL.createObjectURL(file);
      setPreviewImage({ file, url: imageUrl });
      setShowModal(true);
    }
  };

  const handleChangeAvatarClick = () => {
    fileInputRef.current.value = null;
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

      const token = localStorage.getItem("token");
      const res = await axios.post("/api/auth/upload-avatar", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const updatedUser = { ...user, avatar: res.data.avatarUrl };
      setAvatar(res.data.avatarUrl);
      user.avatar = res.data.avatarUrl;
      setShowModal(false);
      setPreviewImage(null);
      setOpen(false);
      setSuccess("Image updated successfully!");
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (error) {
      setError(
        error.response?.data?.message || "An error occurred. Please try again."
      );
    }
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match!");
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
        setError(data.message || "Current password is incorrect");
        return;
      }

      const otpRes = await fetch("/api/auth/send-otp-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!otpRes.ok) {
        setError("Cannot send OTP. Please try again.");
        return;
      }
      setStep(2);
    } catch (err) {
      setError("An error occurred. Please try again.");
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
        setError(data.message || "Invalid OTP");
        return;
      }
      setSuccess("Password changed successfully!");
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setStep(1);
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setDeleteLoading(true);
    try {
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
        setDeleteError(data.message || "Incorrect password");
        setDeleteLoading(false);
        return;
      }

      const token = localStorage.getItem("token");
      const res = await axios.delete(`/api/auth/delete-account/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        if (onLogout) onLogout();
      } else {
        setDeleteError(res.data.message || "Error deleting account");
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Error deleting account");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleManageUsers = () => {
    setOpen(false);
    navigate("/admin/users");
  };

  return (
    <div className="user-menu-container" ref={menuRef}>
      <div className="avatar" onClick={() => setOpen(!open)}>
        {avatar ? (
          <img
            src={
              avatar.startsWith("http")
                ? avatar
                : `http://localhost:5000${avatar}`
            }
            alt="avatar"
            className="avatar-img"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/default-avatar.png";
            }}
          />
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
          {isAdmin && (
            <div className="user-menu-item" onClick={handleManageUsers}>
              Manage Users
            </div>
          )}
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
            <h3>Change Password</h3>
            {step === 1 ? (
              <>
                <div>
                  <div>Current Password</div>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setError("");
                    }}
                  />
                </div>
                <div>
                  <div>New Password</div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError("");
                    }}
                  />
                </div>
                <div>
                  <div>Confirm New Password</div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                  />
                </div>
                {error && <div className="error-message">{error}</div>}
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
                <div>
                  <div>Enter OTP</div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </div>
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}
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
          <div className="modal-content change-password-modal">
            <h3>Confirm Account Deletion</h3>
            <div>
              <div>Enter password to confirm</div>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            {deleteError && <div className="error-message">{deleteError}</div>}
            <div className="modal-btn-row">
              <button
                className="save-btn"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
