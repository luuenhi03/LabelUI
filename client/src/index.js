import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import App from "./App";

const router = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter {...router}>
      <App />
      <ToastContainer />
    </BrowserRouter>
  </React.StrictMode>
);
