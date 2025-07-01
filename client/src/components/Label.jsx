import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "../utils/axios";
import { RiDeleteBinLine } from "react-icons/ri";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "./Label.scss";
import CropImage from "./CropImage";
import { PieChart, Pie, Legend, Cell } from "recharts";
import DatasetStats from "./DatasetStats";
import "./DatasetStats.scss";
import UserMenu from "./UserMenu";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
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
    axios
      .get(`/api/dataset/${datasetId}/images/${imageId}/label-stats`)
      .then((response) => response.data)
      .then((stats) => {
        if (!Array.isArray(stats)) {
          console.error("Stats is not an array:", stats);
          setData([]);
          return;
        }

        const total = stats.reduce((sum, item) => sum + item.count, 0);
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

  useImperativeHandle(sref, () => ({
    handleUpload: (fileUrls) => {
      setImageUrl(fileUrls);
      loadImageList();
    },
  }));

  useEffect(() => {
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
      console.log("Loading images for dataset:", selectedDataset);
      const response = await axios.get(
        `/api/dataset/${selectedDataset}/images`
      );
      console.log("API response:", response.data);

      if (!response.data.images || response.data.images.length === 0) {
        console.log("No images found in dataset");
        setImageList([]);
        setTotalImages(0);
        return;
      }

      setImageList(response.data.images);
      setTotalImages(response.data.total);

      if (response.data.images.length > 0 && !selectedImage) {
        console.log("Loading first image:", response.data.images[0]);
        loadImage(response.data.images[0], 0);
      }
    } catch (error) {
      console.error("Error loading image list:", error);
      setImageList([]);
      setTotalImages(0);
      setMessage("Error loading images. Please try again!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const loadImage = async (image, index) => {
    try {
      if (!image) {
        setImageUrl("");
        setSelectedImage(null);
        setMessage("No image selected");
        return;
      }

      // Log thông tin ảnh để debug
      console.log("Loading image with data:", {
        id: image._id,
        filename: image.filename,
        fileId: image.fileId,
        url: image.url,
        label: image.label,
      });

      // Tạo URL ảnh với thứ tự ưu tiên
      let imageUrl;

      // 1. Ưu tiên fileId nếu có
      if (image.fileId) {
        imageUrl = `${API_BASE_URL}/api/dataset/file/${image.fileId}`;
      }
      // 2. Kiểm tra URL trực tiếp
      else if (image.url) {
        imageUrl = image.url.startsWith("http")
          ? image.url
          : `${API_BASE_URL}${image.url.startsWith("/") ? "" : "/"}${
              image.url
            }`;
      }
      // 3. Sử dụng filename nếu có
      else if (image.filename) {
        imageUrl = `${API_BASE_URL}/api/dataset/${selectedDataset}/images/${image.filename}`;
      }
      // 4. Fallback nếu không có thông tin
      else {
        console.warn("No valid image source found:", image);
        imageUrl = "https://via.placeholder.com/300x300?text=No+Image+Source";
      }

      console.log("Attempting to load image from URL:", imageUrl);

      // Kiểm tra xem ảnh có tải được không
      const img = new Image();
      img.onload = () => {
        console.log("Image loaded successfully:", imageUrl);
        setImageUrl(imageUrl);
        setSelectedImage(image);
        setCurrentIndex(index);
        setLabel(image.label || "");
        setMessage("");
      };

      img.onerror = (error) => {
        console.error("Failed to load image:", imageUrl, error);
        setImageUrl(
          "https://via.placeholder.com/300x300?text=Error+Loading+Image"
        );
        setMessage("Error loading image. Please try again!");
      };

      img.src = imageUrl;
    } catch (error) {
      console.error("Error in loadImage:", error);
      setImageUrl("https://via.placeholder.com/300x300?text=Error");
      setMessage("An error occurred while loading the image");
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

    if (!/^[0-9a-fA-F]{24}$/.test(selectedDataset)) {
      setMessage("Invalid Dataset ID!");
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem("user"));
    const email = storedUser?.email;
    if (!email) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
      return;
    }

    try {
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
          validateStatus: () => true,
        }
      );

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

      setLatestLabeled((prev) => {
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

      if (currentIndex < imageList.length - 1) {
        loadImage(updatedImageList[currentIndex + 1], currentIndex + 1);
      } else {
        setMessage("All images in dataset have been labeled.");
      }

      await loadLabeledImages(0);
      setStatsRefreshKey((k) => k + 1);

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving label:", error);
      setMessage("Error saving label. Please try again!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleSaveRecentLabel = async (imageId, newLabel) => {
    if (!selectedDataset || !newLabel.trim()) {
      setMessage("Please enter a label and select a dataset!");
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem("user"));
    const email = storedUser?.email || "";

    try {
      const response = await axios.put(
        `/api/dataset/${selectedDataset}/images/${imageId}`,
        {
          label: newLabel.trim(),
          labeledBy: email,
        }
      );

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
      console.log(
        "Loading labeled images for dataset:",
        selectedDataset,
        "page:",
        page
      );
      const response = await axios.get(
        `/api/dataset/${selectedDataset}/labeled?page=${page}&limit=6`
      );

      if (!response.data || !Array.isArray(response.data.images)) {
        console.error("Invalid response format:", response.data);
        setMessage("Error: Invalid data format received from server");
        return;
      }

      console.log("Received labeled images:", response.data);

      // Xử lý và chuẩn hóa dữ liệu ảnh
      const processedImages = response.data.images.map((img) => {
        // Tạo URL ảnh với thứ tự ưu tiên giống như trong loadImage
        let imageUrl;
        if (img.fileId) {
          imageUrl = `${API_BASE_URL}/api/dataset/file/${img.fileId}`;
        } else if (img.url) {
          imageUrl = img.url.startsWith("http")
            ? img.url
            : `${API_BASE_URL}${img.url.startsWith("/") ? "" : "/"}${img.url}`;
        } else if (img.filename) {
          imageUrl = `${API_BASE_URL}/api/dataset/${selectedDataset}/images/${img.filename}`;
        } else {
          imageUrl = "https://via.placeholder.com/300x300?text=No+Image+Source";
        }

        return {
          ...img,
          displayUrl: imageUrl,
          label: img.label || (img.labels && img.labels[0]) || "Unlabeled",
        };
      });

      setAllLabeledImages(processedImages);
      setPageIndex(page);

      // Cập nhật tổng số ảnh nếu có
      if (response.data.total !== undefined) {
        setTotalImages(response.data.total);
      }
    } catch (error) {
      console.error("Error loading labeled images:", error);
      setMessage("Error loading labeled images. Please try again!");
      setAllLabeledImages([]);
    }
  };

  const handleDeleteImageFromDataset = async (imageId) => {
    if (!selectedDataset) {
      setMessage("Please select a dataset first!");
      return;
    }

    try {
      const response = await axios.delete(
        `/api/dataset/${selectedDataset}/images/${imageId}`
      );

      if (response.status === 200) {
        setImageList((prev) =>
          prev.filter((img) => img._id.toString() !== imageId)
        );
        setTotalImages((prev) => prev - 1);
        setStatsRefreshKey((prev) => prev + 1);

        // Load next image if current image was deleted
        if (selectedImage && selectedImage._id.toString() === imageId) {
          if (currentIndex < imageList.length - 1) {
            loadImage(imageList[currentIndex + 1], currentIndex + 1);
          } else if (currentIndex > 0) {
            loadImage(imageList[currentIndex - 1], currentIndex - 1);
          } else {
            setSelectedImage(null);
            setImageUrl("");
          }
        }
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      setMessage(
        error.response?.data?.message ||
          "Error deleting image. Please try again!"
      );
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleDeleteUserLabelFromLabeledList = async (imageId) => {
    if (!selectedDataset) {
      setMessage("Please select a dataset first!");
      return;
    }

    try {
      const response = await axios.delete(
        `/api/dataset/${selectedDataset}/images/${imageId}`
      );

      if (response.status === 200) {
        setImageList((prev) =>
          prev.filter((img) => img._id.toString() !== imageId)
        );
        setTotalImages((prev) => prev - 1);
        setStatsRefreshKey((prev) => prev + 1);
        await loadLabeledImages(pageIndex);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      if (error.response) {
        console.error("Server response:", error.response.data);
        setMessage(
          error.response.data.message ||
            "Error deleting image. Please try again!"
        );
      } else {
        setMessage("Server connection error. Please try again!");
      }
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

    if (!/^[0-9a-fA-F]{24}$/.test(datasetId)) {
      console.error("Invalid dataset ID format:", datasetId);
      setMessage("Invalid Dataset ID!");
      return;
    }
    setSelectedDataset(datasetId);

    const selectedDataset = datasets.find((d) => d._id === datasetId);
    if (selectedDataset) {
      setSelectedDatasetName(selectedDataset.name);
    }
    localStorage.setItem("selectedDataset", datasetId);
  };

  const fetchDatasets = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (!storedUser || !storedUser.id) {
        setMessage("Please login to label images");
        return;
      }
      const response = await axios.get(`/api/dataset?userId=${storedUser.id}`);
      setDatasets(response.data);
      if (response.data.length > 0) {
        const dataset = response.data.find((d) => d._id === selectedDataset);
        if (dataset) {
          setSelectedDatasetName(dataset.name);
        }
      }
    } catch (error) {
      console.error("Error loading dataset list:", error);
      setMessage("Error loading dataset list");
    }
  };

  const handleStopLabeling = async () => {
    if (!selectedDataset) {
      setMessage("Please select a dataset before exporting CSV!");
      return;
    }

    try {
      const response = await axios.get(
        `/api/dataset/${selectedDataset}/export`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${selectedDataset}_labeled_images.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error exporting CSV:", error);
      setMessage("Error exporting CSV. Please try again!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleImageNumberChange = (e) => {
    const number = parseInt(e.target.value);
    if (number && number > 0 && number <= imageList.length) {
      const newIndex = number - 1;
      setCurrentIndex(newIndex);
      loadImage(imageList[newIndex], newIndex);
    }
  };

  return (
    <div className="label-container">
      <div className="main-content">
        <div className="label-section">
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
                  <img src={imageUrl} alt="Image" width="300" />
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
                    <input
                      type="number"
                      min="1"
                      max={imageList.length}
                      value={currentIndex + 1}
                      onChange={handleImageNumberChange}
                      style={{
                        width: "60px",
                        height: "28px",
                        margin: "0 10px",
                        textAlign: "center",
                      }}
                    />
                    <span>/ {imageList.length}</span>
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
                  onFocus={() => setMessage("")}
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
                  await loadImageList();
                  await loadLabeledImages(0);
                  setStatsRefreshKey((k) => k + 1);
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

      <div className="labeled-images-section">
        <h2>Labeled Images</h2>
        <div className="labeled-images-grid">
          {allLabeledImages.map((image, index) => (
            <div key={image._id || index} className="labeled-image-card">
              <img
                src={image.displayUrl}
                alt={`Labeled ${index + 1}`}
                className="labeled-image"
                onError={(e) => {
                  console.error("Error loading image:", image.displayUrl);
                  e.target.src =
                    "https://via.placeholder.com/300x300?text=Error+Loading+Image";
                }}
              />

              <input
                type="text"
                value={image.label || ""}
                onChange={(e) => {
                  const newLabel = e.target.value;
                  setAllLabeledImages((prev) =>
                    prev.map((img) =>
                      img._id === image._id ? { ...img, label: newLabel } : img
                    )
                  );
                }}
                className="label-input"
              />

              <div className="button-group">
                <button
                  className="save-btn"
                  onClick={() => handleSaveRecentLabel(image._id, image.label)}
                >
                  Save
                </button>

                <button
                  className="delete-btn"
                  onClick={() =>
                    handleDeleteUserLabelFromLabeledList(image._id)
                  }
                >
                  <RiDeleteBinLine />
                </button>
              </div>
            </div>
          ))}
        </div>

        {allLabeledImages.length === 0 && (
          <div className="no-images-message">No labeled images found</div>
        )}

        <div className="pagination">
          <button
            onClick={handlePrevPage}
            disabled={pageIndex === 0}
            className="pagination-btn"
          >
            &lt; Prev
          </button>
          <span className="page-info">Page {pageIndex + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={allLabeledImages.length < 6}
            className="pagination-btn"
          >
            Next &gt;
          </button>
        </div>
      </div>
    </div>
  );
});

export default Label;
