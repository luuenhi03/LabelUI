import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "axios";
import { RiDeleteBinLine, RiCloseLine } from "react-icons/ri";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

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

  if (!data.length && showNoStatsMessage)
    return <div>No statistics available</div>;
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
  const params = useParams();
  const location = useLocation();
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [imageIdFromUrl, setImageIdFromUrl] = useState(null);

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
    // Ưu tiên lấy datasetId từ URL (params hoặc query)
    let urlDatasetId = params.id;
    if (!urlDatasetId) {
      const searchParams = new URLSearchParams(location.search);
      urlDatasetId = searchParams.get("dataset");
    }
    if (urlDatasetId) {
      setSelectedDataset(urlDatasetId);
      localStorage.setItem("selectedDataset", urlDatasetId);
    } else {
      const savedDataset = localStorage.getItem("selectedDataset");
      if (savedDataset) setSelectedDataset(savedDataset);
    }
    fetchDatasets();
  }, [params.id, location.search]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const imageId = searchParams.get("image");
    setImageIdFromUrl(imageId);
  }, [location.search]);

  useEffect(() => {
    if (selectedDataset) {
      loadImageList();
      loadLabeledImages(0);
    }
    // eslint-disable-next-line
  }, [selectedDataset, imageIdFromUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        handlePrevImage();
      } else if (e.key === "ArrowRight") {
        handleNextImage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, imageList]);

  const loadImageList = async () => {
    if (!selectedDataset) {
      setImageList([]);
      setImageUrl("");
      setSelectedImage(null);
      setTotalImages(0);
      return;
    }
    try {
      const response = await axios.get(
        `http://localhost:5000/api/dataset/${selectedDataset}/images`
      );
      setImageList(response.data);
      setTotalImages(response.data.length);

      // Thêm log kiểm tra
      console.log("Selected dataset:", selectedDataset);
      console.log("Image list from API:", response.data);
      console.log("imageIdFromUrl:", imageIdFromUrl);

      if (response.data.length > 0) {
        if (imageIdFromUrl) {
          const foundIndex = response.data.findIndex(
            (img) => img._id === imageIdFromUrl
          );
          if (foundIndex !== -1) {
            await loadImage(response.data[foundIndex], foundIndex);
          } else {
            await loadImage(response.data[0], 0);
          }
        } else {
          await loadImage(response.data[0], 0);
        }
      } else {
        setImageUrl("");
        setSelectedImage(null);
        setMessage("");
      }
    } catch (error) {
      console.error("Error loading image list:", error);
      setMessage("Error loading image list: " + error.message);
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
        imageUrl = `http://localhost:5000/api/dataset/file/${image.fileId}`;
      } else if (image.url && image.url.startsWith("/api/dataset/file/")) {
        imageUrl = `http://localhost:5000${image.url}`;
      } else {
        imageUrl = "https://via.placeholder.com/300x300?text=No+Image";
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
      setMessage("Error loading image: " + error.message);
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
      setMessage("Please enter a label!");
      return;
    }

    if (!selectedDataset) {
      setMessage("Please select a dataset first!");
      return;
    }

    // Validate dataset ID format
    if (!/^[0-9a-fA-F]{24}$/.test(selectedDataset)) {
      setMessage("Invalid Dataset ID!");
      return;
    }

    // Always get email from localStorage
    const storedUser = JSON.parse(localStorage.getItem("user"));
    const email = storedUser?.email;
    if (!email) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
      return;
    }

    try {
      // Save the label
      const response = await axios.put(
        `http://localhost:5000/api/dataset/${selectedDataset}/images/${selectedImage._id}`,
        {
          label: label.trim(),
          labeledBy: email,
          boundingBox: selectedImage.coordinates
            ? {
                topLeft: selectedImage.coordinates.topLeft,
                bottomRight: selectedImage.coordinates.bottomRight,
              }
            : null,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          validateStatus: () => true, // To always receive response, even on error
        }
      );

      // If authentication is lost, redirect to login
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      if (response.status !== 200) {
        setMessage("Error saving label. Please try again!");
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      // Add the newly labeled image to the latest labeled images
      setLatestLabeled((prev) => {
        // Nếu ảnh đã có trong latestLabeled thì cập nhật lại, nếu chưa có thì thêm mới vào đầu mảng
        const exists = prev.some((img) => img._id === selectedImage._id);
        const newLabeled = {
          ...selectedImage,
          label: label.trim(),
          labeledBy: storedUser.email,
          labeledAt: new Date().toISOString(),
          fileId: selectedImage.fileId,
          url: selectedImage.url,
        };
        if (exists) {
          return [
            newLabeled,
            ...prev.filter((img) => img._id !== selectedImage._id),
          ];
        } else {
          return [newLabeled, ...prev];
        }
      });

      setLabel("");
      setImageInfo({
        label: response.data.label,
        labeledBy: response.data.labeledBy,
        status: "labeled",
      });
      setSelectedImage((prev) =>
        prev
          ? {
              ...prev,
              label: response.data.label,
              labeledBy: response.data.labeledBy,
              labeledAt: response.data.labeledAt,
            }
          : prev
      );

      // Update label for current image in imageList
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

      // Move to next image if available, otherwise stay on current image
      if (currentIndex < imageList.length - 1) {
        loadImage(updatedImageList[currentIndex + 1], currentIndex + 1);
      } else {
        setMessage("All images in dataset have been labeled.");
      }

      // After saving label, update the Labeled Images section
      await loadLabeledImages(0);
      setStatsRefreshKey((k) => k + 1);

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving label:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setMessage("Error saving label. Please try again!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleSaveRecentLabel = async (imageId, newLabel) => {
    if (!selectedDataset || !newLabel.trim()) {
      setMessage("Please enter a label and select a dataset!");
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

      setMessage("Label updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating label:", error);
      setMessage("Error updating label. Please try again!");
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
      setMessage("Error loading labeled images!");
      setLatestLabeled([]);
      setAllLabeledImages(0);
    }
  };

  const handleDeleteImageFromDataset = async (imageId) => {
    if (!selectedDataset) {
      alert("Please select a dataset first!");
      return;
    }
    try {
      const response = await axios.delete(
        `http://localhost:5000/api/dataset/${selectedDataset}/images/${imageId}`
      );

      if (response.status === 200) {
        // Reload the image list to get the updated state from server
        await loadImageList();
        // Reload labeled images to update the labeled images section
        await loadLabeledImages(0);
        // Update statistics
        setStatsRefreshKey((k) => k + 1);

        setMessage("Image label information deleted successfully!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error deleting image label:", error);
      setMessage("Error deleting image label. Please try again!");
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
      setMessage("Invalid Dataset ID!");
      return;
    }
    setSelectedDataset(datasetId);
    // Save selected dataset name
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
      setMessage("Error fetching datasets!");
    }
  };

  const handleStopLabeling = async () => {
    if (!selectedDataset) {
      alert("Please select a dataset before exporting CSV!");
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

      setMessage("CSV exported successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      setMessage("Error exporting CSV. Please try again!");
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
      alert("Please select a dataset first!");
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
      // Update latestLabeled (hide the reset image)
      setLatestLabeled((prev) => prev.filter((img) => img._id !== imageId));
      setMessage("Label reset successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error resetting label:", error);
      setMessage("Error resetting label. Please try again!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Hàm ẩn ảnh khỏi danh sách chính (Label Image), không xóa khỏi dataset
  const handleHideFromMainList = (imageId) => {
    setImageList((prevList) => {
      const newList = prevList.filter((image) => image._id !== imageId);
      // Find index of current image
      const deletedIndex = prevList.findIndex((img) => img._id === imageId);
      // If there are images left, move to next or previous image
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
    setMessage("Image hidden from main list!");
    setTimeout(() => setMessage(""), 3000);
  };

  console.log("latestLabeled", latestLabeled);

  return (
    <div className="label-container">
      <div className="main-content">
        <div className="label-section">
          {/* Upload component if exists */}
          {uploadComponent
            ? React.cloneElement(uploadComponent, {
                onUploadSuccess: loadImageList,
              })
            : null}
          <div className="label-header">
            <h1>Label Image</h1>
            <div className="dataset-selector-container">
              <select
                className="dataset-selector"
                value={selectedDataset}
                onChange={handleDatasetChange}
              >
                <option value="">Select dataset...</option>
                {datasets.map((dataset) => (
                  <option key={dataset._id} value={dataset._id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {message && <div className="message">{message}</div>}
          {!selectedDataset ? (
            <div className="no-dataset-message">
              Please select a dataset to start labeling
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
                      Export CSV
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
                      Label statistics for this image
                    </div>
                    <ImageLabelPieChart
                      key={selectedImage?._id + "-" + statsRefreshKey}
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
                  placeholder="Enter label..."
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
                  <span>Delete</span>
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

                  // Update imageList and latestLabeled from backend
                  await loadImageList();
                  await loadLabeledImages(0);

                  // Reset related states if needed
                  setMessage("Image processing completed successfully!");
                  setTimeout(() => setMessage(""), 3000);
                } catch (error) {
                  console.error("Error in onUploadComplete:", error);
                  setMessage("Error processing image. Please try again.");
                }
              }}
              onExit={() => setShowCrop(false)}
            />
          ) : (
            <div className="no-image-message">
              {imageList.length === 0
                ? "No images left to label"
                : "Loading images..."}
            </div>
          )}
        </div>
      </div>

      {/* Recent Labeled */}
      <div className="recent-labels">
        <h2>Labeled Images</h2>
        <div className="recent-images">
          {latestLabeled.map((img, index) => (
            <div key={index} className="recent-item">
              <div className="image-container">
                {console.log("img in latestLabeled:", img)}
                <img
                  src={
                    img.url
                      ? img.url.startsWith("http")
                        ? img.url
                        : `http://localhost:5000${img.url}`
                      : img.fileId
                      ? `http://localhost:5000/api/dataset/file/${img.fileId}`
                      : `https://via.placeholder.com/200x120?text=No+Image`
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
                    Save
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
          <span>Page {pageIndex + 1}</span>
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
