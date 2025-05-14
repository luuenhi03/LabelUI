const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  fileId: String,
  url: String,
  filename: String,
  originalName: String,
  uploadDate: Date,
  label: String,
  labeledBy: String,
  labeledAt: Date,
  boundingBox: Object,
  labels: [
    {
      label: { type: String, required: true },
      labeledBy: { type: String, required: true },
      labeledAt: { type: Date, default: Date.now },
    },
  ],
});

const datasetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  images: [ImageSchema],
});

module.exports = mongoose.model("Dataset", datasetSchema);
