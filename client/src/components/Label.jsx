import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "axios";
import { RiDeleteBinLine, RiCloseLine } from "react-icons/ri";
import { useNavigate } from "react-router-dom";
import "./Label.scss";
import CropImage from "./CropImage";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import DatasetStats from "./DatasetStats";
import "./DatasetStats.scss";
import UserMenu from "./UserMenu";

const COLORS = ["#0088FE", "#FFBB28", "#00C49F", "#FF8042", "#8884D8"];

const ImageLabelPieChart = ({
  imageId,
  datasetId,
  showNoStatsMessage = true,
}) => {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!datasetId || !imageId) return;
    fetch(
      `http://localhost:5000/api/dataset/${datasetId}/images/${imageId}/label-stats`
    )
      .then((res) => res.json())
      .then((stats) => {
        // Ensure stats is an array
        if (!Array.isArray(stats)) {
          console.error("Stats is not an array:", stats);
          setData([]);
          return;
        }
        // Calculate total count
        const total = stats.reduce((sum, item) => sum + item.count, 0);
        // Add percentage to each item
        const dataWithPercentage = stats.map((item) => ({
          ...item,
          percentage: ((item.count / total) * 100).toFixed(1),
        }));
        setData(dataWithPercentage);
      })
      .catch((error) => {
        console.error("Error fetching label stats:", error);
        setData([]);
      });
  }, [datasetId, imageId]);

  if (!data.length && showNoStatsMessage) return <div>Chưa có thống kê</div>;
  if (!data.length) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PieChart width={320} height={180}>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx={90}
          cy={90}
          outerRadius={70}
          label={false}
        >
          {data.map((entry, idx) => (
            <Cell key={entry.label} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          payload={data.map((item, idx) => ({
            value: item.label,
            type: "square",
            color: COLORS[idx % COLORS.length],
            payload: { style: { color: "#000" } },
          }))}
          wrapperStyle={{ color: "#000" }}
        />
      </PieChart>
    </div>
  );
};

const Label = forwardRef((props, sref) => {
  const [imageList, setImageList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageInfo, setImageInfo] = useState({ label: "", labeledBy: "" });
  const [latestLabeled, setLatestLabeled] = useState([]);
  const inputRef = useRef(null);
  const [allLabeledImages, setAllLabeledImages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [showCrop, setShowCrop] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [message, setMessage] = useState("");
  const [selectedDatasetName, setSelectedDatasetName] = useState("");
  const navigate = useNavigate();

  const { user, uploadComponent } = props;

  const storedUser = JSON.parse(localStorage.getItem("user")) || {
    email: "user@gmail.com",
    avatar: null,
  };

  useImperativeHandle(sref, () => ({
    handleUpload: (fileUrls) => {
      setImageUrl(fileUrls);
      loadImageList();
    },
  }));

  useEffect(() => {
    const savedDataset = localStorage.getItem("selectedDataset");
    if (savedDataset) {
      setSelectedDataset(savedDataset);
    }
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (selectedDataset) {
      loadImageList();
      loadLabeledImages(0);
    }
  }, [selectedDataset]);

  const loadImageList = async () => {
    if (!selectedDataset) {
      console.log("No dataset selected");
      setImageList([]);
      setImageUrl("");
      setSelectedImage(null);
      setTotalImages(0);
      return;
    }
    try {
      console.log("Loading images for dataset:", selectedDataset);
      const response = await axios.get(
        `http://localhost:5000/api/dataset/${selectedDataset}/images`
      );
      console.log("API Response:", response.data);

      // Không lọc ảnh chưa có nhãn nữa, hiển thị toàn bộ ảnh
      setImageList(response.data);
      setTotalImages(response.data.length);

      if (response.data.length > 0) {
        await loadImage(response.data[0], 0);
      } else {
        setImageUrl("");
        setSelectedImage(null);
        setMessage("Không còn ảnh nào trong dataset này.");
      }
    } catch (error) {
      console.error("Error loading image list:", error);
      setMessage("Lỗi khi tải danh sách ảnh: " + error.message);
    }
  };

  const loadImage = async (image, index) => {
    try {
      if (!image) {
        console.error("Invalid image data:", image);
        setImageUrl("");
        setSelectedImage(null);
        return;
      }

      console.log("Loading image:", image);

      // Create URL for image from fileId
      let imageUrl;
      if (image.fileId) {
        imageUrl = `http://localhost:5000/api/dataset/${image.fileId}`;
      } else if (image.url) {
        imageUrl = image.url.startsWith("http")
          ? image.url
          : `http://localhost:5000${image.url}`;
      } else {
        console.error("Image has no valid URL or fileId:", image);
        setImageUrl("");
        setSelectedImage(null);
        return;
      }

      console.log("Generated image URL:", imageUrl);
      setImageUrl(imageUrl);
      setCurrentIndex(index);
      setSelectedImage(image);

      if (image.label) {
        setImageInfo({
          label: image.label,
          labeledBy: image.labeledBy,
          status: "labeled",
        });
        setLabel("");
      } else {
        setImageInfo({
          label: "",
          labeledBy: "",
          status: "unlabeled",
        });
        setLabel("");
      }

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error("Error loading image:", error);
      setMessage("Lỗi khi tải ảnh: " + error.message);
      setImageUrl("");
      setSelectedImage(null);
    }
  };

  const handlePrevImage = () => {
    if (currentIndex > 0 && imageList[currentIndex - 1]) {
      loadImage(imageList[currentIndex - 1], currentIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (currentIndex < imageList.length - 1 && imageList[currentIndex + 1]) {
      loadImage(imageList[currentIndex + 1], currentIndex + 1);
    }
  };

  const handleSaveLabel = async () => {
    if (!selectedImage || !label.trim()) {
      console.log("No label or image selected.");
      setMessage("Vui lòng nhập nhãn!");
      return;
    }

    if (!selectedDataset) {
      console.log("No dataset selected");
      setMessage("Vui lòng chọn dataset trước!");
      return;
    }

    // Validate dataset ID format
    if (!/^[0-9a-fA-F]{24}$/.test(selectedDataset)) {
      console.error("Invalid dataset ID format:", selectedDataset);
      setMessage("Dataset ID không hợp lệ!");
      return;
    }

    // Always get email from localStorage
    const storedUser = JSON.parse(localStorage.getItem("user"));
    const email = storedUser?.email || "";

    try {
      console.log("=== Save Label Debug ===");
      console.log("Dataset ID:", selectedDataset);
      console.log("Selected image:", selectedImage);
      console.log("Label:", label.trim());
      console.log("Image URL:", imageUrl);

      // Get bounding box coordinates if image was cropped
      let boundingBox = null;
      if (selectedImage.coordinates) {
        boundingBox = {
          topLeft: selectedImage.coordinates.topLeft,
          bottomRight: selectedImage.coordinates.bottomRight,
        };
      }

      // Save the label
      const response = await axios.put(
        `http://localhost:5000/api/dataset/${selectedDataset}/images/${selectedImage._id}`,
        {
          label: label.trim(),
          labeledBy: email,
          boundingBox: boundingBox,
        }
      );

      console.log("Label saved successfully:", response.data);

      // Add the newly labeled image to the latest labeled images
      setLatestLabeled((prev) =>
        [
          {
            ...response.data,
            url: imageUrl,
            filename: selectedImage.filename,
          },
          ...prev,
        ].slice(0, 6)
      );

      setLabel("");
      setImageInfo({
        label: response.data.label,
        labeledBy: response.data.labeledBy,
        status: "labeled",
      });

      // Cập nhật label cho ảnh hiện tại trong imageList
      const updatedImageList = imageList.map((img, idx) =>
        idx === currentIndex
          ? {
              ...img,
              label: response.data.label,
              labeledBy: response.data.labeledBy,
              labeledAt: response.data.labeledAt,
            }
          : img
      );
      setImageList(updatedImageList);

      // Chuyển sang ảnh tiếp theo nếu có, nếu không thì giữ nguyên
      if (currentIndex < imageList.length - 1) {
        loadImage(updatedImageList[currentIndex + 1], currentIndex + 1);
      } else {
        setMessage("Đã gán nhãn tất cả ảnh trong dataset.");
      }

      // Sau khi lưu nhãn, cập nhật lại phần Ảnh đã gán nhãn
      await loadLabeledImages(0);

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving label:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setMessage("Lỗi khi lưu nhãn. Vui lòng thử lại!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleSaveRecentLabel = async (imageId, newLabel) => {
    if (!selectedDataset || !newLabel.trim()) {
      setMessage("Vui lòng nhập nhãn và chọn dataset!");
      return;
    }

    // Always get email from localStorage
    const storedUser = JSON.parse(localStorage.getItem("user"));
    const email = storedUser?.email || "";

    try {
      const response = await axios.put(
        `http://localhost:5000/api/dataset/${selectedDataset}/images/${imageId}`,
        {
          label: newLabel.trim(),
          labeledBy: email,
        }
      );

      // Update the label in the latestLabeled state
      setLatestLabeled((prev) =>
        prev.map((img) =>
          img._id === imageId
            ? { ...img, label: newLabel.trim(), labeledBy: email }
            : img
        )
      );

      setMessage("Đã cập nhật nhãn thành công!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating label:", error);
      setMessage("Lỗi khi cập nhật nhãn. Vui lòng thử lại!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const loadLabeledImages = async (page = 0) => {
    if (!selectedDataset) return;

    try {
      const response = await axios.get(
        `http://localhost:5000/api/dataset/${selectedDataset}/labeled?page=${page}`
      );
      // Lọc và sắp xếp ảnh: ảnh đã crop sẽ hiển thị trước
      const sortedImages = response.data.images.sort((a, b) => {
        if (a.isCropped && !b.isCropped) return -1;
        if (!a.isCropped && b.isCropped) return 1;
        return new Date(b.labeledAt) - new Date(a.labeledAt);
      });
      setLatestLabeled(sortedImages);
      setAllLabeledImages(response.data.total);
      setPageIndex(page);
    } catch (error) {
      console.error("Error loading labeled images:", error);
      setMessage("Lỗi khi tải ảnh đã gán nhãn!");
      setLatestLabeled([]);
      setAllLabeledImages(0);
    }
  };

  const handleDeleteImageFromDataset = async (imageId) => {
    if (!selectedDataset) {
      alert("Vui lòng chọn dataset trước!");
      return;
    }
    try {
      await axios.delete(
        `http://localhost:5000/api/dataset/${selectedDataset}/images/${imageId}`
      );
      setImageList((prevList) => {
        const newList = prevList.filter((image) => image._id !== imageId);
        // Tìm index ảnh hiện tại
        const deletedIndex = prevList.findIndex((img) => img._id === imageId);
        // Nếu còn ảnh, chuyển sang ảnh tiếp theo hoặc trước đó
        if (newList.length > 0) {
          const nextIndex = Math.min(deletedIndex, newList.length - 1);
          setCurrentIndex(nextIndex);
          loadImage(newList[nextIndex], nextIndex);
        } else {
          setSelectedImage(null);
          setImageUrl("");
        }
        setTotalImages(newList.length);
        return newList;
      });
      setLatestLabeled((prev) => prev.filter((img) => img._id !== imageId));
      setMessage("Đã xóa ảnh khỏi dataset!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting image from dataset:", error);
      setMessage("Lỗi khi xóa ảnh khỏi dataset. Vui lòng thử lại!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handlePrevPage = () => {
    if (pageIndex > 0) {
      loadLabeledImages(pageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if ((pageIndex + 1) * 6 < allLabeledImages) {
      loadLabeledImages(pageIndex + 1);
    }
  };

  const handleDatasetChange = (e) => {
    const datasetId = e.target.value;
    if (!datasetId) {
      setSelectedDataset("");
      localStorage.removeItem("selectedDataset");
      return;
    }
    // Validate dataset ID format
    if (!/^[0-9a-fA-F]{24}$/.test(datasetId)) {
      console.error("Invalid dataset ID format:", datasetId);
      setMessage("Dataset ID không hợp lệ!");
      return;
    }
    setSelectedDataset(datasetId);
    // Lưu tên dataset được chọn
    const selectedDataset = datasets.find((d) => d._id === datasetId);
    if (selectedDataset) {
      setSelectedDatasetName(selectedDataset.name);
    }
    localStorage.setItem("selectedDataset", datasetId);
  };

  const fetchDatasets = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/dataset");
      setDatasets(response.data);
    } catch (error) {
      console.error("Error fetching datasets:", error);
      setMessage("Lỗi khi tải danh sách dataset!");
    }
  };

  const handleStopLabeling = async () => {
    if (!selectedDataset) {
      alert("Vui lòng chọn dataset trước khi tải file CSV!");
      return;
    }

    try {
      const response = await axios.get(
        `http://localhost:5000/api/dataset/${selectedDataset}/export`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${selectedDataset}_labeled_images.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage("Đã tải xuống file CSV thành công!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      setMessage("Có lỗi xảy ra khi tạo file CSV. Vui lòng thử lại!");
    }
  };

  const handleLogout = () => {
    // Clear any stored data if needed
    localStorage.removeItem("selectedDataset");
    // Navigate to login page
    navigate("/login");
  };

  // Demo dữ liệu thống kê
  const chartData = [
    { label: "Nhãn 1", count: 10 },
    { label: "Nhãn 2", count: 5 },
    { label: "Nhãn 3", count: 2 },
  ];
  const userCount = 4;

  // Hàm xóa nhãn (reset label) cho ảnh đã gán nhãn
  const handleResetLabel = async (imageId) => {
    if (!selectedDataset) {
      alert("Vui lòng chọn dataset trước!");
      return;
    }
    try {
      await axios.put(
        `http://localhost:5000/api/dataset/${selectedDataset}/images/${imageId}`,
        {
          label: "",
          labeledBy: "",
          labeledAt: null,
        }
      );
      // Cập nhật lại latestLabeled (ẩn ảnh vừa reset nhãn)
      setLatestLabeled((prev) => prev.filter((img) => img._id !== imageId));
      setMessage("Đã xóa nhãn thành công!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error resetting label:", error);
      setMessage("Lỗi khi xóa nhãn. Vui lòng thử lại!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Hàm ẩn ảnh khỏi danh sách chính (Label Image), không xóa khỏi dataset
  const handleHideFromMainList = (imageId) => {
    setImageList((prevList) => {
      const newList = prevList.filter((image) => image._id !== imageId);
      // Tìm index ảnh hiện tại
      const deletedIndex = prevList.findIndex((img) => img._id === imageId);
      // Nếu còn ảnh, chuyển sang ảnh tiếp theo hoặc trước đó
      if (newList.length > 0) {
        const nextIndex = Math.min(deletedIndex, newList.length - 1);
        setCurrentIndex(nextIndex);
        loadImage(newList[nextIndex], nextIndex);
      } else {
        setSelectedImage(null);
        setImageUrl("");
      }
      setTotalImages(newList.length);
      return newList;
    });
    setMessage("Đã ẩn ảnh khỏi danh sách chính!");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="label-container">
      {/* Header mới */}
      <div
        style={{
          width: "100%",
          height: 56,
          background: "#1976d2",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          boxSizing: "border-box",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 20, letterSpacing: 1 }}>
          LabelUI
        </div>
        <UserMenu user={storedUser} onLogout={handleLogout} />
      </div>
      <div className="main-content">
        <div className="label-section">
          {React.cloneElement(uploadComponent, {
            onUploadSuccess: loadImageList,
          })}
          <div className="label-header">
            <h1>Label Image</h1>
            <div className="dataset-selector-container">
              <select
                className="dataset-selector"
                value={selectedDataset}
                onChange={handleDatasetChange}
              >
                <option value="">Chọn dataset...</option>
                {datasets.map((dataset) => (
                  <option key={dataset._id} value={dataset._id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <button
                className="select-dataset-btn"
                onClick={() => navigate(`/dataset/${selectedDataset}/stats`)}
                disabled={!selectedDataset}
                style={{ marginLeft: 8 }}
              >
                Thống kê
              </button>
            </div>
          </div>
          {message && <div className="message">{message}</div>}
          {!selectedDataset ? (
            <div className="no-dataset-message">
              Vui lòng chọn một dataset để bắt đầu gán nhãn
            </div>
          ) : imageUrl && !showCrop ? (
            <>
              <div
                className="label-area"
                style={{ display: "flex", alignItems: "flex-start", gap: 32 }}
              >
                <div>
                  <img src={imageUrl} alt="Ảnh đang label" width="300" />
                  <p>
                    <b>File:</b> {selectedImage?.filename}
                  </p>
                  <div className="navigation-container">
                    <button
                      onClick={handlePrevImage}
                      disabled={currentIndex === 0}
                    >
                      {"<"} Prev
                    </button>
                    <span>
                      {currentIndex + 1} / {imageList.length}
                    </span>
                    <button
                      onClick={handleNextImage}
                      disabled={currentIndex === imageList.length - 1}
                    >
                      Next {">"}
                    </button>
                  </div>
                  <div
                    className="button-group"
                    style={{ display: "flex", gap: "10px" }}
                  >
                    <button
                      type="success"
                      onClick={() => setShowCrop(true)}
                      className="crop-button"
                    >
                      Crop Image
                    </button>
                    <button
                      onClick={handleStopLabeling}
                      className="export-csv-button"
                      disabled={!selectedDataset}
                    >
                      Xuất CSV
                    </button>
                  </div>
                </div>
                {selectedImage && (
                  <div>
                    <div
                      style={{
                        textAlign: "center",
                        fontWeight: "bold",
                        marginBottom: 8,
                      }}
                    >
                      Thống kê nhãn của ảnh này
                    </div>
                    <ImageLabelPieChart
                      imageId={selectedImage._id}
                      datasetId={selectedDataset}
                      showNoStatsMessage={true}
                    />
                  </div>
                )}
              </div>
              <div className="label-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Nhập nhãn..."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
                />
                <button
                  className="delete-labeled-button"
                  onClick={() =>
                    handleDeleteImageFromDataset(selectedImage?._id)
                  }
                >
                  <RiDeleteBinLine size={18} />
                  <span>Xóa</span>
                </button>
              </div>
            </>
          ) : showCrop ? (
            <CropImage
              imageUrl={imageUrl}
              selectedImage={selectedImage}
              imageList={imageList}
              setImageList={setImageList}
              setSelectedImage={setSelectedImage}
              setImageUrl={setImageUrl}
              selectedDataset={selectedDataset}
              onUploadComplete={async (uploadedDataArray) => {
                try {
                  setShowCrop(false);

                  // Cập nhật lại danh sách ảnh và ảnh đã gán nhãn từ backend
                  await loadImageList();
                  await loadLabeledImages(0);

                  // Reset các state liên quan nếu cần
                  setMessage("Đã xử lý ảnh crop thành công!");
                  setTimeout(() => setMessage(""), 3000);
                } catch (error) {
                  console.error("Error in onUploadComplete:", error);
                  setMessage("Có lỗi xảy ra khi xử lý ảnh. Vui lòng thử lại.");
                }
              }}
              onExit={() => setShowCrop(false)}
            />
          ) : (
            <div className="no-image-message">
              {imageList.length === 0
                ? "Không còn ảnh nào cần gán nhãn"
                : "Đang tải ảnh..."}
            </div>
          )}
        </div>
      </div>

      {/* Recent Labeled */}
      <div className="recent-labels">
        <h2>Ảnh đã gán nhãn</h2>
        <div className="recent-images">
          {latestLabeled.map((img, index) => (
            <div key={index} className="recent-item">
              <div className="image-container">
                <img
                  src={
                    img.url
                      ? img.url.startsWith("http")
                        ? img.url
                        : `http://localhost:5000${img.url}`
                      : img.fileId
                      ? `http://localhost:5000/api/dataset/${img.fileId}`
                      : `http://localhost:5000/uploads/${img.filename}`
                  }
                  alt={`Labeled ${index}`}
                  className="recent-image"
                />
                {img.isCropped && <div className="cropped-badge">Đã crop</div>}
              </div>
              <div className="label-container">
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={img.label || ""}
                    style={{
                      width: "100%",
                      padding: "8px",
                      boxSizing: "border-box",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      marginRight: "8px",
                    }}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setLatestLabeled((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, label: newLabel } : item
                        )
                      );
                    }}
                  />
                </div>
                <div className="button-container">
                  <button
                    className="save-button"
                    onClick={() => handleSaveRecentLabel(img._id, img.label)}
                  >
                    Lưu
                  </button>
                  <button
                    className="delete-icon-button"
                    onClick={() => handleDeleteImageFromDataset(img._id)}
                  >
                    <RiDeleteBinLine size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pagination">
          <button onClick={handlePrevPage} disabled={pageIndex === 0}>
            {"<"} Prev
          </button>
          <span>Trang {pageIndex + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={(pageIndex + 1) * 6 >= allLabeledImages}
          >
            Next {">"}
          </button>
        </div>
      </div>
    </div>
  );
});

export default Label;
