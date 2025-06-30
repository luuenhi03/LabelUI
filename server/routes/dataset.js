const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Dataset = require("../models/Dataset");
const fs = require("fs");
const mongoose = require("mongoose");
const getGFS = require("../gridfs");
const { GridFsStorage } = require("multer-gridfs-storage");
const crypto = require("crypto");
const User = require("../models/User");
const Image = require("../models/Image");
const jwt = require("jsonwebtoken");

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authentication token is required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || "mongodb://localhost:27017/label_db",
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
          metadata: {
            datasetId: req.params.id,
            originalName: file.originalname,
            uploadDate: new Date(),
          },
        };
        resolve(fileInfo);
      });
    });
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return cb(new Error("Only image files are accepted!"), false);
    }
    cb(null, true);
  },
});

const checkDatasetExists = async (req, res, next) => {
  try {
    console.log("=== Dataset Check Debug ===");
    console.log("Request params:", req.params);
    console.log("Request path:", req.path);
    console.log("Request method:", req.method);

    if (!req.params.id) {
      console.log("No dataset ID provided");
      return res.status(400).json({
        message: "Dataset ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("Invalid dataset ID format:", req.params.id);
      return res.status(400).json({
        message: "Invalid dataset ID format",
      });
    }

    console.log("Checking dataset with ID:", req.params.id);
    const dataset = await Dataset.findById(req.params.id);

    if (!dataset) {
      console.log("Dataset not found with ID:", req.params.id);
      return res.status(404).json({
        message: "Dataset not found",
        details: `Dataset with ID ${req.params.id} does not exist`,
      });
    }

    console.log("Dataset found:", {
      id: dataset._id,
      name: dataset.name,
      imageCount: dataset.images?.length || 0,
    });

    req.dataset = dataset;
    next();
  } catch (error) {
    console.error("Error checking dataset:", error);
    res.status(500).json({
      message: "Error checking dataset",
      error: error.message,
    });
  }
};

const checkMongoConnection = async (req, res, next) => {
  try {
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      return res.status(500).json({
        status: "error",
        message: "MongoDB is not connected",
        connectionState: dbState,
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database connection error",
      error: error.message,
    });
  }
};

router.get("/test-db", checkMongoConnection, async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    console.log("MongoDB ping successful");

    const datasetCount = await Dataset.countDocuments();
    console.log("Total datasets:", datasetCount);

    res.json({
      status: "success",
      connection: {
        state: mongoose.connection.readyState,
        meaning: {
          0: "disconnected",
          1: "connected",
          2: "connecting",
          3: "disconnecting",
        }[mongoose.connection.readyState],
      },
      datasets: {
        count: datasetCount,
      },
    });
  } catch (error) {
    console.error("Database test failed:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
      connection: {
        state: mongoose.connection.readyState,
      },
    });
  }
});

router.get("/test-connection", checkMongoConnection, async (req, res) => {
  try {
    const datasetCount = await Dataset.countDocuments();
    console.log("Total datasets:", datasetCount);

    const testDataset = new Dataset({
      name: "test_dataset_" + Date.now(),
      images: [],
    });
    await testDataset.save();
    console.log("Test dataset created:", testDataset._id.toString());

    const updateResult = await Dataset.findByIdAndUpdate(
      testDataset._id,
      {
        $push: {
          images: {
            filename: "test.jpg",
            _id: new mongoose.Types.ObjectId(),
          },
        },
      },
      { new: true }
    );
    console.log("Test dataset updated:", updateResult._id.toString());

    const deleteResult = await Dataset.findByIdAndDelete(testDataset._id);
    console.log("Test dataset deleted:", deleteResult._id.toString());

    res.json({
      status: "success",
      message: "MongoDB connection test successful",
      details: {
        connectionState: mongoose.connection.readyState,
        totalDatasets: datasetCount,
        testOperations: "All passed",
        testDatasetId: testDataset._id.toString(),
      },
    });
  } catch (error) {
    console.error("MongoDB connection test failed:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
      details: {
        connectionState: mongoose.connection.readyState,
        errorType: error.name,
      },
    });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get userId from token
    let query = {
      $or: [{ isPrivate: false }, { userId: userId }],
    };

    const datasets = await Dataset.find(query);
    console.log("Found datasets:", datasets.length);
    console.log(
      "Datasets:",
      datasets.map((d) => ({ id: d._id, name: d.name }))
    );

    res.json(datasets);
  } catch (error) {
    console.error("Error fetching datasets:", error);
    res.status(500).json({ message: "Error fetching datasets" });
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("=== Create Dataset Debug ===");
    console.log("Request body:", {
      name: req.body.name,
      userId: req.body.userId,
      isPrivate: req.body.isPrivate,
    });

    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ message: "Dataset name cannot be empty" });
    }

    const existingDataset = await Dataset.findOne({
      name: req.body.name.trim(),
    });
    if (existingDataset) {
      return res
        .status(400)
        .json({ message: `Dataset "${req.body.name}" already exists` });
    }

    if (!req.body.userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    const newDataset = new Dataset({
      name: req.body.name.trim(),
      userId: new mongoose.Types.ObjectId(req.body.userId),
      isPrivate: req.body.isPrivate || false,
    });

    console.log("Creating new dataset:", {
      name: newDataset.name,
      userId: newDataset.userId.toString(),
      isPrivate: newDataset.isPrivate,
    });

    const savedDataset = await newDataset.save();
    console.log("Dataset created:", {
      id: savedDataset._id,
      name: savedDataset.name,
      userId: savedDataset.userId.toString(),
      isPrivate: savedDataset.isPrivate,
    });

    res.json(savedDataset);
  } catch (error) {
    console.error("Error creating new dataset:", error);
    if (error.code === 11000) {
      res.status(400).json({ message: "Dataset name already exists" });
    } else {
      res.status(500).json({ message: "Error creating new dataset" });
    }
  }
});

router.put("/:id", authenticateToken, checkDatasetExists, async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ message: "Dataset name cannot be empty" });
    }

    const dataset = await Dataset.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name.trim() },
      { new: true }
    );
    res.json(dataset);
  } catch (error) {
    console.error("Error updating dataset:", error);
    res.status(500).json({ message: "Error updating dataset" });
  }
});

router.post(
  "/:id/upload",
  authenticateToken,
  checkDatasetExists,
  upload.array("images"),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files were uploaded" });
      }

      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      dataset.images = dataset.images || [];
      const savedImages = [];

      for (const file of req.files) {
        const imageData = {
          fileId: file.id || file._id,
          url: `/api/dataset/file/${file.id || file._id}`,
          filename: file.filename,
          originalName: file.metadata?.originalName || file.originalname,
          uploadDate: new Date(),
          label: "",
          labeledBy: "",
          labeledAt: null,
        };

        dataset.images.push(imageData);
        savedImages.push(imageData);
      }

      dataset.imageCount = dataset.images.length;
      await dataset.save();

      res.status(200).json({
        message: "Images uploaded successfully",
        uploadedCount: savedImages.length,
        images: savedImages,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({
        message: "Error uploading images",
        error: error.message,
      });
    }
  }
);

router.get(
  "/:id/images",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }
      res.json(dataset.images || []);
    } catch (error) {
      console.error("Error fetching images:", error);
      res.status(500).json({ message: "Error fetching image list" });
    }
  }
);

router.get(
  "/:id/labeled",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 0;
      const limit = 6;
      const skip = page * limit;

      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      const labeledImages = dataset.images.filter(
        (img) => img.label && img.label.trim() !== ""
      );

      labeledImages.sort((a, b) => {
        const dateA = a.labeledAt ? new Date(a.labeledAt) : new Date(0);
        const dateB = b.labeledAt ? new Date(b.labeledAt) : new Date(0);
        return dateB - dateA;
      });

      const paginatedImages = labeledImages.slice(skip, skip + limit);
      const total = labeledImages.length;

      console.log("Labeled images found:", {
        total,
        page,
        limit,
        skip,
        returnedCount: paginatedImages.length,
      });

      res.json({
        images: paginatedImages,
        total,
      });
    } catch (error) {
      console.error("Error fetching labeled images:", error);
      res.status(500).json({ message: "Error fetching labeled image list" });
    }
  }
);

router.put(
  "/:id/images/:imageId",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      const { label, labeledBy, boundingBox } = req.body;
      if (label === undefined || label === null) {
        return res.status(400).json({ message: "Label is required" });
      }

      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      const image = dataset.images.find(
        (img) => img._id.toString() === req.params.imageId
      );
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      image.label = label.trim();
      image.labeledBy = labeledBy || "";
      image.labeledAt = new Date();
      if (boundingBox) {
        image.boundingBox = boundingBox;
      }

      if (!image.labels) {
        image.labels = [];
      }

      image.labels.push({
        label: label.trim(),
        labeledBy: labeledBy || "",
        labeledAt: new Date(),
      });

      await dataset.save();
      console.log("Label saved successfully:", {
        imageId: image._id,
        label: image.label,
        labeledBy: image.labeledBy,
        labeledAt: image.labeledAt,
        labelsCount: image.labels.length,
      });

      res.json(image);
    } catch (error) {
      console.error("Error updating image label:", error);
      res.status(500).json({ message: "Error updating label" });
    }
  }
);

router.get("/:id/check", authenticateToken, async (req, res) => {
  try {
    console.log("=== Dataset Check Debug ===");
    console.log("Checking dataset ID:", req.params.id);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("Invalid dataset ID format:", req.params.id);
      return res.status(400).json({
        message: "Invalid dataset ID format",
        id: req.params.id,
      });
    }

    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      console.log("Dataset not found with ID:", req.params.id);
      return res.status(404).json({
        message: "Dataset not found",
        id: req.params.id,
      });
    }

    console.log("Dataset found:", {
      id: dataset._id,
      name: dataset.name,
      imageCount: dataset.images?.length || 0,
    });

    res.json({
      exists: true,
      dataset: {
        id: dataset._id,
        name: dataset.name,
        imageCount: dataset.images?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error checking dataset:", error);
    res.status(500).json({
      message: "Error checking dataset",
      error: error.message,
    });
  }
});

router.get(
  "/:id/export",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      console.log("=== CSV Export Debug ===");
      console.log("Export request for dataset ID:", req.params.id);

      const dataset = req.dataset;
      console.log("Dataset found:", {
        id: dataset._id,
        name: dataset.name,
        imageCount: dataset.images?.length || 0,
      });

      const csvRows = ["imageUrl,label,labeledBy,labeledAt,boundingBox"];

      if (dataset.images && dataset.images.length > 0) {
        dataset.images
          .filter((img) => img.label)
          .forEach((img) => {
            const escapeCsv = (str) => {
              if (str === null || str === undefined) return "";
              str = String(str);
              if (
                str.includes(",") ||
                str.includes('"') ||
                str.includes("\n")
              ) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            };

            let boundingBoxStr = "";
            if (img.boundingBox) {
              if (
                typeof img.boundingBox.x !== "undefined" &&
                typeof img.boundingBox.y !== "undefined" &&
                typeof img.boundingBox.width !== "undefined" &&
                typeof img.boundingBox.height !== "undefined"
              ) {
                boundingBoxStr = `${img.boundingBox.x},${img.boundingBox.y},${img.boundingBox.width},${img.boundingBox.height}`;
              } else if (
                img.boundingBox.topLeft &&
                img.boundingBox.bottomRight
              ) {
                boundingBoxStr = `${img.boundingBox.topLeft.x},${img.boundingBox.topLeft.y},${img.boundingBox.bottomRight.x},${img.boundingBox.bottomRight.y}`;
              }
            }

            let imageUrl = "";
            if (img.url) {
              imageUrl = `http://localhost:5000${img.url}`;
            } else if (img.fileId) {
              imageUrl = `http://localhost:5000/api/dataset/${img.fileId}`;
            }

            const row = [
              escapeCsv(imageUrl),
              escapeCsv(img.label || ""),
              escapeCsv(img.labeledBy || ""),
              escapeCsv(img.labeledAt || ""),
              escapeCsv(boundingBoxStr),
            ].join(",");

            csvRows.push(row);
          });
      }

      const csvContent = csvRows.join("\n");
      console.log("CSV content generated, length:", csvContent.length);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${dataset.name}_labeled_images.csv`
      );
      res.setHeader("Content-Length", Buffer.byteLength(csvContent, "utf-8"));

      console.log("Sending CSV response");
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Error exporting CSV" });
    }
  }
);

router.delete(
  "/:id/images/:imageId",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      const imageIndex = dataset.images.findIndex(
        (img) => img._id.toString() === req.params.imageId
      );

      if (imageIndex === -1) {
        return res.status(404).json({ message: "Image not found in dataset" });
      }

      dataset.images.splice(imageIndex, 1);

      await dataset.save();

      res.json({
        message: "Image deleted successfully from dataset",
        datasetId: req.params.id,
        imageId: req.params.imageId,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error deleting image",
        error: error.message,
      });
    }
  }
);

router.delete("/reset", async (req, res) => {
  try {
    await Dataset.deleteMany({});
    res.json({ message: "All datasets deleted" });
  } catch (error) {
    console.error("Error resetting datasets:", error);
    res.status(500).json({ message: "Error deleting datasets" });
  }
});

router.get("/file/:fileId", checkMongoConnection, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "uploads",
    });

    const fileId = new mongoose.Types.ObjectId(req.params.fileId);

    const files = await db
      .collection("uploads.files")
      .find({ _id: fileId })
      .toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.set("Content-Type", files[0].contentType || "application/octet-stream");
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching image", error: err.message });
  }
});

router.get(
  "/:id/images/:imageId/label-stats",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }
      const image = dataset.images.find(
        (img) => img._id.toString() === req.params.imageId
      );
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }
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
      const labelCounts = {};
      Object.values(latestLabels).forEach((label) => {
        if (label.label) {
          labelCounts[label.label] = (labelCounts[label.label] || 0) + 1;
        }
      });
      const stats = Object.entries(labelCounts).map(([label, count]) => ({
        label,
        count,
      }));
      res.json(stats);
    } catch (error) {
      console.error("Error getting label stats:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

router.get("/:id/stats", authenticateToken, async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: "Dataset not found" });
    }

    const total = dataset.images.length;
    const unlabeled = dataset.images.filter(
      (img) => !img.label || img.label.trim() === ""
    ).length;
    const labeled = total - unlabeled;

    res.json({
      total,
      labeled,
      unlabeled,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching dataset stats", error: error.message });
  }
});

router.get(
  "/:id",
  authenticateToken,
  checkMongoConnection,
  async (req, res) => {
    try {
      console.log("=== Get Dataset by ID Debug ===");
      console.log("Request params:", req.params);
      console.log("Request query:", req.query);
      console.log("Request headers:", req.headers);

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        console.log("Invalid dataset ID format:", req.params.id);
        return res.status(400).json({
          message: "Invalid dataset ID format",
        });
      }

      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        console.log("Dataset not found with ID:", req.params.id);
        return res.status(404).json({
          message: "Dataset not found",
        });
      }

      console.log("Dataset found:", {
        id: dataset._id,
        name: dataset.name,
        isPrivate: dataset.isPrivate,
        userId: dataset.userId ? dataset.userId.toString() : null,
        imageCount: dataset.images?.length || 0,
      });

      const requestUserId = req.user.userId;

      console.log("Access check:", {
        isPrivate: dataset.isPrivate,
        datasetUserId: dataset.userId ? dataset.userId.toString() : null,
        requestUserId: requestUserId ? requestUserId.toString() : null,
      });

      if (dataset.isPrivate) {
        const datasetUserId = dataset.userId ? dataset.userId.toString() : null;
        const userIdToCheck = requestUserId ? requestUserId.toString() : null;

        if (
          !datasetUserId ||
          !userIdToCheck ||
          datasetUserId !== userIdToCheck
        ) {
          console.log("Access denied: userId mismatch", {
            datasetUserId,
            userIdToCheck,
          });
          return res.status(403).json({
            message: "You don't have permission to access this dataset",
          });
        }
        console.log("Access granted: userId match");
      } else {
        console.log("Access granted: public dataset");
      }

      res.json(dataset);
    } catch (error) {
      console.error("Error fetching dataset:", error);
      res.status(500).json({
        message: "Error fetching dataset",
        error: error.message,
      });
    }
  }
);

router.delete(
  "/:id/images/:imageId/label",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      let userEmail = null;
      if (req.user && req.user.email) {
        userEmail = req.user.email;
      } else if (req.body && req.body.email) {
        userEmail = req.body.email;
      } else if (req.query && req.query.email) {
        userEmail = req.query.email;
      }
      if (!userEmail)
        return res.status(400).json({ message: "User email required" });

      const dataset = await Dataset.findById(req.params.id);
      if (!dataset)
        return res.status(404).json({ message: "Dataset not found" });

      const image = dataset.images.find(
        (img) => img._id.toString() === req.params.imageId
      );
      if (!image) return res.status(404).json({ message: "Image not found" });

      image.labels = (image.labels || []).filter(
        (label) => label.labeledBy !== userEmail
      );

      if (image.labeledBy === userEmail) {
        image.label = "";
        image.labeledBy = "";
        image.labeledAt = null;
      }

      await dataset.save();
      res.json({ message: "User label deleted for this image" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error deleting user label", error: error.message });
    }
  }
);

router.get(
  "/:id/images/:imageId",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      const image = dataset.images.find(
        (img) => img._id.toString() === req.params.imageId
      );
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      res.json({
        _id: image._id,
        fileId: image.fileId,
        filename: image.filename,
        label: image.label,
        labeledBy: image.labeledBy,
        labeledAt: image.labeledAt,
        isCropped: image.isCropped || false,
        boundingBox: image.boundingBox,
        url: image.url,
      });
    } catch (error) {
      console.error("Error getting image information:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "File too large. Maximum allowed size is 10MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err.message === "Only image files are accepted!") {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;
