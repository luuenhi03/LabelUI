const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

const datasetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    imageCount: {
      type: Number,
      default: 0,
    },

    images: [ImageSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Dataset", datasetSchema);
