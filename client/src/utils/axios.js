import axios from "axios";

const instance = axios.create({
  baseURL: "http://localhost:5000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server trả về response với status code nằm ngoài 2xx
      return Promise.reject(error.response.data);
    } else if (error.request) {
      // Request được gửi nhưng không nhận được response
      return Promise.reject({
        message: "Unable to connect to server. Please check your connection!",
      });
    } else {
      // Có lỗi khi setting up request
      return Promise.reject({
        message: "An error occurred. Please try again!",
      });
    }
  }
);

export default instance;
