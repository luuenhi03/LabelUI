const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Dataset = require("../models/Dataset");
const fs = require("fs");
const mongoose = require("mongoose");
const { getUploadsBucket, uploadsStorage } = require("../gridfs");
const crypto = require("crypto");
const User = require("../models/User");
const Image = require("../models/Image");
const jwt = require("jsonwebtoken");
const { auth } = require("../middleware/auth");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Please login to perform this action" });
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

const upload = multer({
  storage: uploadsStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
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

router.get("/", auth, async (req, res) => {
  try {
    const datasets = await Dataset.find();
    res.json(datasets);
  } catch (error) {
    console.error("Error fetching datasets:", error);
    res.status(500).json({ message: "Error fetching datasets" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: "Dataset not found" });
    }
    res.json(dataset);
  } catch (error) {
    console.error("Error fetching dataset:", error);
    res.status(500).json({ message: "Error fetching dataset" });
  }
});

router.get(
  "/:id/labeled",
  authenticateToken,
  checkDatasetExists,
  async (req, res) => {
    try {
      console.log("=== Labeled Images Debug ===");
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 6;
      console.log("Page:", page, "Limit:", limit);

      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      // Lọc ảnh đã gán nhãn
      const labeledImages = dataset.images.filter(
        (img) =>
          (img.label && img.label.trim() !== "") ||
          img.isCropped ||
          (img.labels && img.labels.length > 0)
      );

      console.log("Total labeled images:", labeledImages.length);

      // Sắp xếp theo thời gian gán nhãn mới nhất
      labeledImages.sort((a, b) => {
        if (a.isCropped && !b.isCropped) return -1;
        if (!a.isCropped && b.isCropped) return 1;
        return new Date(b.labeledAt || 0) - new Date(a.labeledAt || 0);
      });

      // Phân trang
      const start = page * limit;
      const paginatedImages = labeledImages.slice(start, start + limit);

      console.log("Returning paginated images:", paginatedImages.length);

      res.json({
        images: paginatedImages,
        total: labeledImages.length,
        page,
        limit,
      });
    } catch (error) {
      console.error("Error fetching labeled images:", error);
      res.status(500).json({
        message: "Error fetching labeled images",
        error: error.message,
      });
    }
  }
);

router.post("/", auth, async (req, res) => {
  try {
    const dataset = new Dataset({
      name: req.body.name,
      userId: req.user._id,
      isPrivate: req.body.isPrivate || false,
    });
    await dataset.save();
    res.status(201).json(dataset);
  } catch (error) {
    console.error("Error creating dataset:", error);
    res
      .status(500)
      .json({ message: "Cannot create dataset. Please try again later." });
  }
});

router.post(
  "/:id/upload",
  auth,
  checkDatasetExists,
  upload.array("images"),
  async (req, res) => {
    const startTime = performance.now();
    try {
      console.log("Upload request received:", {
        files: req.files?.length,
        body: req.body,
      });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message: "No images were uploaded",
        });
      }

      const uploadedImages = [];
      const dataset = req.dataset;

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const label = req.body[`labels[${i}]`];
        const coordinates = req.body[`coordinates[${i}]`]
          ? JSON.parse(req.body[`coordinates[${i}]`])
          : null;
        const labeledBy = req.body[`labeledBy[${i}]`] || req.user.username;
        const labeledAt =
          req.body[`labeledAt[${i}]`] || new Date().toISOString();
        const isCropped = req.body[`isCropped[${i}]`] === "true";
        const originalImageId = req.body[`originalImageIds[${i}]`];
        const originalImageName = req.body[`originalImageNames[${i}]`];

        // Tạo đường dẫn cho file
        const filePath = file.path
          ? file.path.replace(/\\/g, "/")
          : `uploads/${file.filename}`;

        // Create image document
        const image = new Image({
          filename: file.filename,
          originalName: file.originalname,
          path: filePath,
          fileId: file.id || file.filename, // Use filename as fileId if not provided
          dataset: dataset._id,
          label: label || "",
          labeledBy,
          labeledAt,
          coordinates,
          isCropped,
          originalImageId,
          originalImageName,
          url: `/api/dataset/${dataset._id}/images/${file.filename}`,
        });

        await image.save();
        uploadedImages.push(image);
      }

      // Update dataset with new images
      await Dataset.findByIdAndUpdate(dataset._id, {
        $push: {
          images: {
            $each: uploadedImages.map((img) => ({
              _id: img._id,
              filename: img.filename,
              fileId: img.fileId,
              label: img.label,
              url: img.url,
            })),
          },
        },
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Upload completed in ${executionTime.toFixed(2)}ms:`, {
        uploadedCount: uploadedImages.length,
        datasetId: dataset._id,
      });

      res.status(201).json({
        message: "Images uploaded successfully",
        images: uploadedImages,
        executionTime: executionTime.toFixed(2),
      });
    } catch (error) {
      console.error("Error during upload:", error);
      const endTime = performance.now();
      res.status(500).json({
        message: "Error uploading images",
        error: error.message,
        executionTime: (endTime - startTime).toFixed(2),
      });
    }
  }
);

router.get("/:id/images", auth, checkDatasetExists, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const dataset = await Dataset.findById(req.params.id);
    const totalImages = dataset.images.length;

    // Kiểm tra sự tồn tại của file trong GridFS và xử lý thông tin ảnh
    const bucket = getUploadsBucket();
    const paginatedImages = await Promise.all(
      dataset.images.slice(skip, skip + limit).map(async (img) => {
        const files = await bucket.find({ filename: img.filename }).toArray();
        const exists = files.length > 0;

        // Đảm bảo có đủ thông tin cần thiết
        const imageInfo = {
          ...img.toObject(),
          exists,
          url: img.url || `/api/dataset/${dataset._id}/images/${img.filename}`,
          fileId: img.fileId || img.filename,
        };

        console.log("Image info:", {
          filename: imageInfo.filename,
          url: imageInfo.url,
          exists: imageInfo.exists,
        });

        return imageInfo;
      })
    );

    res.json({
      images: paginatedImages,
      total: totalImages,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalImages / limit),
    });
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({
      message: "Error fetching images",
      error: error.message,
    });
  }
});

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
      console.log("Deleting image:", {
        datasetId: req.params.id,
        imageId: req.params.imageId,
      });

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

      console.log("Found image to delete:", {
        filename: image.filename,
        _id: image._id,
      });

      // Xóa file khỏi GridFS
      if (image.filename) {
        const bucket = getUploadsBucket();
        try {
          const files = await bucket
            .find({ filename: image.filename })
            .toArray();
          console.log("Found files in GridFS:", files.length);
          for (const file of files) {
            await bucket.delete(file._id);
            console.log("Deleted file from GridFS:", file._id);
          }
        } catch (error) {
          console.error("Error deleting file from GridFS:", error);
        }
      }

      // Xóa thông tin ảnh khỏi dataset
      const updateResult = await Dataset.findByIdAndUpdate(
        dataset._id,
        { $pull: { images: { _id: image._id } } },
        { new: true }
      );
      console.log("Updated dataset:", {
        id: updateResult._id,
        imagesCount: updateResult.images.length,
      });

      // Xóa thông tin ảnh khỏi collection Image nếu tồn tại
      const imageDoc = await Image.findOne({ filename: image.filename });
      if (imageDoc) {
        await Image.findByIdAndDelete(imageDoc._id);
        console.log("Deleted image document:", imageDoc._id);
      }

      res.json({ message: "Đã xóa ảnh thành công" });
    } catch (error) {
      console.error("Lỗi khi xóa ảnh:", error);
      res.status(500).json({
        message: "Lỗi khi xóa ảnh",
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
      console.log("=== Delete Label Debug ===");
      console.log("Request params:", req.params);
      console.log("Request user:", req.user);

      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        console.log("Dataset not found");
        return res.status(404).json({ message: "Dataset không tồn tại" });
      }

      const image = dataset.images.find(
        (img) => img._id.toString() === req.params.imageId
      );
      if (!image) {
        console.log("Image not found");
        return res.status(404).json({ message: "Không tìm thấy ảnh" });
      }

      console.log("Found image:", {
        _id: image._id,
        label: image.label,
        labeledBy: image.labeledBy,
        labels: image.labels,
      });

      // Lấy userId từ token
      const userId = req.user._id || req.user.id;
      console.log("User ID from token:", userId);

      // Khởi tạo mảng labels nếu chưa có
      if (!image.labels) {
        image.labels = [];
      }

      // Nếu image.labeledBy là string, chuyển thành ObjectId
      if (typeof image.labeledBy === "string") {
        image.labeledBy = new mongoose.Types.ObjectId(image.labeledBy);
      }

      // Nếu userId là string, chuyển thành ObjectId
      const userObjectId =
        typeof userId === "string"
          ? new mongoose.Types.ObjectId(userId)
          : userId;

      console.log("Current image state:", {
        labeledBy: image.labeledBy,
        labeledByType: typeof image.labeledBy,
        userId: userObjectId,
        userIdType: typeof userObjectId,
        labels: image.labels,
      });

      // Kiểm tra quyền xóa nhãn
      const canDelete =
        image.labeledBy &&
        (image.labeledBy.toString() === userObjectId.toString() ||
          image.labels.some(
            (label) =>
              label.labeledBy &&
              label.labeledBy.toString() === userObjectId.toString()
          ));

      if (!canDelete) {
        console.log("Permission denied");
        return res
          .status(403)
          .json({ message: "Bạn không có quyền xóa nhãn này" });
      }

      // Xóa các label của người dùng
      image.labels = image.labels.filter(
        (label) =>
          !label.labeledBy ||
          label.labeledBy.toString() !== userObjectId.toString()
      );

      // Reset label chính nếu là của người dùng hiện tại
      if (
        image.labeledBy &&
        image.labeledBy.toString() === userObjectId.toString()
      ) {
        if (image.labels.length > 0) {
          // Lấy label mới nhất từ người khác
          const latestLabel = image.labels.reduce((latest, current) => {
            if (!latest.labeledAt) return current;
            if (!current.labeledAt) return latest;
            return new Date(current.labeledAt) > new Date(latest.labeledAt)
              ? current
              : latest;
          });
          image.label = latestLabel.label;
          image.labeledBy = latestLabel.labeledBy;
          image.labeledAt = latestLabel.labeledAt;
        } else {
          // Reset hoàn toàn nếu không còn label nào
          image.label = "";
          image.labeledBy = null;
          image.labeledAt = null;
        }
      }

      console.log("Updated image state:", {
        label: image.label,
        labeledBy: image.labeledBy,
        labels: image.labels,
      });

      await dataset.save();
      console.log("Dataset saved successfully");

      res.json({
        message: "Đã xóa nhãn thành công",
        image: {
          _id: image._id,
          label: image.label,
          labeledBy: image.labeledBy,
          labeledAt: image.labeledAt,
          labels: image.labels,
        },
      });
    } catch (error) {
      console.error("Lỗi khi xóa nhãn:", error);
      res
        .status(500)
        .json({ message: "Lỗi khi xóa nhãn", error: error.message });
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

router.delete("/:id/image/:imageId", auth, async (req, res) => {
  try {
    const { id, imageId } = req.params;
    console.log("Deleting image:", { datasetId: id, imageId });

    // Kiểm tra dataset tồn tại
    const dataset = await Dataset.findById(id);
    if (!dataset) {
      console.log("Dataset not found:", id);
      return res.status(404).json({ message: "Dataset not found" });
    }
    console.log("Dataset found:", dataset._id);

    // Kiểm tra ảnh tồn tại
    const image = await Image.findById(imageId);
    if (!image) {
      console.log("Image not found:", imageId);
      return res.status(404).json({ message: "Image not found" });
    }
    console.log("Image found:", image._id);

    // Kiểm tra quyền xóa ảnh
    const userId = req.user._id || req.user.id;
    if (image.uploadedBy && image.uploadedBy.toString() !== userId.toString()) {
      console.log("Permission denied - User does not own the image");
      return res
        .status(403)
        .json({ message: "You do not have permission to delete this image" });
    }

    try {
      // Xóa file từ GridFS
      const gfs = await getGFS();
      await gfs.delete(new mongoose.Types.ObjectId(image.fileId));
      console.log("Deleted file from GridFS:", image.fileId);
    } catch (gfsError) {
      console.error("Error deleting file from GridFS:", gfsError);
      // Không return ở đây để tiếp tục xóa thông tin trong database
    }

    // Xóa thông tin ảnh từ database
    await Image.findByIdAndDelete(imageId);
    console.log("Deleted image from database:", imageId);

    // Xóa ảnh khỏi dataset
    dataset.images = dataset.images.filter(
      (img) => img._id.toString() !== imageId
    );
    await dataset.save();
    console.log("Removed image from dataset");

    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({
      message: "Error deleting image",
      error: error.message,
      details: {
        datasetId: req.params.id,
        imageId: req.params.imageId,
      },
    });
  }
});

// Thêm endpoint để lấy ảnh từ dataset
router.get(
  "/:id/images/:filename",
  auth,
  checkDatasetExists,
  async (req, res) => {
    try {
      const bucket = getUploadsBucket();

      // Kiểm tra xem file có tồn tại trong GridFS không
      const files = await bucket
        .find({ filename: req.params.filename })
        .toArray();
      if (!files.length) {
        console.error("File not found in GridFS:", req.params.filename);
        return res.status(404).json({ message: "Image not found" });
      }

      const downloadStream = bucket.openDownloadStreamByName(
        req.params.filename
      );

      downloadStream.on("error", (error) => {
        console.error("Error streaming file:", error);
        res.status(404).json({ message: "Image not found" });
      });

      // Thiết lập Content-Type dựa vào phần mở rộng của file
      const ext = path.extname(req.params.filename).toLowerCase();
      const contentType =
        {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
        }[ext] || "application/octet-stream";

      res.set("Content-Type", contentType);
      downloadStream.pipe(res);
    } catch (error) {
      console.error("Error fetching image:", error);
      res.status(500).json({ message: "Error fetching image" });
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
