# Bảng So Sánh Chi Tiết Theo Ngành Dọc (Toàn Hệ Thống)

## Tổng quan

Bảng này hiển thị dữ liệu so sánh lương theo ngành dọc cho toàn hệ thống, khác với bảng so sánh theo ngành dọc hiện tại chỉ hiển thị dữ liệu cho Medlatec Group.

## Cấu trúc dữ liệu

### Bảng dữ liệu nguồn

1. **Bảng Fulltime**
   - Cột `nganh_doc`: Ngành dọc
   - Cột `hn_or_note`: Phân loại Hà Nội/khác
   - Cột `tong_thu_nhap`: Tổng thu nhập
   - Cột `nam`: Năm
   - Cột `thang`: Tháng

2. **Bảng Parttime**
   - Cột `Don vi  2`: Đơn vị 2 (có khoảng trắng)
   - Cột `Tong tien`: Tổng tiền
   - Cột `Nam`: Năm
   - Cột `Thoi gian`: Thời gian

## SQL Functions cần thiết

### 1. get_nganhdoc_ft_salary_hanoi_with_filter

Function này mở rộng từ `get_nganhdoc_ft_salary_hanoi` hiện tại để hỗ trợ bộ lọc theo ngành dọc và hiển thị dữ liệu toàn hệ thống (không chỉ Hà Nội). Function này cũng tự động gộp các đơn vị có tên giống nhau (chỉ khác nhau về chữ hoa/thường hoặc khoảng trắng).

```sql
-- Function: get_nganhdoc_ft_salary_hanoi_with_filter
DROP FUNCTION IF EXISTS get_nganhdoc_ft_salary_hanoi_with_filter(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_nganhdoc_ft_salary_hanoi_with_filter(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    nganh_doc_key TEXT,
    ft_salary NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH normalized_nganh_doc AS (
        SELECT 
            f.*,
            -- Chuẩn hóa tên ngành dọc: loại bỏ khoảng trắng thừa, chuyển về chữ thường
            TRIM(LOWER(COALESCE(f.nganh_doc, 'Chưa phân loại'))) AS normalized_nganh_doc
        FROM "Fulltime" f
        WHERE
            (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
            AND (
                p_filter_nganh_docs IS NULL OR
                array_length(p_filter_nganh_docs, 1) IS NULL OR
                array_length(p_filter_nganh_docs, 1) = 0 OR
                f.nganh_doc = ANY(p_filter_nganh_docs)
            )
    ),
    unique_nganh_doc AS (
        SELECT 
            normalized_nganh_doc AS doc_key,
            SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS NUMERIC)) AS salary_amount
        FROM normalized_nganh_doc
        GROUP BY normalized_nganh_doc
    )
    SELECT doc_key AS nganh_doc_key, salary_amount AS ft_salary
    FROM unique_nganh_doc
    ORDER BY doc_key;
END;
$$;
```

### 2. get_donvi2_pt_salary_with_filter

Function này mở rộng từ `get_donvi2_pt_salary` hiện tại để hỗ trợ bộ lọc theo đơn vị 2. Function này cũng tự động gộp các đơn vị có tên giống nhau (chỉ khác nhau về chữ hoa/thường hoặc khoảng trắng).

```sql
-- Function: get_donvi2_pt_salary_with_filter
DROP FUNCTION IF EXISTS get_donvi2_pt_salary_with_filter(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_donvi2_pt_salary_with_filter(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_donvi2 TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    don_vi_2_key TEXT,
    pt_salary NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH normalized_don_vi_2 AS (
        SELECT 
            pt.*,
            -- Chuẩn hóa tên đơn vị 2: loại bỏ khoảng trắng thừa, chuyển về chữ thường
            TRIM(LOWER(COALESCE(pt."Don vi  2", 'Chưa phân loại'))) AS normalized_don_vi_2
        FROM "Parttime" pt
        WHERE
            (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
            AND (
                p_filter_donvi2 IS NULL OR
                array_length(p_filter_donvi2, 1) IS NULL OR
                array_length(p_filter_donvi2, 1) = 0 OR
                pt."Don vi  2" = ANY(p_filter_donvi2)
            )
    ),
    unique_don_vi_2 AS (
        SELECT 
            normalized_don_vi_2 AS unit_key,
            SUM(CAST(REPLACE("Tong tien"::text, ',', '') AS NUMERIC)) AS salary_amount
        FROM normalized_don_vi_2
        GROUP BY normalized_don_vi_2
    )
    SELECT unit_key AS don_vi_2_key, salary_amount AS pt_salary
    FROM unique_don_vi_2
    ORDER BY unit_key;
END;
$$;
```

## Cập nhật Component

Component `SystemWideNganhDocComparisonTable` cần được cập nhật để sử dụng các functions mới:

```typescript
// Trong fetchDataForYear function
const { data: ftData, error: ftError } = await supabase.rpc('get_nganhdoc_ft_salary_hanoi_with_filter', {
  p_filter_year: year,
  p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
  p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
});

const { data: ptData, error: ptError } = await supabase.rpc('get_donvi2_pt_salary_with_filter', {
  p_filter_year: year,
  p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
  p_filter_donvi2: (selectedDonVi2 && selectedDonVi2.length > 0) ? selectedDonVi2 : null,
});
```

## Khác biệt với bảng hiện tại

1. **Phạm vi dữ liệu**: 
   - Bảng hiện tại: Chỉ hiển thị dữ liệu cho Medlatec Group
   - Bảng mới: Hiển thị dữ liệu toàn hệ thống

2. **Bộ lọc địa điểm**:
   - Bảng hiện tại: Chỉ hiển thị dữ liệu Hà Nội (có điều kiện `hn_or_note = 'Hà Nội'`)
   - Bảng mới: Hiển thị dữ liệu toàn hệ thống (không có điều kiện lọc địa điểm)

3. **Bộ lọc ngành dọc/đơn vị**:
   - Bảng hiện tại: Không hỗ trợ bộ lọc theo ngành dọc/đơn vị 2
   - Bảng mới: Hỗ trợ đầy đủ các bộ lọc

4. **Cấu trúc**:
   - Bảng hiện tại: Có cấu trúc phân cấp phức tạp
   - Bảng mới: Cấu trúc đơn giản, dạng bảng phẳng

5. **Gộp đơn vị trùng lặp**:
   - Bảng hiện tại: Hiển thị riêng biệt các đơn vị có tên giống nhau
   - Bảng mới: Tự động gộp các đơn vị có tên giống nhau (chỉ khác nhau về chữ hoa/thường hoặc khoảng trắng)

## Tính năng gộp đơn vị trùng lặp

Bảng mới có tính năng tự động gộp các đơn vị có tên giống nhau:

### Cách thức hoạt động:
1. **Chuẩn hóa tên**: Sử dụng `TRIM(LOWER(...))` để:
   - Loại bỏ khoảng trắng thừa ở đầu và cuối
   - Chuyển tất cả ký tự về chữ thường
   
2. **Ví dụ gộp**:
   - "Ban kế hoạch" + "Ban Kế hoạch" + "BAN KẾ HOẠCH" → "ban kế hoạch"
   - "Phòng nhân sự" + "Phòng Nhân sự" → "phòng nhân sự"

3. **Tính toán**: Tổng hợp dữ liệu lương của tất cả các đơn vị có tên chuẩn hóa giống nhau

### Lợi ích:
- Giảm thiểu dữ liệu trùng lặp
- Hiển thị tổng quan chính xác hơn
- Dễ dàng phân tích và so sánh

## Lưu ý triển khai

1. Cần tạo các SQL functions mới trước khi cập nhật component
2. Test kỹ các functions mới với dữ liệu thực tế
3. Đảm bảo tương thích ngược với các components khác đang sử dụng functions cũ
4. Cập nhật documentation cho các functions mới
5. Kiểm tra kết quả gộp đơn vị có chính xác không
