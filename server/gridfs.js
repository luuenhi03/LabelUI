const mongoose = require("mongoose");
const { GridFsStorage } = require("multer-gridfs-storage");
const crypto = require("crypto");
const path = require("path");

let gfs;
mongoose.connection.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "avatars",
  });
});

const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/label_db",
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

module.exports = { storage, gfs };
