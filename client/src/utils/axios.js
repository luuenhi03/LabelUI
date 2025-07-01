import axios from "axios";

const API_URL =
  process.env.NODE_ENV === "production"
    ? process.env.REACT_APP_API_URL
    : "http://localhost:5000";

const instance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    console.log("Token:", token);
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
      console.log("Authorization header:", config.headers["Authorization"]);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Xóa token cũ
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Chuyển hướng về trang đăng nhập
      const currentPath = window.location.pathname;
      if (!currentPath.includes("/login") && !currentPath.includes("/signup")) {
        window.location.href = "/login";
      }

      return Promise.reject(error);
    }

    if (error.response) {
      if (error.response.data) {
        return Promise.reject(error.response.data);
      }
    } else if (error.request) {
      return Promise.reject({
        message: "Không thể kết nối đến server",
        silent: true,
      });
    }

    return Promise.reject({
      message: "Đã có lỗi xảy ra",
      silent: true,
    });
  }
);

export default instance;
