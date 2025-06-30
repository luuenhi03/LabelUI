require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const { createDefaultAdmin } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const datasetRoutes = require("./routes/dataset");
const adminRoutes = require("./routes/admin");
const Grid = require("gridfs-stream");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({
  server,
  path: "/ws",
});

wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");

  ws.on("message", (message) => {
    console.log("Received:", message.toString());
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.send(
    JSON.stringify({
      type: "connection",
      message: "Connected to WebSocket server",
    })
  );
});

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5000"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/avatars", express.static(path.join(__dirname, "public/avatars")));

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/label_db";
console.log("Connecting to MongoDB:", MONGODB_URI);

let gfs;
const conn = mongoose.connection;

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("Successfully connected to MongoDB and initialized GridFS");

  createDefaultAdmin();
});

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/dataset", datasetRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/dataset/image/:fileId", async (req, res) => {
  try {
    console.log("Attempting to serve image with fileId:", req.params.fileId);

    if (!mongoose.Types.ObjectId.isValid(req.params.fileId)) {
      console.error("Invalid fileId format:", req.params.fileId);
      return res.status(400).json({ message: "Invalid fileId format" });
    }

    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    console.log("Looking for file with ID:", fileId);

    const file = await gfs.files.findOne({ _id: fileId });
    console.log("Found file:", file);

    if (!file) {
      console.error("File not found in GridFS");
      return res.status(404).json({ message: "File not found in GridFS" });
    }

    if (!file.contentType || !file.contentType.startsWith("image/")) {
      console.error("File is not an image:", file.contentType);
      return res.status(400).json({ message: "File is not an image" });
    }

    const readstream = gfs.createReadStream(file._id);
    readstream.on("error", (error) => {
      console.error("Error reading file stream:", error);
      res.status(500).json({ message: "Error reading file" });
    });

    res.set("Content-Type", file.contentType);
    readstream.pipe(res);
  } catch (error) {
    console.error("Error serving image:", error);
    res
      .status(500)
      .json({ message: "Error serving image", error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Global Error Handler:", {
    message: err.message,
    stack: err.stack,
    name: err.name,
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.name === "MongoError" && err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "Duplicate key error",
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Main server is running on port ${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}/ws`);
});

module.exports = { gfs };
