import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Signup.scss";
import "@fortawesome/fontawesome-free/css/all.min.css";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [showOtpSection, setShowOtpSection] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const startTimer = useCallback(() => {
    setTimer(60);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email!");
      return;
    }

    if (!password) {
      setError("Please enter your password!");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Invalid email format!");
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters!");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/send-otp-register",
        {
          email,
        }
      );

      if (response.data.message) {
        setShowOtpSection(true);
        startTimer();
      } else {
        setError(
          response.data.message || "Failed to send OTP. Please try again!"
        );
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      if (error.response) {
        setError(
          error.response.data.message || "Failed to send OTP. Please try again!"
        );
      } else if (error.request) {
        setError("Unable to connect to server. Please check your connection!");
      } else {
        setError("An error occurred. Please try again!");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) {
      setError(`Please wait ${timer} seconds to resend OTP`);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/send-otp-register",
        {
          email,
        }
      );

      if (response.data.message) {
        startTimer();
      } else {
        setError(
          response.data.message || "Failed to resend OTP. Please try again!"
        );
      }
    } catch (error) {
      console.error("Error resending OTP:", error);
      setError(
        error.response?.data?.message ||
          "Failed to resend OTP. Please try again!"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError("Please enter OTP!");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/verify-otp-register",
        {
          email,
          password,
          otp,
        }
      );

      if (response.data.message) {
        navigate("/login", { state: { email, password } });
      } else {
        setError(response.data.message || "Invalid OTP!");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setError(error.response?.data?.message || "Invalid OTP!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && showOtpSection && otp && !isLoading) {
        handleVerifyOTP();
      }
    },
    [showOtpSection, otp, isLoading, handleVerifyOTP]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="signup-container">
      <h1
        className="title"
        style={{ color: "#5f2ded", textAlign: "center", marginBottom: 24 }}
      >
        Sign up
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="input-icon">
          <i className="fa-solid fa-envelope"></i>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            disabled={isLoading}
            autoComplete="new-password"
            onFocus={() => setError("")}
          />
          <i
            className={`fas ${
              isShowPassword ? "fa-eye-slash" : "fa-eye"
            } eye-toggle`}
            onClick={() => setIsShowPassword(!isShowPassword)}
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        {!showOtpSection ? (
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
            {isLoading ? "Sending..." : "Sign up"}
          </button>
        ) : (
          <>
            <div className="input-icon">
              <i className="fa-solid fa-shield-halved"></i>
              <input
                type="text"
                maxLength="6"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                disabled={isLoading}
                autoComplete="one-time-code"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && otp && !isLoading) {
                    e.preventDefault();
                    handleVerifyOTP();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className={otp ? "active" : ""}
              onClick={handleVerifyOTP}
              disabled={!otp || isLoading}
            >
              {isLoading ? "Verifying..." : "Verify OTP"}
            </button>
            <div
              className="text"
              style={{ textAlign: "center", marginTop: "10px" }}
            >
              {timer > 0 ? (
                `Resend OTP in ${timer}s`
              ) : (
                <span
                  onClick={handleResendOTP}
                  style={{ color: "#3498db", cursor: "pointer" }}
                >
                  Resend OTP
                </span>
              )}
            </div>
          </>
        )}
      </form>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: 18,
          fontSize: 16,
          cursor: "pointer",
          color: "#5f2ded",
          fontWeight: 500,
          gap: 8,
        }}
        onClick={() => navigate("/login")}
      >
        <i className="fa-solid fa-arrow-left"></i>
        <span>Go back</span>
      </div>
    </div>
  );
};

export default Signup;
