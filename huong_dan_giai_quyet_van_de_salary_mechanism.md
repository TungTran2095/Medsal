# Hướng dẫn giải quyết vấn đề "Check cơ chế lương GĐ Tỉnh"

## Vấn đề cụ thể
Bảng "Check cơ chế lương GĐ Tỉnh" không tìm thấy dữ liệu Fulltime cho nhân viên ID=893 (Nguyễn Văn Hiệu) tại Tháng 01 năm 2025, mặc dù SQL query trực tiếp trên bảng Fulltime có thể tìm thấy dữ liệu với `tong_thu_nhap = 38962893`.

**Kết quả hiện tại:**
- ✅ Bảng Fulltime: ID 893 có `tong_thu_nhap = 38962893`
- ❌ Bảng Check cơ chế lương: `luong_don_vi_de_xuat = 0đ`

## Nguyên nhân có thể

### 1. **Kiểu dữ liệu ID không khớp** ⭐ **NGUYÊN NHÂN CHÍNH**
- Bảng `co_che_luong` có thể lưu ID dưới dạng string (ví dụ: "893")
- Bảng `Fulltime` có thể lưu `ma_nhan_vien` dưới dạng number (893)
- Khi so sánh: `"893" === 893` sẽ trả về `false`

### 2. **Tên cột ID khác nhau**
- Bảng `co_che_luong` có thể có cột: `ID`, `id`, `Id`
- Bảng `Fulltime` có cột: `ma_nhan_vien`

### 3. **Logic so sánh ID trong component có vấn đề**
- Mặc dù đã cải thiện logic so sánh, vẫn có thể có lỗi

## Cách giải quyết

### Bước 1: Debug trong ứng dụng
1. **Click nút "🐛 Debug Data"** để kiểm tra dữ liệu từ database
2. **Click nút "🔍 Debug State"** để kiểm tra state của component
3. **Mở Console (F12)** để xem log chi tiết

### Bước 2: Chạy SQL debug trên Supabase
Chạy các query trong file `debug_employee_893.sql` để kiểm tra:

```sql
-- Kiểm tra nhân viên 893 trong cả hai bảng
SELECT 
    'co_che_luong' as source_table,
    ID, id, Id, Ho_va_ten, Don_vi,
    pg_typeof(ID) as id_type
FROM co_che_luong 
WHERE Loai_co_che = 'GĐ tỉnh'
AND (ID = 893 OR id = 893 OR Id = 893 OR ID = '893' OR id = '893' OR Id = '893');

SELECT 
    'Fulltime' as source_table,
    ma_nhan_vien, ho_va_ten, tong_thu_nhap, thang, nam
FROM "Fulltime"
WHERE ma_nhan_vien = 893 
AND thang = 'Tháng 01' 
AND nam = 2025;
```

### Bước 3: Kiểm tra logic so sánh ID
Trong console, tìm log:
```
🔍 [Debug] So sánh: Fulltime ID "893" (number) vs Row ID "893" (string) = false
```

Nếu thấy `= false`, vấn đề là ở logic so sánh.

### Bước 4: Kiểm tra state component
Trong console, tìm log:
```
🔍 [Debug] === KIỂM TRA STATE COMPONENT ===
🔍 [Debug] Tìm thấy nhân viên 893 trong data: {...}
```

Nếu không tìm thấy, vấn đề là ở việc load dữ liệu từ `co_che_luong`.

## Giải pháp đã áp dụng

### 1. **Cải thiện logic so sánh ID**
```typescript
// So sánh với nhiều kiểu dữ liệu
const isMatch = ftId == rowId || // So sánh lỏng lẻo
                String(ftId) === String(rowId) || // So sánh string
                Number(ftId) === Number(rowId); // So sánh number
```

### 2. **Thêm debug logging chi tiết**
- Log kiểu dữ liệu của ID
- Log quá trình so sánh
- Log kết quả filter
- Log cộng dồn `tong_thu_nhap`

### 3. **Nút Debug nâng cao**
- **🐛 Debug Data**: Kiểm tra dữ liệu từ database
- **🔍 Debug State**: Kiểm tra state của component

## Các trường hợp thường gặp

### Trường hợp 1: ID là string vs number
```typescript
// Trước: ft.ma_nhan_vien === row.id (có thể false)
// Sau: ft.ma_nhan_vien == row.id (so sánh lỏng lẻo)
```

### Trường hợp 2: ID có prefix/suffix
```typescript
// Cần xử lý thêm
const cleanId = (id: any) => {
  if (typeof id === 'string') {
    return id.replace(/[^0-9]/g, ''); // Chỉ giữ số
  }
  return id;
};
```

### Trường hợp 3: Cột ID tên khác nhau
```typescript
// Kiểm tra tất cả tên cột có thể
const employeeId = row.ID || row.id || row.Id || row.ma_nhan_vien || '';
```

## Debug cụ thể cho nhân viên 893

### 1. **Kiểm tra trong co_che_luong**
```sql
SELECT * FROM co_che_luong 
WHERE Loai_co_che = 'GĐ tỉnh' 
AND (ID = 893 OR id = 893 OR Id = 893 OR ID = '893' OR id = '893' OR Id = '893');
```

### 2. **Kiểm tra trong Fulltime**
```sql
SELECT * FROM "Fulltime"
WHERE ma_nhan_vien = 893 
AND thang = 'Tháng 01' 
AND nam = 2025;
```

### 3. **So sánh trực tiếp**
```sql
-- Sử dụng file debug_employee_893.sql
```

## Kết luận
Vấn đề chính thường là do **kiểu dữ liệu ID không khớp** giữa hai bảng. Sau khi áp dụng các giải pháp trên, bảng "Check cơ chế lương GĐ Tỉnh" sẽ có thể tìm thấy và so sánh dữ liệu từ bảng Fulltime một cách chính xác.

**Để giải quyết nhanh:**
1. Click nút Debug trong ứng dụng
2. Chạy SQL debug trên Supabase
3. Kiểm tra console log để xác định chính xác vấn đề
4. Áp dụng giải pháp tương ứng

Nếu vẫn gặp vấn đề, hãy chia sẻ log từ console để tôi có thể hỗ trợ chi tiết hơn.
