# LabelUI

Ứng dụng giao diện người dùng cho việc gán nhãn dữ liệu.

## Yêu cầu hệ thống

- Node.js (phiên bản 14.0.0 trở lên)
- MongoDB (phiên bản 4.0.0 trở lên)
- npm hoặc yarn

## Cấu trúc dự án

```
LabelUI/
├── client/                 # Frontend React app
│   ├── src/               # Source code
│   │   ├── components/    # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── utils/        # Utility functions
│   │   ├── App.js        # Main App component
│   │   └── index.js      # Entry point
│   ├── public/           # Static files
│   └── package.json      # Frontend dependencies
├── server/               # Backend Express app
│   ├── routes/           # API routes
│   ├── models/           # Database models
│   ├── uploads/          # Uploaded files storage
│   ├── gridfs.js         # GridFS configuration
│   ├── index.js          # Server entry point
│   └── package.json      # Backend dependencies
└── package.json          # Root package.json
```

## Cài đặt

### Frontend (client)

```bash
cd client
npm install
npm start
```

### Backend (server)

```bash
cd server
npm install
npm start
```

## Tính năng

### Quản lý người dùng

- Đăng ký tài khoản mới
- Đăng nhập
- Quản lý thông tin cá nhân

### Quản lý Dataset

- Tạo dataset mới
- Upload ảnh vào dataset
- Xem danh sách dataset
- Chỉnh sửa thông tin dataset
- Xóa dataset

### Gán nhãn dữ liệu

- Giao diện gán nhãn trực quan
- Quản lý ảnh đã gán nhãn (CRUD)
- Hỗ trợ nhiều loại nhãn khác nhau

### Thống kê và Báo cáo

- Thống kê số lượng ảnh trong dataset
- Thống kê tiến độ gán nhãn
- Xuất dữ liệu đã gán nhãn ra file CSV

### Tích hợp AI

- Tích hợp chạy model AI trên dữ liệu đã gán nhãn
- Đánh giá kết quả model

## Công nghệ sử dụng

### Frontend

- React.js 18
- React Router DOM
- Axios cho HTTP requests
- SASS cho styling
- React Icons
- React Toastify cho notifications
- CropperJS cho xử lý ảnh
- FontAwesome cho icons

### Backend

- Node.js
- Express.js
- MongoDB với Mongoose
- JWT cho xác thực
- Multer & GridFS cho upload và lưu trữ file
- WebSocket cho real-time features

### Development Tools

- Concurrently cho chạy đồng thời client và server
- Nodemon cho development
- Dotenv cho quản lý biến môi trường
