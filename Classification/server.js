const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Detailed CORS configuration
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("Health check request received");
  res.json({
    status: "OK",
    message: "Color Classification API is running",
    timestamp: new Date().toISOString(),
  });
});

// Main classification endpoint
app.post("/classify", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No image file provided",
    });
  }

  console.log("Processing file:", req.file.path);

  const pythonProcess = spawn("python", [
    path.join(__dirname, "inference.py"),
    req.file.path,
  ]);

  let result = "";
  let error = "";

  pythonProcess.stdout.on("data", (data) => {
    result += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    error += data.toString();
    console.error("Python error:", data.toString());
  });

  pythonProcess.on("close", (code) => {
    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
    });

    if (code !== 0) {
      console.error(`Python process exited with code ${code}`);
      return res.status(500).json({
        success: false,
        error: error || "Failed to process image",
      });
    }

    try {
      const prediction = JSON.parse(result);
      if (prediction.error) {
        return res.status(500).json({
          success: false,
          error: prediction.error,
        });
      }
      res.json({
        success: true,
        prediction: prediction,
      });
    } catch (err) {
      console.error("Error parsing Python output:", err);
      res.status(500).json({
        success: false,
        error: "Invalid prediction format",
      });
    }
  });

  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python process:", err);
    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
    res.status(500).json({
      success: false,
      error: "Failed to start prediction process",
    });
  });
});

// Batch classification endpoint
app.post(
  "/classify-batch",
  multer({ dest: "uploads/" }).array("images", 10),
  async (req, res) => {
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
  }
);

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
