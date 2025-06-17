import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./Login.scss";
import "@fortawesome/fontawesome-free/css/all.min.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
    if (location.state?.password) {
      setPassword(location.state.password);
    }
  }, [location.state]);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setError("Please enter all required information!");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          email,
          password,
        }
      );

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      navigate("/");
    } catch (error) {
      const message = error.response?.data?.message || "Login failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, navigate]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleLogin();
      }
    },
    [handleLogin]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="login-container">
      <h1
        className="title"
        style={{ color: "#5f2ded", textAlign: "center", marginBottom: 24 }}
      >
        Login
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <div className="input-icon">
          <i className="fa-solid fa-envelope"></i>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setError("")}
            disabled={isLoading}
            autoComplete="email"
          />
        </div>
        <div className="input-icon">
          <i className="fa-solid fa-key"></i>
          <input
            type={isShowPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setError("")}
            disabled={isLoading}
            autoComplete="current-password"
          />
          <i
            className={`fas ${
              isShowPassword ? "fa-eye-slash" : "fa-eye"
            } eye-toggle`}
            onClick={() => setIsShowPassword(!isShowPassword)}
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <button
          type="submit"
          className={email && password ? "active" : ""}
          disabled={!email || !password || isLoading}
          style={{
            margin: "18px 0 0 0",
            fontWeight: 500,
            fontSize: 17,
            borderRadius: 10,
            boxShadow: "0 2px 8px rgba(95,42,237,0.08)",
          }}
        >
          {isLoading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: 18,
          fontSize: 16,
        }}
      >
        <span style={{ color: "#222", marginRight: 8 }}>
          Do not have an account?
        </span>
        <span
          style={{ color: "#5f2ded", fontWeight: 500, cursor: "pointer" }}
          onClick={() => navigate("/signup")}
        >
          Register here
        </span>
      </div>
    </div>
  );
};

export default Login;
