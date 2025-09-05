# Dashboard Phân Tích Doanh Thu

## Tổng Quan

Dashboard Phân Tích Doanh Thu là một trang riêng biệt được thiết kế để tập trung vào việc phân tích và theo dõi doanh thu của hệ thống Med Sal. Dashboard này cung cấp các công cụ và biểu đồ chuyên biệt để phân tích doanh thu theo nhiều góc độ khác nhau.

## Tính Năng Chính

### 1. Tổng Quan Doanh Thu
- **RevenueCard**: Hiển thị tổng doanh thu theo thời gian và địa điểm được chọn
- **RevenuePerFTEmployeeCard**: Doanh thu trung bình trên mỗi nhân viên full-time
- **RevenuePerWorkdayCard**: Doanh thu trung bình trên mỗi ngày làm việc
- **LocationSalaryRevenueColumnChart**: Biểu đồ cột so sánh doanh thu theo địa điểm

### 2. Phân Tích Chi Tiết (Đang Phát Triển)
- Phân tích doanh thu theo từng dịch vụ
- Phân tích doanh thu theo nhóm khách hàng
- Phân tích doanh thu theo thời gian trong ngày
- Phân tích doanh thu theo mùa vụ

### 3. So Sánh & KPI
- **ComparisonRevenueCard**: So sánh doanh thu cùng kỳ
- Chỉ tiêu doanh thu (đang phát triển)

### 4. Xu Hướng & Dự Báo (Đang Phát Triển)
- Biểu đồ xu hướng doanh thu theo thời gian
- Dự báo doanh thu dựa trên dữ liệu lịch sử
- Phân tích mùa vụ và chu kỳ kinh doanh
- Cảnh báo khi doanh thu giảm sút

## Cách Truy Cập

### 1. Từ Header
- Click vào nút "Doanh Thu" trên thanh navigator chính
- URL: `/dashboard/revenue`

### 2. Từ Dashboard Chính
- Click vào nút "Dashboard Doanh Thu" trong phần điều hướng
- URL: `/dashboard/revenue`

### 3. Từ Workspace
- Chọn tab "Phân tích doanh thu" trong dashboard tổng hợp

## Bộ Lọc

### Lọc Thời Gian
- Chọn năm cụ thể hoặc tất cả các năm
- Chọn tháng cụ thể hoặc tất cả các tháng
- Hỗ trợ lọc theo nhiều tháng khác nhau

### Lọc Địa Điểm
- Lọc theo loại địa điểm (Loại)
- Lọc theo phòng ban cụ thể (Department)
- Hỗ trợ chọn nhiều địa điểm cùng lúc

## Cấu Trúc File

```
src/app/dashboard/revenue/
├── layout.tsx          # Layout cho dashboard doanh thu
└── page.tsx            # Trang chính của dashboard doanh thu
```

## Các Component Sử Dụng

- `RevenueCard`: Hiển thị tổng doanh thu
- `RevenuePerFTEmployeeCard`: Doanh thu trên nhân viên
- `RevenuePerWorkdayCard`: Doanh thu trên ngày làm việc
- `LocationSalaryRevenueColumnChart`: Biểu đồ doanh thu theo địa điểm
- `ComparisonRevenueCard`: So sánh doanh thu

## Tương Thích

Dashboard này tương thích với:
- Hệ thống xác thực hiện tại
- Bộ lọc thời gian và địa điểm
- Các component UI hiện có
- Responsive design cho mobile và desktop

## Phát Triển Tương Lai

### Giai Đoạn 1 (Hiện Tại)
- ✅ Tổng quan doanh thu cơ bản
- ✅ So sánh doanh thu cùng kỳ
- ✅ Lọc theo thời gian và địa điểm

### Giai Đoạn 2 (Kế Hoạch)
- 🔄 Phân tích chi tiết theo dịch vụ
- 🔄 Phân tích theo nhóm khách hàng
- 🔄 Phân tích theo thời gian trong ngày

### Giai Đoạn 3 (Kế Hoạch)
- 📋 Xu hướng doanh thu
- 📋 Dự báo doanh thu
- 📋 Cảnh báo và thông báo
- 📋 Export báo cáo

## Hỗ Trợ Kỹ Thuật

Nếu gặp vấn đề:
1. Kiểm tra console browser để xem lỗi
2. Đảm bảo đã đăng nhập vào hệ thống
3. Kiểm tra kết nối database
4. Liên hệ team phát triển

## Ghi Chú

- Dashboard này hoạt động độc lập với dashboard tổng hợp
- Tất cả dữ liệu được lấy từ cùng nguồn database
- Các bộ lọc được đồng bộ với dashboard chính
- Responsive design hỗ trợ mọi kích thước màn hình

