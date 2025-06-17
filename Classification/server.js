const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|bmp|tiff/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, JPG, PNG, BMP, and TIFF are allowed."
        )
      );
    }
  },
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Color Classification API is running",
    timestamp: new Date().toISOString(),
  });
});

// Main classification endpoint
app.post("/classify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No image file provided",
        message: "Please upload an image file",
      });
    }

    const imagePath = req.file.path;
    console.log(`Processing image: ${imagePath}`);

    // Call Python script for inference
    const result = await runPythonInference(imagePath);

    // Clean up uploaded file
    fs.unlink(imagePath, (err) => {
      if (err) console.error("Error deleting uploaded file:", err);
    });

    res.json({
      success: true,
      filename: req.file.originalname,
      result: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Classification error:", error);

    // Clean up uploaded file in case of error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
    }

    res.status(500).json({
      error: "Classification failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Batch classification endpoint
app.post("/classify-batch", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "No image files provided",
        message: "Please upload at least one image file",
      });
    }

    console.log(`Processing ${req.files.length} images`);

    const results = [];

    for (const file of req.files) {
      try {
        const result = await runPythonInference(file.path);
        results.push({
          filename: file.originalname,
          success: true,
          result: result,
        });
      } catch (error) {
        results.push({
          filename: file.originalname,
          success: false,
          error: error.message,
        });
      }

      // Clean up file
      fs.unlink(file.path, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
    }

    res.json({
      success: true,
      total_images: req.files.length,
      results: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Batch classification error:", error);

    // Clean up uploaded files
    if (req.files) {
      req.files.forEach((file) => {
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting uploaded file:", err);
        });
      });
    }

    res.status(500).json({
      error: "Batch classification failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Function to run Python inference
function runPythonInference(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", ["inference.py", imagePath]);

    let result = "";
    let error = "";

    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      error += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const parsedResult = JSON.parse(result.trim());
          resolve(parsedResult);
        } catch (parseError) {
          reject(
            new Error(`Failed to parse inference result: ${parseError.message}`)
          );
        }
      } else {
        reject(
          new Error(`Python inference failed: ${error || "Unknown error"}`)
        );
      }
    });

    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });

    // Set timeout for inference (30 seconds)
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error("Inference timeout"));
    }, 30000);
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: "File size should be less than 10MB",
      });
    }
  }

  res.status(500).json({
    error: "Server error",
    message: error.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested endpoint does not exist",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Color Classification API Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🖼️  Classification: POST http://localhost:${PORT}/classify`);
  console.log(
    `📁 Batch classification: POST http://localhost:${PORT}/classify-batch`
  );
  console.log("---");
  console.log("Make sure you have:");
  console.log("1. inference.py in the same directory");
  console.log("2. best_color_model.pth model file");
  console.log("3. Required Python packages installed");
});

module.exports = app;
