const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Dataset = require("../models/Dataset");
const Image = require("../models/Image");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const datasetName = req.body.datasetName;
    const uploadPath = path.join(__dirname, "../uploads", datasetName);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Get all datasets
router.get("/datasets", async (req, res) => {
  try {
    const datasets = await Dataset.find().sort({ createdAt: -1 });
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new dataset
router.post("/datasets", async (req, res) => {
  try {
    const { name } = req.body;

    // Check if dataset already exists
    const existingDataset = await Dataset.findOne({ name });
    if (existingDataset) {
      return res.status(400).json({ message: "Dataset already exists" });
    }

    // Create upload directory for the dataset
    const uploadPath = path.join(__dirname, "../uploads", name);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Create dataset in database
    const dataset = new Dataset({ name });
    await dataset.save();

    res.status(201).json(dataset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get images by dataset
router.get("/images/:datasetId", async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.datasetId);
    if (!dataset) {
      return res.status(404).json({ message: "Dataset not found" });
    }

    const images = await Image.find({ dataset: dataset._id, label: "" }).sort({
      createdAt: -1,
    });
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get labeled images by dataset
router.get("/labeled/:datasetId", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 6;
    const skip = page * limit;

    const dataset = await Dataset.findById(req.params.datasetId);
    if (!dataset) {
      return res.status(404).json({ message: "Dataset not found" });
    }

    const [images, total] = await Promise.all([
      Image.find({ dataset: dataset._id, label: { $ne: "" } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Image.countDocuments({ dataset: dataset._id, label: { $ne: "" } }),
    ]);

    res.json({ images, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update image label
router.put("/images/:imageId", async (req, res) => {
  try {
    const { label, labeledBy } = req.body;
    const image = await Image.findByIdAndUpdate(
      req.params.imageId,
      { label, labeledBy },
      { new: true }
    );
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }
    res.json(image);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete image
router.delete("/images/:imageId", async (req, res) => {
  try {
    const image = await Image.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, "..", image.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await Image.findByIdAndDelete(req.params.imageId);
    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload images
router.post("/upload", upload.array("images"), async (req, res) => {
  try {
    const { datasetName } = req.body;

    // Find or create dataset
    let dataset = await Dataset.findOne({ name: datasetName });
    if (!dataset) {
      dataset = new Dataset({ name: datasetName });
      await dataset.save();
    }

    // Save image information to database
    const images = req.files.map((file, i) => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path.replace(/\\/g, "/").replace(/^.*[\\\/]/, "uploads/"),
      dataset: dataset._id,
      label: Array.isArray(req.body.label) ? req.body.label[i] : req.body.label,
      labeledBy: Array.isArray(req.body.labeledBy)
        ? req.body.labeledBy[i]
        : req.body.labeledBy,
      labeledAt: Array.isArray(req.body.labeledAt)
        ? req.body.labeledAt[i]
        : req.body.labeledAt,
      coordinates: Array.isArray(req.body.coordinates)
        ? JSON.parse(req.body.coordinates[i])
        : req.body.coordinates
        ? JSON.parse(req.body.coordinates)
        : null,
      boundingBox: Array.isArray(req.body.boundingBox)
        ? JSON.parse(req.body.boundingBox[i])
        : req.body.boundingBox
        ? JSON.parse(req.body.boundingBox)
        : null,
      isCropped: Array.isArray(req.body.isCropped)
        ? req.body.isCropped[i] === "true"
        : req.body.isCropped === "true",
    }));

    const savedImages = await Image.insertMany(images);
    res.status(201).json(savedImages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get label statistics for an image
router.get("/image/:imageId/label-stats", async (req, res) => {
  try {
    const image = await Image.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Get the latest label for each user
    const latestLabels = {};
    if (image.labels && Array.isArray(image.labels)) {
      image.labels.forEach((label) => {
        const userId = label.labeledBy;
        if (
          !latestLabels[userId] ||
          new Date(label.labeledAt) > new Date(latestLabels[userId].labeledAt)
        ) {
          latestLabels[userId] = label;
        }
      });
    }

    // Count labels
    const labelCounts = {};
    Object.values(latestLabels).forEach((label) => {
      if (label.label) {
        labelCounts[label.label] = (labelCounts[label.label] || 0) + 1;
      }
    });

    // Convert to array format for chart
    const stats = Object.entries(labelCounts).map(([label, count]) => ({
      label,
      count,
    }));

    res.json(stats);
  } catch (error) {
    console.error("Error getting label stats:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
