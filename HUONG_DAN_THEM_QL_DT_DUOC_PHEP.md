# Hướng dẫn thêm đường line QL/DT được phép vào chart "Tỷ lệ lương/doanh thu theo địa điểm"

## Tổng quan
Đã thêm thành công đường line mới thể hiện **QL/DT được phép** vào chart "Tỷ lệ lương/doanh thu theo địa điểm", giống với dữ liệu trong bảng "Phân Tích Lương Tổng Hợp".

## Các thay đổi đã thực hiện

### 1. Tạo SQL Function mới
**File:** `get_salary_revenue_ratio_by_location_function.sql`

- Tạo function `get_salary_revenue_ratio_by_location` với đầy đủ tham số filter
- Thêm trường `ty_le_ql_dt_duoc_phep` tính từ bảng `Chi_tieu_2025`
- Công thức: `KPI_quy_luong_2025 / Chi_tieu_DT`

### 2. Cập nhật Chart Component
**File:** `src/components/charts/LocationSalaryRevenueColumnChart.tsx`

#### Thay đổi Interface:
```typescript
interface SalaryRevenueRatioData {
  // ... các trường cũ
  ty_le_ql_dt_duoc_phep: number; // Thêm trường mới
}
```

#### Thêm Chart Config:
```typescript
const chartConfig = {
  // ... các config cũ
  ty_le_ql_dt_duoc_phep: {
    label: 'QL/DT được phép (%)',
    color: 'hsl(var(--chart-3))', 
    icon: TrendingUp,
  },
}
```

#### Thêm Line Chart:
```typescript
<Line 
  type="monotone" 
  dataKey="ty_le_ql_dt_duoc_phep" 
  stroke="var(--color-ty_le_ql_dt_duoc_phep)" 
  strokeWidth={3}
  strokeDasharray="5 5"  // Đường nét đứt để phân biệt
  dot={{ fill: 'var(--color-ty_le_ql_dt_duoc_phep)', strokeWidth: 2, r: 4 }}
  activeDot={{ r: 6, stroke: 'var(--color-ty_le_ql_dt_duoc_phep)', strokeWidth: 2 }}
  name={chartConfig.ty_le_ql_dt_duoc_phep.label}
/>
```

### 3. Cập nhật Tooltip và Legend
- Tooltip hiển thị đầy đủ 3 tỷ lệ: Tổng, FT, QL/DT
- Legend hiển thị 3 đường line với màu sắc khác nhau
- Mô tả chart được cập nhật

## Cách deploy

### Bước 1: Deploy SQL Function
```bash
node deploy_salary_revenue_ratio_function.js
```

### Bước 2: Kiểm tra kết quả
- Mở chart "Tỷ lệ lương/doanh thu theo địa điểm"
- Xác nhận có 3 đường line:
  1. **Tỷ lệ tổng lương/doanh thu** (đường liền)
  2. **Tỷ lệ lương Fulltime/doanh thu** (đường liền)
  3. **QL/DT được phép** (đường nét đứt)

## Tính năng mới

### 1. Đường line QL/DT được phép
- **Màu sắc:** Màu thứ 3 trong theme (chart-3)
- **Kiểu đường:** Nét đứt (strokeDasharray="5 5")
- **Dữ liệu:** Lấy từ bảng `Chi_tieu_2025` với công thức `KPI_quy_luong_2025 / Chi_tieu_DT`

### 2. Tooltip cải tiến
- Hiển thị đầy đủ 3 tỷ lệ cho mỗi địa điểm
- Format: `Địa điểm (Tổng: X%, FT: Y%, QL/DT: Z%)`

### 3. Legend tự động
- Hiển thị 3 đường line với icon và màu sắc tương ứng
- Tự động điều chỉnh layout

## Lưu ý kỹ thuật

### 1. SQL Function
- Hỗ trợ đầy đủ các filter: năm, tháng, địa điểm, ngành dọc, đơn vị 2
- JOIN với bảng `Chi_tieu_2025` để lấy QL/DT được phép
- Xử lý trường hợp dữ liệu null/0

### 2. Chart Component
- Tự động tính toán Y-axis domain dựa trên giá trị lớn nhất của 3 đường line
- Xử lý dữ liệu null/undefined
- Responsive design

### 3. Performance
- Sử dụng useMemo để tối ưu tính toán Y-axis domain
- Dynamic import cho LineChart component
- Efficient data processing

## Kết quả mong đợi

Sau khi deploy, chart sẽ hiển thị:
- **3 đường line** với màu sắc và kiểu khác nhau
- **Tooltip chi tiết** với đầy đủ thông tin
- **Legend rõ ràng** phân biệt từng đường line
- **Dữ liệu QL/DT được phép** giống với bảng "Phân Tích Lương Tổng Hợp"

## Troubleshooting

### Nếu không thấy đường line QL/DT được phép:
1. Kiểm tra SQL function đã được deploy chưa
2. Kiểm tra dữ liệu trong bảng `Chi_tieu_2025`
3. Kiểm tra console log để xem có lỗi không

### Nếu dữ liệu QL/DT = 0:
1. Kiểm tra bảng `Chi_tieu_2025` có dữ liệu không
2. Kiểm tra mapping giữa tên địa điểm
3. Kiểm tra công thức tính toán trong SQL function
