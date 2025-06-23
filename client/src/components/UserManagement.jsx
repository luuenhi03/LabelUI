import React, { useState, useEffect } from "react";
import axios from "../utils/axios";
import "./UserManagement.scss";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get("/api/admin/users");
      setUsers(response.data);
      setLoading(false);
    } catch (error) {
      setError(
        "Unable to load users list. Please make sure you have admin privileges."
      );
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await axios.delete(`/api/admin/users/${userId}`);

      setUsers(users.filter((user) => user._id !== userId));
    } catch (error) {
      setError(
        "Unable to delete user. Please make sure you have admin privileges."
      );
    }
  };

  if (loading) {
    return <div className="user-management loading">Loading...</div>;
  }

  if (error) {
    return <div className="user-management error">{error}</div>;
  }

  return (
    <div className="user-management">
      <h2>User Management</h2>
      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td>
                  <img
                    src={user.avatar || "/default-avatar.png"}
                    alt="avatar"
                    className="user-avatar"
                  />
                </td>
                <td>{user.email}</td>
                <td>{user.role === "admin" ? "Administrator" : "User"}</td>
                <td>{user.isVerified ? "Verified" : "Not Verified"}</td>
                <td>{new Date(user.createdAt).toLocaleDateString("en-US")}</td>
                <td>
                  {user.role !== "admin" && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteUser(user._id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
