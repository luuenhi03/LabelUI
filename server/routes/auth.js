const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const Otp = require("../models/Otp");
const multer = require("multer");
const upload = multer({ dest: "public/avatars/" });
const authMiddleware = require("../middleware/auth");

const checkDatabaseConnection = () => {
  return mongoose.connection.readyState === 1;
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  debug: true,
  logger: true,
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("Lỗi cấu hình email:", {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
      stack: error.stack,
    });
  } else {
    console.log("Server email đã sẵn sàng gửi tin nhắn");
  }
});

async function sendOtpMail(to, otp) {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: to,
    subject: "Your OTP code",
    text: `Your OTP is: ${otp}`,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email gửi thành công:", info.response);
    return info;
  } catch (error) {
    console.error("Chi tiết lỗi gửi email:", {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
      stack: error.stack,
    });
    throw error;
  }
}

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

router.post("/send-otp", async (req, res) => {
  try {
    if (!checkDatabaseConnection()) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email là bắt buộc" });

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email },
      { code: otp, expiry: otpExpiry },
      { upsert: true, new: true }
    );

    try {
      await sendOtpMail(email, otp);
      console.log("OTP email sent successfully");
    } catch (emailError) {
      console.error("Detailed OTP email error:", {
        message: emailError.message,
        stack: emailError.stack,
        code: emailError.code,
        command: emailError.command,
        responseCode: emailError.responseCode,
        response: emailError.response,
      });
      return res.status(500).json({
        message: "Không thể gửi email OTP",
        error: emailError.message,
        details: {
          code: emailError.code,
          command: emailError.command,
          responseCode: emailError.responseCode,
        },
      });
    }

    res.status(200).json({ message: "OTP đã được gửi" });
  } catch (error) {
    console.error("Unexpected Error in send-otp:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(500).json({
      message: "Lỗi gửi OTP",
      error: error.message,
      details: {
        code: error.code,
        stack: error.stack,
      },
    });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const otpRecord = await Otp.findOne({ email, code: otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP không đúng" });
    }
    if (otpRecord.expiry < new Date()) {
      return res.status(400).json({ message: "OTP đã hết hạn" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Lỗi xác thực OTP" });
  }
});

router.post("/verify-otp-register", async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    const otpRecord = await Otp.findOne({ email, code: otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP không đúng" });
    }
    if (otpRecord.expiry < new Date()) {
      return res.status(400).json({ message: "OTP đã hết hạn" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã được đăng ký" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      password: hashedPassword,
      isVerified: true,
    });
    await user.save();

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: "Đăng ký thành công" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Lỗi xác thực OTP" });
  }
});

router.post("/send-otp-register", async (req, res) => {
  try {
    if (!checkDatabaseConnection()) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email là bắt buộc" });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã được đăng ký" });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email },
      { code: otp, expiry: otpExpiry },
      { upsert: true, new: true }
    );

    try {
      await sendOtpMail(email, otp);
      console.log("OTP email sent successfully (register)");
    } catch (emailError) {
      return res.status(500).json({
        message: "Không thể gửi email OTP",
        error: emailError.message,
      });
    }

    res.status(200).json({ message: "OTP đã được gửi" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi gửi OTP", error: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email chưa được đăng ký" });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ message: "Tài khoản chưa được xác thực" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu không đúng" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      "hQJ2•••••••••••••••••", // Thay thế bằng secret key thực tế
      { expiresIn: "1d" }
    );

    // Send response
    res.status(200).json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Lỗi đăng nhập" });
  }
});

router.post("/check-password", async (req, res) => {
  const { email, currentPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch)
    return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
  res.json({ success: true });
});

router.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  console.log("Upload avatar called", req.body, req.file);
  try {
    const { email } = req.body;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const avatarUrl = `/avatars/${req.file.filename}`;
    const user = await User.findOneAndUpdate(
      { email },
      { avatar: avatarUrl },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Avatar updated", avatar: avatarUrl });
  } catch (error) {
    res.status(500).json({ message: "Upload error", error: error.message });
  }
});

router.delete("/delete-account/:id", authMiddleware, async (req, res) => {
  const userIdToDelete = req.params.id;
  if (req.user._id !== userIdToDelete) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    await User.findByIdAndDelete(userIdToDelete);
    res.status(200).json({ message: "Tài khoản đã được xóa" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi xóa tài khoản", error: err.message });
  }
});

module.exports = router;
