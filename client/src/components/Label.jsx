import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "../utils/axios";
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
    axios
      .get(`/api/dataset/${datasetId}/images/${imageId}/label-stats`)
      .then((res) => res.data)
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
        `/api/dataset/${selectedDataset}/images?type=all`
      );
      console.log("Response data:", response.data);

      if (!response.data) {
        console.error("No data in response");
        setMessage("Error: No data received from server");
        return;
      }

      if (!Array.isArray(response.data)) {
        console.error("Response data is not an array:", response.data);
        setMessage("Error: Invalid data format from server");
        return;
      }

      setImageList(response.data);
      setTotalImages(response.data.length);
      setMessage("");

      // If we have images and no image is selected, load the first one
      if (response.data.length > 0 && !selectedImage) {
        loadImage(response.data[0], 0);
      }
    } catch (error) {
      console.error("Error loading image list:", error);
      console.error("Error details:", error.response?.data);
      setImageList([]);
      setMessage(
        error.response?.data?.message ||
          "Error loading images. Please try again!"
      );
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
    if (!selectedImage || !label) return;

    try {
      await axios.put(
        `/api/dataset/${selectedDataset}/images/${selectedImage._id}`,
        {
          label,
          labeledBy: storedUser.id,
        }
      );

      loadLabeledImages(pageIndex);
      setLabel("");
      handleNextImage();
    } catch (error) {
      console.error("Error saving label:", error);
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
        `/api/dataset/${selectedDataset}/images/${imageId}/label`,
        {
          label: newLabel.trim(),
          userId: storedUser.id,
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
    try {
      const response = await axios.get(
        `/api/dataset/${selectedDataset}/labeled?page=${page}`
      );
      setLatestLabeled(response.data.images);
      setAllLabeledImages(response.data.total);
      setPageIndex(page);
    } catch (error) {
      console.error("Error loading labeled images:", error);
    }
  };

  const handleDeleteImageFromDataset = async (imageId) => {
    try {
      await axios.delete(`/api/dataset/${selectedDataset}/images/${imageId}`);
      loadImageList();
      loadLabeledImages(pageIndex);
    } catch (error) {
      console.error("Error deleting image:", error);
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
    }
  };

  const handleStopLabeling = async () => {
    if (!selectedDataset) {
      alert("Please select a dataset before exporting CSV!");
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

      setMessage("CSV exported successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      setMessage("Error exporting CSV. Please try again!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("selectedDataset");
    navigate("/login");
  };

  const handleResetLabel = async (imageId) => {
    try {
      await axios.delete(
        `/api/dataset/${selectedDataset}/images/${imageId}/label`
      );
      loadLabeledImages(pageIndex);
    } catch (error) {
      console.error("Error resetting label:", error);
    }
  };

  const handleHideFromMainList = (imageId) => {
    setImageList((prevList) => {
      const newList = prevList.filter((image) => image._id !== imageId);

      const deletedIndex = prevList.findIndex((img) => img._id === imageId);

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

  const handleDeleteUserLabelFromLabeledList = async (imageId) => {
    try {
      await axios.delete(
        `/api/dataset/${selectedDataset}/images/${imageId}/user-label/${storedUser.id}`
      );
      loadLabeledImages(pageIndex);
    } catch (error) {
      console.error("Error deleting user label:", error);
    }
  };

  console.log("latestLabeled", latestLabeled);

  return (
    <>
      <div className="main-content">
        <div className="label-section">
          {}
          {uploadComponent
            ? React.cloneElement(uploadComponent, {
                onUploadSuccess: loadImageList,
              })
            : null}
          <div className="label-header">
            <h2>Label Image</h2>
            <select
              value={selectedDataset}
              onChange={handleDatasetChange}
              className="dataset-select"
            >
              <option value="">Select dataset...</option>
              {datasets.map((ds) => (
                <option key={ds._id} value={ds._id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>
          {message && <div className="message">{message}</div>}
          {!selectedDataset ? (
            <div className="no-dataset-message">
              Please select a dataset to start labeling
            </div>
          ) : imageList.length === 0 ? (
            <div className="no-images-message">No images left to label</div>
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

      {}
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
                {img.isCropped && <div className="cropped-badge">Cropped</div>}
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
                    onClick={() =>
                      handleDeleteUserLabelFromLabeledList(img._id)
                    }
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
    </>
  );
});

export default Label;
