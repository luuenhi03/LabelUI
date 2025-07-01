const mongoose = require("mongoose");
const { GridFsStorage } = require("multer-gridfs-storage");
const crypto = require("crypto");
const path = require("path");

let avatarBucket;
let uploadsBucket;

mongoose.connection.once("open", () => {
  avatarBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "avatars",
  });

  uploadsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });
});

const avatarStorage = new GridFsStorage({
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
          bucketName: "avatars",
          metadata: {
            userId: req.body.userId || req.user?._id,
            originalName: file.originalname,
            uploadDate: new Date(),
            isAvatar: true,
          },
        };
        resolve(fileInfo);
      });
    });
  },
});

const uploadsStorage = new GridFsStorage({
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
            userId: req.user?._id,
            originalName: file.originalname,
            uploadDate: new Date(),
            isDatasetImage: true,
          },
        };
        resolve(fileInfo);
      });
    });
  },
});

const getAvatarBucket = () => {
  if (!avatarBucket) {
    throw new Error("Avatar bucket is not initialized");
  }
  return avatarBucket;
};

const getUploadsBucket = () => {
  if (!uploadsBucket) {
    throw new Error("Uploads bucket is not initialized");
  }
  return uploadsBucket;
};

module.exports = {
  avatarStorage,
  uploadsStorage,
  getAvatarBucket,
  getUploadsBucket,
};
