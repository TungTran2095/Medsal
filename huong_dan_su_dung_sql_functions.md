# Hướng dẫn sử dụng SQL Functions để Debug vấn đề "Lương đơn vị đề xuất"

## 🎯 **Mục đích**
Kiểm tra tại sao một số ID trong bảng Check cơ chế lương GĐ Tỉnh không hiện số liệu ở cột "Lương đơn vị đề xuất".

## 📋 **Các Function có sẵn**

### 1. **Kiểm tra dữ liệu Fulltime theo tháng/năm**
```sql
SELECT * FROM check_fulltime_data_by_month_year('05', '2025');
```
- **Mục đích**: Xem có bao nhiêu bản ghi Fulltime cho tháng 05, năm 2025
- **Kết quả mong đợi**: Nếu có dữ liệu, sẽ thấy các bản ghi với `thang = 'Tháng 05'` và `nam = '2025'`

### 2. **Kiểm tra dữ liệu Fulltime cho một nhân viên cụ thể**
```sql
SELECT * FROM check_fulltime_data_by_employee('001', '05', '2025');
```
- **Mục đích**: Xem nhân viên có ID '001' có dữ liệu Fulltime cho tháng 05, năm 2025 không
- **Kết quả mong đợi**: Nếu có dữ liệu, sẽ thấy `record_count > 0` và `total_salary > 0`

### 3. **So sánh dữ liệu giữa co_che_luong và Fulltime**
```sql
SELECT * FROM compare_salary_data('05', '2025');
```
- **Mục đích**: Xem tất cả nhân viên GĐ tỉnh và trạng thái dữ liệu Fulltime
- **Kết quả mong đợi**: 
  - `status = 'CÓ DỮ LIỆU'` → Nhân viên có dữ liệu Fulltime
  - `status = 'KHÔNG CÓ DỮ LIỆU'` → Nhân viên không có dữ liệu Fulltime

### 4. **Kiểm tra tất cả các định dạng tháng có trong bảng Fulltime**
```sql
SELECT * FROM check_fulltime_month_formats();
```
- **Mục đích**: Xem bảng Fulltime có những tháng nào
- **Kết quả mong đợi**: Sẽ thấy các tháng như "Tháng 01", "Tháng 02", "Tháng 05"...

### 5. **Kiểm tra mapping giữa ID và ma_nhan_vien**
```sql
SELECT * FROM check_id_mapping('05', '2025');
```
- **Mục đích**: Xem chi tiết mapping giữa bảng co_che_luong và Fulltime
- **Kết quả mong đợi**:
  - `mapping_status = 'MATCH'` → Tìm thấy dữ liệu Fulltime
  - `mapping_status = 'NO MATCH'` → Không tìm thấy dữ liệu Fulltime

## 🔍 **Quy trình Debug**

### **Bước 1: Kiểm tra dữ liệu Fulltime có sẵn**
```sql
SELECT * FROM check_fulltime_month_formats();
```
- Xác nhận có dữ liệu cho tháng/năm bạn muốn kiểm tra

### **Bước 2: Kiểm tra dữ liệu Fulltime cho tháng/năm cụ thể**
```sql
SELECT * FROM check_fulltime_data_by_month_year('05', '2025');
```
- Xem có bao nhiêu bản ghi Fulltime cho tháng 05, năm 2025

### **Bước 3: So sánh tổng thể**
```sql
SELECT * FROM compare_salary_data('05', '2025');
```
- Xem tất cả nhân viên GĐ tỉnh và trạng thái dữ liệu Fulltime

### **Bước 4: Kiểm tra chi tiết cho nhân viên cụ thể**
```sql
SELECT * FROM check_fulltime_data_by_employee('001', '05', '2025');
```
- Thay '001' bằng ID nhân viên bạn muốn kiểm tra

## 🚨 **Các nguyên nhân có thể gây ra vấn đề**

### 1. **Không có dữ liệu Fulltime cho tháng/năm được chọn**
- **Triệu chứng**: `check_fulltime_data_by_month_year()` trả về 0 bản ghi
- **Giải pháp**: Kiểm tra xem có dữ liệu Fulltime cho tháng/năm đó không

### 2. **Mapping ID không khớp**
- **Triệu chứng**: `check_id_mapping()` cho thấy `mapping_status = 'NO MATCH'`
- **Nguyên nhân**: ID trong bảng `co_che_luong` không khớp với `ma_nhan_vien` trong bảng `Fulltime`
- **Giải pháp**: Kiểm tra định dạng ID, có thể cần chuyển đổi kiểu dữ liệu

### 3. **Định dạng tháng/năm không khớp**
- **Triệu chứng**: Dữ liệu có sẵn nhưng không tìm thấy
- **Nguyên nhân**: Định dạng tháng/năm trong bảng Fulltime khác với logic tìm kiếm
- **Giải pháp**: Kiểm tra định dạng thực tế trong bảng Fulltime

## 📝 **Ví dụ Debug cụ thể**

### **Trường hợp 1: Không có dữ liệu Fulltime cho tháng 05, năm 2025**
```sql
-- Kiểm tra xem có dữ liệu gì cho tháng 05, năm 2025
SELECT * FROM check_fulltime_data_by_month_year('05', '2025');

-- Nếu không có, kiểm tra xem có tháng nào khác không
SELECT * FROM check_fulltime_month_formats();
```

### **Trường hợp 2: Nhân viên có ID '001' không hiện số liệu**
```sql
-- Kiểm tra dữ liệu Fulltime cho nhân viên này
SELECT * FROM check_fulltime_data_by_employee('001', '05', '2025');

-- Kiểm tra mapping
SELECT * FROM check_id_mapping('05', '2025');
```

### **Trường hợp 3: So sánh tổng thể**
```sql
-- Xem tất cả nhân viên và trạng thái dữ liệu
SELECT * FROM compare_salary_data('05', '2025');
```

## ✅ **Kết quả mong đợi sau khi sửa**

1. **Có dữ liệu Fulltime**: `check_fulltime_data_by_month_year()` trả về > 0 bản ghi
2. **Mapping thành công**: `check_id_mapping()` cho thấy `mapping_status = 'MATCH'`
3. **So sánh thành công**: `compare_salary_data()` cho thấy `status = 'CÓ DỮ LIỆU'`
4. **Bảng hiển thị đúng**: Cột "Lương đơn vị đề xuất" hiển thị số liệu chính xác

## 🔧 **Lưu ý quan trọng**

- **Định dạng tháng**: Bảng Fulltime sử dụng định dạng "Tháng 01", "Tháng 02"... (không phải "01", "02"...)
- **Định dạng năm**: Bảng Fulltime sử dụng định dạng "2024", "2025" (string)
- **Mapping**: ID trong bảng `co_che_luong` phải khớp với `ma_nhan_vien` trong bảng `Fulltime`
- **Tổng hợp**: Một nhân viên có thể có nhiều bản ghi Fulltime, cần tính tổng `tong_thu_nhap`
