import React, { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import axios from "../utils/axios";
import "./CropImage.scss";

const CropImage = ({
  imageUrl,
  selectedImage,
  imageList,
  setImageList,
  setSelectedImage,
  setImageUrl,
  onUploadComplete,
  onExit,
  selectedDataset,
}) => {
  const cropperRef = useRef(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const dataURLtoFile = (dataurl, filename) => {
    try {
      const arr = dataurl.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (error) {
      console.error("Error converting dataURL to File:", error);
      return null;
    }
  };

  const onCrop = () => {
    if (!fileName) {
      alert("Please enter a label before cropping the image.");
      return;
    }
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      try {
        const canvas = cropper.getCroppedCanvas({
          maxWidth: 4096,
          maxHeight: 4096,
          fillColor: "#fff",
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
        });

        if (!canvas) {
          throw new Error("Failed to crop image. Please try again.");
        }

        const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const coordinates = cropper.getData(true); // true for rounded values

        // Validate coordinates
        if (
          !coordinates ||
          typeof coordinates.x !== "number" ||
          typeof coordinates.y !== "number" ||
          typeof coordinates.width !== "number" ||
          typeof coordinates.height !== "number"
        ) {
          throw new Error("Invalid crop coordinates. Please try again.");
        }

        setCroppedImages((prev) => [
          ...prev,
          {
            dataUrl: croppedDataUrl,
            fileName,
            coordinates: {
              x: Math.round(coordinates.x),
              y: Math.round(coordinates.y),
              width: Math.round(coordinates.width),
              height: Math.round(coordinates.height),
            },
          },
        ]);
        setFileName("");
      } catch (error) {
        console.error("Error during cropping:", error);
        alert(
          error.message ||
            "An error occurred while cropping the image. Please try again."
        );
      }
    }
  };

  const handleDeleteCroppedImage = (index) => {
    setCroppedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (croppedImages.length === 0) {
      alert("Please crop at least one image before uploading.");
      return;
    }

    if (!selectedDataset) {
      alert("Please select a dataset first.");
      return;
    }

    setIsUploading(true);

    try {
      // Validate file names
      const invalidFileNames = croppedImages.filter((img) => {
        const fileName = img.fileName.trim();
        return !fileName || /[<>:"/\\|?*]/.test(fileName);
      });

      if (invalidFileNames.length > 0) {
        throw new Error(
          'Invalid characters in file names. Please avoid: < > : " / \\ | ? *'
        );
      }

      const formData = new FormData();
      croppedImages.forEach((img, index) => {
        const sanitizedFileName = img.fileName.trim();
        const file = dataURLtoFile(img.dataUrl, `${sanitizedFileName}.jpg`);
        if (!file) {
          throw new Error(
            `Failed to convert image "${sanitizedFileName}" to file`
          );
        }
        formData.append("images", file);
        formData.append(`labels[${index}]`, sanitizedFileName);
        formData.append(
          `coordinates[${index}]`,
          JSON.stringify(img.coordinates)
        );
        formData.append(`labeledBy[${index}]`, "user");
        formData.append(`labeledAt[${index}]`, new Date().toISOString());
        formData.append(`isCropped[${index}]`, "true");

        if (selectedImage) {
          formData.append(`originalImageIds[${index}]`, selectedImage._id);
          formData.append(
            `originalImageNames[${index}]`,
            selectedImage.filename
          );
        }
      });

      const response = await axios.post(
        `/api/dataset/${selectedDataset}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000, // 60 seconds timeout
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            console.log(`Upload progress: ${percentCompleted}%`);
          },
        }
      );

      console.log("Upload response:", response.data);

      if (response.data.images) {
        // Cập nhật UI
        setCroppedImages([]);
        if (onUploadComplete) {
          const uploadedImages = response.data.images.map((imageData) => ({
            _id: imageData._id,
            url: imageData.url,
            filename: imageData.filename,
            label: imageData.label,
            labeledBy: imageData.labeledBy,
            labeledAt: imageData.labeledAt,
            coordinates: imageData.coordinates,
            isCropped: true,
            originalImageId: imageData.originalImageId,
            originalImageName: imageData.originalImageName,
          }));
          onUploadComplete(uploadedImages);
        }

        // Xóa ảnh gốc nếu cần
        if (selectedImage) {
          try {
            await axios.delete(
              `/api/dataset/${selectedDataset}/images/${selectedImage._id}`
            );
            console.log("Original image deleted:", selectedImage.filename);

            // Cập nhật danh sách ảnh
            const updatedImageList = imageList.filter(
              (img) => img._id !== selectedImage._id
            );
            setImageList(updatedImageList);

            if (updatedImageList.length > 0) {
              setSelectedImage(updatedImageList[0]);
              setImageUrl(updatedImageList[0].url);
            } else {
              setSelectedImage(null);
              setImageUrl("");
            }
          } catch (error) {
            console.error("Error deleting original image:", error);
          }
        }

        onExit();
      } else {
        throw new Error("No images data in response");
      }
    } catch (error) {
      console.error("Error during upload:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      alert(
        error.response?.data?.message ||
          error.message ||
          "Failed to upload images. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="crop-container">
      <div className="cropper-wrapper">
        <Cropper
          ref={cropperRef}
          src={imageUrl}
          style={{ height: 400, width: "100%" }}
          initialAspectRatio={16 / 9}
          guides={true}
          viewMode={1}
          minCropBoxHeight={10}
          minCropBoxWidth={10}
          background={false}
          responsive={true}
          autoCropArea={1}
          checkOrientation={false}
          movable={true}
          rotatable={true}
          scalable={true}
          zoomable={true}
        />
      </div>
      <div className="upload-controls">
        <input
          type="text"
          placeholder="Enter label..."
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isUploading) {
              onCrop();
            }
          }}
          disabled={isUploading}
        />
        <button onClick={onCrop} disabled={isUploading}>
          Crop
        </button>
      </div>
      <div className="cropped-images-container">
        {croppedImages.map((img, index) => (
          <div key={index} className="cropped-image-wrapper">
            <img
              src={img.dataUrl}
              alt={`Cropped ${index}`}
              className="cropped-image"
            />
            <button
              className="delete-button"
              onClick={() => handleDeleteCroppedImage(index)}
              title="Delete image"
              disabled={isUploading}
            >
              ×
            </button>
            <div className="image-label">{img.fileName}</div>
          </div>
        ))}
      </div>
      <div className="button-group">
        <button
          onClick={handleUploadAll}
          className="upload-button"
          disabled={isUploading || croppedImages.length === 0}
        >
          {isUploading ? "Loading..." : "Upload all"}
        </button>
        <button onClick={onExit} className="exit-button" disabled={isUploading}>
          Exit
        </button>
      </div>
    </div>
  );
};

export default CropImage;
