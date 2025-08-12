# Chức Năng Nút Mở Rộng - Bảng Lương Chi Tiết Nhân Viên

## Tổng quan

Đã thêm chức năng nút mở rộng cho bảng lương chi tiết nhân viên (YoY) trong tab "Chi tiết lương của hệ thống". Chức năng này tương tự như nút mở rộng trong bảng "Ranking các bác sĩ theo chỉ số" thuộc tab "Phân tích lương bác sĩ".

## Tính năng mới

### 1. Nút mở rộng
- Mỗi dòng trong bảng có một nút mở rộng (chevron icon)
- Click vào nút để mở rộng/collapse thông tin chi tiết
- Icon thay đổi từ `ChevronRight` (>) thành `ChevronDown` (v) khi mở rộng

### 2. Thông tin hành chính
- Hiển thị tất cả thông tin từ bảng `MS_CBNV` cho nhân viên được chọn
- Dữ liệu được hiển thị dạng grid với 2-3 cột tùy theo kích thước màn hình
- Format: `Tên trường: Giá trị`

### 3. Biểu đồ lương Fulltime theo tháng
- **Biểu đồ 1**: Lương theo tháng (năm hiện tại)
  - Line chart hiển thị lương từng tháng
  - Sử dụng dữ liệu từ bảng `Fulltime`
  - Tooltip hiển thị giá trị lương rút gọn (VD: 2tr, 500k)

- **Biểu đồ 2**: Lương/Công theo tháng (so sánh 2 năm)
  - Line chart so sánh lương/công giữa năm hiện tại và năm trước
  - Màu xanh: Năm hiện tại
  - Màu cam: Năm ngoái
  - Tooltip hiển thị giá trị lương/công rút gọn

## Cách hoạt động

### 1. Fetch dữ liệu
- **Thông tin hành chính**: Gọi `fetchEmployeeDetail()` để lấy dữ liệu từ bảng `MS_CBNV`
- **Dữ liệu lương tháng**: Gọi `fetchSalaryMonthData()` để lấy dữ liệu từ bảng `Fulltime`

### 2. Xử lý dữ liệu
- Tự động xác định năm mới nhất từ bảng `Fulltime`
- Tính toán tổng lương và tổng công cho từng tháng
- Tính lương/công = Tổng lương / Tổng công
- So sánh dữ liệu giữa năm hiện tại và năm trước

### 3. Hiển thị
- Dữ liệu được cache trong state để tránh fetch lại
- Hiệu ứng animation `animate-slideDown` khi mở rộng
- Responsive design cho các kích thước màn hình khác nhau

## Cấu trúc dữ liệu

### Bảng MS_CBNV
- Cột chính: `Mã nhân viên` (khóa ngoại)
- Chứa thông tin hành chính của nhân viên

### Bảng Fulltime
- Cột chính: `ma_nhan_vien`, `nam`, `thang`
- Cột lương: `tong_thu_nhap`
- Cột công: `ngay_thuong_chinh_thuc`, `ngay_thuong_thu_viec`, `nghi_tuan`, `le_tet`, etc.

## CSS Animation

```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 1000px;
  }
}

.animate-slideDown {
  animation: slideDown 0.3s ease-out forwards;
}
```

## Sử dụng

1. Mở tab "Chi tiết lương của hệ thống"
2. Chọn bộ lọc (năm, tháng, địa điểm, ngành dọc)
3. Click vào nút mở rộng (>) ở đầu dòng muốn xem chi tiết
4. Xem thông tin hành chính và biểu đồ lương theo tháng
5. Click lại để đóng (collapse)

## Lưu ý

- Dữ liệu được fetch tự động khi mở rộng lần đầu
- Dữ liệu được cache để tăng hiệu suất
- Biểu đồ responsive và hiển thị tốt trên mọi kích thước màn hình
- Sử dụng thư viện Recharts cho biểu đồ
- Hỗ trợ cả light mode và dark mode
