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
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Chỉ chấp nhận file ảnh!"), false);
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
        message: "Không tìm thấy dataset",
        details: `Dataset với ID ${req.params.id} không tồn tại`,
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
      message: "Lỗi khi kiểm tra dataset",
      error: error.message,
    });
  }
};

router.get("/", async (req, res) => {
  try {
    const datasets = await Dataset.find();
    res.json(datasets);
  } catch (error) {
    console.error("Error fetching datasets:", error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách dataset" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return res
        .status(400)
        .json({ message: "Tên dataset không được để trống" });
    }

    const newDataset = new Dataset({
      name: req.body.name.trim(),
    });
    const savedDataset = await newDataset.save();
    res.json(savedDataset);
  } catch (error) {
    console.error("Error creating dataset:", error);
    if (error.code === 11000) {
      res.status(400).json({ message: "Tên dataset đã tồn tại" });
    } else {
      res.status(500).json({ message: "Lỗi khi tạo dataset mới" });
    }
  }
});

router.put("/:id", checkDatasetExists, async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return res
        .status(400)
        .json({ message: "Tên dataset không được để trống" });
    }

    const dataset = await Dataset.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name.trim() },
      { new: true }
    );
    res.json(dataset);
  } catch (error) {
    console.error("Error updating dataset:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật dataset" });
  }
});

router.post("/:id/share", checkDatasetExists, async (req, res) => {
  try {
    if (!req.body.email || !req.body.email.trim()) {
      return res.status(400).json({ message: "Email không được để trống" });
    }

    res.json({ success: true, message: "Đã chia sẻ dataset!" });
  } catch (error) {
    console.error("Error sharing dataset:", error);
    res.status(500).json({ message: "Lỗi khi chia sẻ dataset" });
  }
});

router.post(
  "/:id/upload",
  checkDatasetExists,
  upload.array("images"),
  async (req, res) => {
    console.log("Upload body:", req.body);
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ message: "Không có file nào được upload" });
      }

      req.dataset.images = req.dataset.images || [];
      const savedImages = [];

      for (let i = 0; i < req.files.length; i++) {
        const label = Array.isArray(req.body.label)
          ? req.body.label[i]
          : req.body.label;
        let coordinates;
        if (Array.isArray(req.body.coordinates)) {
          coordinates =
            req.body.coordinates[i] && req.body.coordinates[i] !== "undefined"
              ? JSON.parse(req.body.coordinates[i])
              : undefined;
        } else {
          coordinates =
            req.body.coordinates && req.body.coordinates !== "undefined"
              ? JSON.parse(req.body.coordinates)
              : undefined;
        }
        const labeledBy = Array.isArray(req.body.labeledBy)
          ? req.body.labeledBy[i]
          : req.body.labeledBy;

        let labeledAt;
        if (Array.isArray(req.body.labeledAt)) {
          labeledAt =
            req.body.labeledAt[i] && !isNaN(Date.parse(req.body.labeledAt[i]))
              ? new Date(req.body.labeledAt[i])
              : new Date();
        } else {
          labeledAt =
            req.body.labeledAt && !isNaN(Date.parse(req.body.labeledAt))
              ? new Date(req.body.labeledAt)
              : new Date();
        }

        const boundingBox = coordinates
          ? {
              x: coordinates.x,
              y: coordinates.y,
              width: coordinates.width,
              height: coordinates.height,
            }
          : undefined;

        const file = req.files[i];
        const imageData = {
          fileId: file.id || file._id,
          url: `/api/dataset/${file.id || file._id}`,
          filename: file.filename,
          originalName: file.metadata?.originalName || file.originalname,
          uploadDate: file.metadata?.uploadDate || new Date(),
          label,
          labeledBy,
          labeledAt,
          coordinates,
          boundingBox,
          isCropped: true,
        };

        req.dataset.images.push(imageData);
        savedImages.push(imageData);
      }

      await req.dataset.save();
      console.log("Dataset saved with new images:", {
        datasetId: req.dataset._id,
        imageCount: req.dataset.images.length,
        savedImages: savedImages.map((img) => ({
          filename: img.filename,
          label: img.label,
          labeledBy: img.labeledBy,
        })),
      });

      res.status(200).json({
        message: "Upload ảnh thành công",
        images: savedImages,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      res
        .status(500)
        .json({ message: "Lỗi khi upload ảnh", error: error.message });
    }
  }
);

router.get("/:id/images", checkDatasetExists, async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: "Không tìm thấy dataset" });
    }
    res.json(dataset.images || []);
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách ảnh" });
  }
});

router.get("/:id/labeled", checkDatasetExists, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 6;
    const skip = page * limit;

    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: "Không tìm thấy dataset" });
    }

    const labeledImages = (dataset.images || [])
      .filter((img) => img.label)
      .sort((a, b) => new Date(b.labeledAt) - new Date(a.labeledAt));
    const total = labeledImages.length;
    const images = labeledImages.slice(skip, skip + limit);

    res.json({
      images,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching labeled images:", error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách ảnh đã gán nhãn" });
  }
});

router.put("/:id/images/:imageId", checkDatasetExists, async (req, res) => {
  try {
    console.log("=== Save Label Debug ===");
    console.log("Dataset ID:", req.params.id);
    console.log("Image ID:", req.params.imageId);
    console.log("Request body:", req.body);

    const { label, labeledBy, boundingBox } = req.body;
    if (!label || !label.trim()) {
      return res.status(400).json({ message: "Nhãn không được để trống" });
    }

    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: "Không tìm thấy dataset" });
    }

    const image = dataset.images.find(
      (img) => img._id.toString() === req.params.imageId
    );
    if (!image) {
      return res.status(404).json({ message: "Không tìm thấy ảnh" });
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
    res.status(500).json({ message: "Lỗi khi cập nhật nhãn" });
  }
});

router.get("/:id/check", async (req, res) => {
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

router.get("/:id/export", checkDatasetExists, async (req, res) => {
  try {
    console.log("=== CSV Export Debug ===");
    console.log("Export request for dataset ID:", req.params.id);

    const dataset = req.dataset;
    console.log("Dataset found:", {
      id: dataset._id,
      name: dataset.name,
      imageCount: dataset.images?.length || 0,
    });

    const csvRows = ["filename,label,labeledBy,labeledAt,boundingBox"];

    if (dataset.images && dataset.images.length > 0) {
      dataset.images
        .filter((img) => img.label)
        .forEach((img) => {
          const escapeCsv = (str) => {
            if (str === null || str === undefined) return "";
            str = String(str);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
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
            } else if (img.boundingBox.topLeft && img.boundingBox.bottomRight) {
              boundingBoxStr = `${img.boundingBox.topLeft.x},${img.boundingBox.topLeft.y},${img.boundingBox.bottomRight.x},${img.boundingBox.bottomRight.y}`;
            }
          }

          const row = [
            escapeCsv(img.filename),
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

    // Set proper headers for CSV download
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
    res.status(500).json({ message: "Lỗi khi xuất file CSV" });
  }
});

// Xóa ảnh khỏi dataset
router.delete("/:id/images/:imageId", checkDatasetExists, async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: "Không tìm thấy dataset" });
    }

    const imageIndex = dataset.images.findIndex(
      (img) => img._id.toString() === req.params.imageId
    );
    if (imageIndex === -1) {
      return res.status(404).json({ message: "Không tìm thấy ảnh" });
    }

    // Xóa ảnh khỏi dataset
    dataset.images.splice(imageIndex, 1);
    await dataset.save();

    res.json({ message: "Đã xóa ảnh thành công" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Lỗi khi xóa ảnh" });
  }
});

// Xóa tất cả datasets (chỉ dùng trong development)
router.delete("/reset", async (req, res) => {
  try {
    await Dataset.deleteMany({});
    res.json({ message: "Đã xóa tất cả datasets" });
  } catch (error) {
    console.error("Error resetting datasets:", error);
    res.status(500).json({ message: "Lỗi khi xóa datasets" });
  }
});

router.get("/:fileId", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "uploads",
    });

    const fileId = new mongoose.Types.ObjectId(req.params.fileId);

    // Kiểm tra file tồn tại
    const files = await db
      .collection("uploads.files")
      .find({ _id: fileId })
      .toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy file" });
    }

    res.set("Content-Type", files[0].contentType || "application/octet-stream");
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lấy ảnh", error: err.message });
  }
});

// Thống kê nhãn cho ảnh trong dataset
router.get(
  "/:id/images/:imageId/label-stats",
  checkDatasetExists,
  async (req, res) => {
    try {
      const dataset = await Dataset.findById(req.params.id);
      if (!dataset) {
        return res.status(404).json({ message: "Không tìm thấy dataset" });
      }
      const image = dataset.images.find(
        (img) => img._id.toString() === req.params.imageId
      );
      if (!image) {
        return res.status(404).json({ message: "Không tìm thấy ảnh" });
      }
      // Lấy nhãn mới nhất của mỗi người dùng
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
      // Đếm số lượng mỗi nhãn
      const labelCounts = {};
      Object.values(latestLabels).forEach((label) => {
        if (label.label) {
          labelCounts[label.label] = (labelCounts[label.label] || 0) + 1;
        }
      });
      // Định dạng dữ liệu trả về
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

module.exports = router;
