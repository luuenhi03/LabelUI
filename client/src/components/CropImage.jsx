import React, { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import axios from "axios";
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
      alert("Vui lòng nhập nhãn trước khi crop ảnh.");
      return;
    }
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      try {
        const croppedDataUrl = cropper
          .getCroppedCanvas()
          .toDataURL("image/jpeg", 0.9);
        const coordinates = cropper.getData();
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
        alert("Có lỗi xảy ra khi crop ảnh. Vui lòng thử lại.");
      }
    }
  };

  const handleDeleteCroppedImage = (index) => {
    setCroppedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (croppedImages.length === 0) {
      alert("Không có ảnh nào để upload.");
      return;
    }

    // Validate dataset ID
    if (!selectedDataset) {
      alert("Không tìm thấy dataset ID. Vui lòng thử lại.");
      return;
    }

    setIsUploading(true);
    const uploadedDataArray = [];

    try {
      const formData = new FormData();
      croppedImages.forEach((img) => {
        const file = dataURLtoFile(img.dataUrl, `${img.fileName}.jpg`);
        formData.append("images", file);
        formData.append("label[]", img.fileName);
        formData.append("coordinates[]", JSON.stringify(img.coordinates));
        formData.append("labeledBy[]", "user");
        formData.append("labeledAt[]", new Date().toISOString());
        formData.append("isCropped[]", "true");
        // Add original image info if available
        if (selectedImage) {
          formData.append("originalImageId[]", selectedImage._id);
          formData.append("originalImageName[]", selectedImage.filename);
        }
      });
      formData.append("dataset", selectedDataset);

      try {
        const response = await axios.post(
          `http://localhost:5000/api/dataset/${selectedDataset}/upload`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 30000,
          }
        );
        console.log("Upload response:", response.data);
        uploadedDataArray.push(response.data);
      } catch (uploadError) {
        console.error("Upload error for image:", croppedImages[0].fileName, {
          error: uploadError.message,
          response: uploadError.response?.data,
          status: uploadError.response?.status,
          config: {
            url: uploadError.config?.url,
            method: uploadError.config?.method,
            headers: uploadError.config?.headers,
          },
        });

        if (uploadError.response?.data?.message) {
          alert(`Lỗi upload: ${uploadError.response.data.message}`);
        } else if (uploadError.code === "ECONNABORTED") {
          alert("Lỗi: Server không phản hồi. Vui lòng thử lại sau.");
        } else {
          alert(
            "Có lỗi xảy ra khi upload ảnh. Vui lòng kiểm tra console để biết thêm chi tiết."
          );
        }
        throw uploadError;
      }

      // Xóa ảnh gốc sau khi đã crop và upload thành công
      if (selectedImage) {
        try {
          await axios.delete(
            `http://localhost:5000/api/dataset/${selectedDataset}/image/${selectedImage._id}`
          );
          console.log("Original image deleted:", selectedImage.name);
        } catch (error) {
          console.error("Error deleting original image:", error);
          // Tiếp tục xử lý ngay cả khi không xóa được ảnh gốc
        }
      }

      // Reset state và gọi callback
      setCroppedImages([]);
      if (onUploadComplete) {
        // Chuyển đổi dữ liệu ảnh đã upload thành định dạng phù hợp
        const uploadedImages = uploadedDataArray.map((response) => {
          // Nếu response là một mảng, lấy phần tử đầu tiên
          const imageData = Array.isArray(response) ? response[0] : response;
          return {
            _id: imageData.fileId || imageData._id,
            url: imageData.url,
            filename: imageData.filename,
            label: imageData.label,
            labeledBy: imageData.labeledBy,
            labeledAt: imageData.labeledAt,
            coordinates: imageData.coordinates,
            boundingBox: imageData.boundingBox,
            isCropped: true,
            originalImageId: imageData.originalImageId,
            originalImageName: imageData.originalImageName,
          };
        });
        onUploadComplete(uploadedImages);
      }

      // Update image list
      const updatedImageList = imageList.filter(
        (img) => img._id !== selectedImage._id
      );
      setImageList(updatedImageList);

      if (updatedImageList.length > 0) {
        setSelectedImage(updatedImageList[0]);
        setImageUrl(`http://localhost:5000/${updatedImageList[0].url}`);
      } else {
        setSelectedImage(null);
        setImageUrl("");
      }

      onExit();
    } catch (error) {
      console.error("Error during upload:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      alert("Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại.");
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
          placeholder="Nhập nhãn..."
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
              title="Xóa ảnh"
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
