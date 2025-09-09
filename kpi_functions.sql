-- RPC Functions for KPI 2025 Comparison Tables
-- These functions combine salary data with Chi_tieu_2025 table data

-- Function: get_nganhdoc_salary_kpi_2025_hanoi
-- Returns salary data for Hanoi units with KPI targets from Chi_tieu_2025
DROP FUNCTION IF EXISTS get_nganhdoc_salary_kpi_2025_hanoi(INTEGER, INTEGER[]);
CREATE OR REPLACE FUNCTION get_nganhdoc_salary_kpi_2025_hanoi(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
    department_name TEXT,
    ft_salary_2025 NUMERIC,
    pt_salary_2025 NUMERIC,
    total_salary_2025 NUMERIC,
    quy_cung_2025 NUMERIC,
    so_thang_da_chia INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH salary_data AS (
        -- Get FT salary data for Hanoi - sử dụng nganh_doc và dia_diem
        SELECT 
            CASE 
                WHEN f.nganh_doc = 'Hệ thống khám chữa bệnh' THEN
                    CASE 
                        WHEN f.dia_diem = 'Med Ba Đình' THEN 'Bệnh viện đa khoa Medlatec'
                        WHEN f.dia_diem = 'Med Cầu Giấy' THEN 'Phòng Khám đa khoa Cầu Giấy'
                        WHEN f.dia_diem = 'Med Tây Hồ' THEN 'Phòng Khám đa khoa Tây Hồ'
                        WHEN f.dia_diem = 'Med Thanh Xuân' THEN 'Phòng Khám đa khoa Thanh Xuân'
                        ELSE f.dia_diem
                    END
                ELSE COALESCE(f.nganh_doc, 'Chưa phân loại')
            END AS department_name,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary_2025,
            0 AS pt_salary_2025
        FROM "Fulltime" f
        WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
            AND f.hn_or_not = 'Hà Nội'
        GROUP BY 
            CASE 
                WHEN f.nganh_doc = 'Hệ thống khám chữa bệnh' THEN
                    CASE 
                        WHEN f.dia_diem = 'Med Ba Đình' THEN 'Bệnh viện đa khoa Medlatec'
                        WHEN f.dia_diem = 'Med Cầu Giấy' THEN 'Phòng Khám đa khoa Cầu Giấy'
                        WHEN f.dia_diem = 'Med Tây Hồ' THEN 'Phòng Khám đa khoa Tây Hồ'
                        WHEN f.dia_diem = 'Med Thanh Xuân' THEN 'Phòng Khám đa khoa Thanh Xuân'
                        ELSE f.dia_diem
                    END
                ELSE COALESCE(f.nganh_doc, 'Chưa phân loại')
            END
        
        UNION ALL
        
        -- Get PT salary data - sử dụng Don vi 2 và Don vi
        SELECT 
            CASE 
                WHEN pt."Don vi  2" = 'Hệ thống khám chữa bệnh' THEN
                    CASE 
                        WHEN pt."Don vi" = 'Med Ba Đình' THEN 'Bệnh viện đa khoa Medlatec'
                        WHEN pt."Don vi" = 'Med Cầu Giấy' THEN 'Phòng Khám đa khoa Cầu Giấy'
                        WHEN pt."Don vi" = 'Med Tây Hồ' THEN 'Phòng Khám đa khoa Tây Hồ'
                        WHEN pt."Don vi" = 'Med Thanh Xuân' THEN 'Phòng Khám đa khoa Thanh Xuân'
                        ELSE pt."Don vi"
                    END
                ELSE COALESCE(pt."Don vi  2", 'Chưa phân loại')
            END AS department_name,
            0 AS ft_salary_2025,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary_2025
        FROM "Parttime" pt
        WHERE (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
        GROUP BY 
            CASE 
                WHEN pt."Don vi  2" = 'Hệ thống khám chữa bệnh' THEN
                    CASE 
                        WHEN pt."Don vi" = 'Med Ba Đình' THEN 'Bệnh viện đa khoa Medlatec'
                        WHEN pt."Don vi" = 'Med Cầu Giấy' THEN 'Phòng Khám đa khoa Cầu Giấy'
                        WHEN pt."Don vi" = 'Med Tây Hồ' THEN 'Phòng Khám đa khoa Tây Hồ'
                        WHEN pt."Don vi" = 'Med Thanh Xuân' THEN 'Phòng Khám đa khoa Thanh Xuân'
                        ELSE pt."Don vi"
                    END
                ELSE COALESCE(pt."Don vi  2", 'Chưa phân loại')
            END
    ),
    aggregated_salary AS (
        SELECT 
            -- Chuẩn hóa tên đơn vị dựa trên cấu trúc thực tế
            CASE 
                -- Ban Tổng Giám đốc
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban tổng giám đốc%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban tong giam doc%'
                THEN 'Ban Tổng Giám đốc'
                
                -- Ban kế toán
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban kế toán%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban ke toan%'
                THEN 'Ban kế toán'
                
                -- Ban Ngân Quỹ
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban ngân quỹ%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban ngan quy%'
                THEN 'Ban Ngân Quỹ'
                
                -- Ban Tài chính
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban tài chính%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban tai chinh%'
                THEN 'Ban Tài chính'
                
                -- Ban Công nghệ thông tin và Chuyển đổi số
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban công nghệ thông tin%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban cong nghe thong tin%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban công nghệ thông tin và chuyển đổi số%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban cong nghe thong tin va chuyen doi so%'
                THEN 'Ban Công nghệ thông tin và Chuyển đổi số'
                
                -- Ban Kiểm soát
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban kiểm soát%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban kiem soat%'
                THEN 'Ban Kiểm soát'
                
                -- Ban Tổ chức Pháp chế
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban tổ chức pháp chế%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban to chuc phap che%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban tổ chức pháp chế%'
                THEN 'Ban Tổ chức Pháp chế'
                
                -- Trung tâm Marketing
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm marketing%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam marketing%'
                THEN 'Trung tâm Marketing'
                
                -- Ban Trải nghiệm khách hàng
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban trải nghiệm khách hàng%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban trai nghiem khach hang%'
                THEN 'Ban Trải nghiệm khách hàng'
                
                -- Trung tâm kinh doanh BV/PK
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm kinh doanh bv/pk%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam kinh doanh bv/pk%'
                THEN 'Trung tâm kinh doanh BV/PK'
                
                -- Trung tâm tại nhà toàn quốc
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm tại nhà toàn quốc%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam tai nha toan quoc%'
                THEN 'Trung tâm tại nhà toàn quốc'
                
                -- Trung tâm KHDN
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm khdn%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam khdn%'
                THEN 'Trung tâm KHDN'
                
                -- Trung tâm Khách hàng chiến lược và Dự án y tế
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm khách hàng chiến lược%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam khach hang chien luoc%'
                THEN 'Trung tâm Khách hàng chiến lược và Dự án y tế'
                
                -- Trung tâm phát triển Đối tác và Bảo hiểm
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm phát triển đối tác%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam phat trien doi tac%'
                THEN 'Trung tâm phát triển Đối tác và Bảo hiểm'
                
                -- Ban kế hoạch
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban kế hoạch%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban ke hoach%'
                THEN 'Ban kế hoạch'
                
                -- Hệ thống CĐHA TDCN
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống cđha tdcn%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong cdha tdcn%'
                THEN 'Hệ thống CĐHA TDCN'
                
                -- Hệ thống giải phẫu bệnh
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống giải phẫu bệnh%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong giai phau benh%'
                THEN 'Hệ thống giải phẫu bệnh'
                
                -- Hệ thống KCB ngoại viện
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống kcb ngoại viện%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong kcb ngoai vien%'
                THEN 'Hệ thống KCB ngoại viện'
                
                -- Hệ thống khám chữa bệnh
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống khám chữa bệnh%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong kham chua benh%'
                THEN 'Hệ thống khám chữa bệnh'
                
                -- Bệnh viện đa khoa Medlatec
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%bệnh viện đa khoa medlatec%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%benh vien da khoa medlatec%'
                THEN 'Bệnh viện đa khoa Medlatec'
                
                -- Phòng Khám đa khoa Cầu Giấy
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng khám đa khoa cầu giấy%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong kham da khoa cau giay%'
                THEN 'Phòng Khám đa khoa Cầu Giấy'
                
                -- Phòng Khám đa khoa Tây Hồ
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng khám đa khoa tây hồ%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong kham da khoa tay ho%'
                THEN 'Phòng Khám đa khoa Tây Hồ'
                
                -- Phòng Khám đa khoa Thanh Xuân
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng khám đa khoa thanh xuân%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong kham da khoa thanh xuan%'
                THEN 'Phòng Khám đa khoa Thanh Xuân'
                
                -- Hệ thống Xét nghiệm
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống xét nghiệm%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong xet nghiem%'
                THEN 'Hệ thống Xét nghiệm'
                
                -- Ban Hậu cần - Dự án
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban hậu cần%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban hau can%'
                THEN 'Ban Hậu cần - Dự án'
                
                -- Phòng Cung ứng
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng cung ứng%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong cung ung%'
                THEN 'Phòng Cung ứng'
                
                -- Phòng dự án
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng dự án%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong du an%'
                THEN 'Phòng dự án'
                
                -- Phòng Hành chính HCDA
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng hành chính hcda%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong hanh chinh hcda%'
                THEN 'Phòng Hành chính HCDA'
                
                -- Phòng Trang thiết bị - Kỹ thuật
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng trang thiết bị%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong trang thiet bi%'
                THEN 'Phòng Trang thiết bị - Kỹ thuật'
                
                -- Phòng kế toán Med VN
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng kế toán med vn%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong ke toan med vn%'
                THEN 'Phòng kế toán Med VN'
                
                -- Các đơn vị khác giữ nguyên
                ELSE TRIM(salary_data.department_name)
            END AS department_name,
            SUM(salary_data.ft_salary_2025) AS ft_salary_2025,
            SUM(salary_data.pt_salary_2025) AS pt_salary_2025,
            SUM(salary_data.ft_salary_2025 + salary_data.pt_salary_2025) AS total_salary_2025
        FROM salary_data
        GROUP BY 
            -- Chuẩn hóa tên đơn vị dựa trên cấu trúc thực tế
            CASE 
                -- Ban Tổng Giám đốc
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban tổng giám đốc%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban tong giam doc%'
                THEN 'Ban Tổng Giám đốc'
                
                -- Ban kế toán
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban kế toán%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban ke toan%'
                THEN 'Ban kế toán'
                
                -- Ban Ngân Quỹ
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban ngân quỹ%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban ngan quy%'
                THEN 'Ban Ngân Quỹ'
                
                -- Ban Tài chính
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban tài chính%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban tai chinh%'
                THEN 'Ban Tài chính'
                
                -- Ban Công nghệ thông tin và Chuyển đổi số
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban công nghệ thông tin%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban cong nghe thong tin%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban công nghệ thông tin và chuyển đổi số%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban cong nghe thong tin va chuyen doi so%'
                THEN 'Ban Công nghệ thông tin và Chuyển đổi số'
                
                -- Ban Kiểm soát
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban kiểm soát%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban kiem soat%'
                THEN 'Ban Kiểm soát'
                
                -- Ban Tổ chức Pháp chế
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban tổ chức pháp chế%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban to chuc phap che%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban tổ chức pháp chế%'
                THEN 'Ban Tổ chức Pháp chế'
                
                -- Trung tâm Marketing
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm marketing%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam marketing%'
                THEN 'Trung tâm Marketing'
                
                -- Ban Trải nghiệm khách hàng
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban trải nghiệm khách hàng%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban trai nghiem khach hang%'
                THEN 'Ban Trải nghiệm khách hàng'
                
                -- Trung tâm kinh doanh BV/PK
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm kinh doanh bv/pk%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam kinh doanh bv/pk%'
                THEN 'Trung tâm kinh doanh BV/PK'
                
                -- Trung tâm tại nhà toàn quốc
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm tại nhà toàn quốc%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam tai nha toan quoc%'
                THEN 'Trung tâm tại nhà toàn quốc'
                
                -- Trung tâm KHDN
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm khdn%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam khdn%'
                THEN 'Trung tâm KHDN'
                
                -- Trung tâm Khách hàng chiến lược và Dự án y tế
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm khách hàng chiến lược%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam khach hang chien luoc%'
                THEN 'Trung tâm Khách hàng chiến lược và Dự án y tế'
                
                -- Trung tâm phát triển Đối tác và Bảo hiểm
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%trung tâm phát triển đối tác%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%trung tam phat trien doi tac%'
                THEN 'Trung tâm phát triển Đối tác và Bảo hiểm'
                
                -- Ban kế hoạch
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban kế hoạch%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban ke hoach%'
                THEN 'Ban kế hoạch'
                
                -- Hệ thống CĐHA TDCN
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống cđha tdcn%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong cdha tdcn%'
                THEN 'Hệ thống CĐHA TDCN'
                
                -- Hệ thống giải phẫu bệnh
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống giải phẫu bệnh%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong giai phau benh%'
                THEN 'Hệ thống giải phẫu bệnh'
                
                -- Hệ thống KCB ngoại viện
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống kcb ngoại viện%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong kcb ngoai vien%'
                THEN 'Hệ thống KCB ngoại viện'
                
                -- Hệ thống khám chữa bệnh
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống khám chữa bệnh%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong kham chua benh%'
                THEN 'Hệ thống khám chữa bệnh'
                
                -- Bệnh viện đa khoa Medlatec
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%bệnh viện đa khoa medlatec%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%benh vien da khoa medlatec%'
                THEN 'Bệnh viện đa khoa Medlatec'
                
                -- Phòng Khám đa khoa Cầu Giấy
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng khám đa khoa cầu giấy%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong kham da khoa cau giay%'
                THEN 'Phòng Khám đa khoa Cầu Giấy'
                
                -- Phòng Khám đa khoa Tây Hồ
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng khám đa khoa tây hồ%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong kham da khoa tay ho%'
                THEN 'Phòng Khám đa khoa Tây Hồ'
                
                -- Phòng Khám đa khoa Thanh Xuân
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng khám đa khoa thanh xuân%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong kham da khoa thanh xuan%'
                THEN 'Phòng Khám đa khoa Thanh Xuân'
                
                -- Hệ thống Xét nghiệm
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%hệ thống xét nghiệm%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%he thong xet nghiem%'
                THEN 'Hệ thống Xét nghiệm'
                
                -- Ban Hậu cần - Dự án
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%ban hậu cần%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%ban hau can%'
                THEN 'Ban Hậu cần - Dự án'
                
                -- Phòng Cung ứng
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng cung ứng%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong cung ung%'
                THEN 'Phòng Cung ứng'
                
                -- Phòng dự án
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng dự án%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong du an%'
                THEN 'Phòng dự án'
                
                -- Phòng Hành chính HCDA
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng hành chính hcda%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong hanh chinh hcda%'
                THEN 'Phòng Hành chính HCDA'
                
                -- Phòng Trang thiết bị - Kỹ thuật
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng trang thiết bị%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong trang thiet bi%'
                THEN 'Phòng Trang thiết bị - Kỹ thuật'
                
                -- Phòng kế toán Med VN
                WHEN LOWER(TRIM(salary_data.department_name)) LIKE '%phòng kế toán med vn%'
                     OR LOWER(TRIM(salary_data.department_name)) LIKE '%phong ke toan med vn%'
                THEN 'Phòng kế toán Med VN'
                
                -- Các đơn vị khác giữ nguyên
                ELSE TRIM(salary_data.department_name)
            END
    )
    SELECT 
        s.department_name,
        s.ft_salary_2025,
        s.pt_salary_2025,
        s.total_salary_2025,
        COALESCE(k."KPI_quy_luong_2025", 0) AS quy_cung_2025,
        5 AS so_thang_da_chia
    FROM aggregated_salary s
    LEFT JOIN "Chi_tieu_2025" k ON TRIM(s.department_name) = TRIM(k."Địa điểm_ngành dọc")
    WHERE (k."Loại" = 'Hà Nội' OR k."Loại" IS NULL)
        AND s.department_name NOT IN ('Medon', 'Med Campuchia', 'Medcom')
    ORDER BY s.department_name;
END;
$$;

-- Function: get_nganhdoc_salary_kpi_2025_province
-- Returns salary data for province units with KPI targets from Chi_tieu_2025
DROP FUNCTION IF EXISTS get_nganhdoc_salary_kpi_2025_province(INTEGER, INTEGER[]);
CREATE OR REPLACE FUNCTION get_nganhdoc_salary_kpi_2025_province(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
    department_name TEXT,
    ft_salary_2025 NUMERIC,
    pt_salary_2025 NUMERIC,
    total_salary_2025 NUMERIC,
    quy_cung_2025 NUMERIC,
    total_revenue_2025 NUMERIC,
    salary_revenue_ratio NUMERIC,
    allowed_salary_revenue_ratio NUMERIC,
    excess_ratio NUMERIC,
    excess_fund NUMERIC,
    additional_salary_fund NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH salary_data AS (
        SELECT 
            f.dia_diem AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary_2025,
            0 AS pt_salary_2025
        FROM "Fulltime" f
        WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                (
                    regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d+$'
                    AND regexp_replace(f.thang, '\\D', '', 'g')::INTEGER = ANY(p_filter_months)
                )
            )
        GROUP BY f.dia_diem

        UNION ALL

        SELECT 
            pt."Don vi" AS raw_department,
            0 AS ft_salary_2025,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary_2025
        FROM "Parttime" pt
        WHERE (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                (
                    regexp_replace(pt."Thoi gian", '\\D', '', 'g') ~ '^\\d+$'
                    AND regexp_replace(pt."Thoi gian", '\\D', '', 'g')::INTEGER = ANY(p_filter_months)
                )
            )
        GROUP BY pt."Don vi"
    ),
    aggregated_salary AS (
        SELECT 
            TRIM(LOWER(sd.raw_department)) AS department_key,
            SUM(sd.ft_salary_2025) AS ft_salary_2025,
            SUM(sd.pt_salary_2025) AS pt_salary_2025,
            SUM(sd.ft_salary_2025 + sd.pt_salary_2025) AS total_salary_2025
        FROM salary_data sd
        GROUP BY TRIM(LOWER(sd.raw_department))
    ),
    revenue_data AS (
        SELECT 
            TRIM(LOWER(dt."Tên Đơn vị")) AS department_key,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS total_revenue_2025
        FROM "Doanh_thu" dt
        WHERE dt."Tháng pro" LIKE '%2025%'
        GROUP BY TRIM(LOWER(dt."Tên Đơn vị"))
    )
    SELECT 
        -- Gộp các đơn vị theo yêu cầu
        CASE 
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
            ELSE TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)])
        END AS department_name,
        SUM(COALESCE(a.ft_salary_2025, 0)) AS ft_salary_2025,
        SUM(COALESCE(a.pt_salary_2025, 0)) AS pt_salary_2025,
        SUM(COALESCE(a.total_salary_2025, 0)) AS total_salary_2025,
        SUM(COALESCE(k."KPI_quy_luong_2025", 0)) AS quy_cung_2025,
        SUM(COALESCE(r.total_revenue_2025, 0)) AS total_revenue_2025,
        -- Quỹ lương/doanh thu lũy kế = Tổng lương 25 / Tổng doanh thu
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 THEN SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))
            ELSE 0
        END AS salary_revenue_ratio,
        -- Quỹ lương/doanh thu được phép chia = KPI_quy_luong_2025 / Chi_tieu_DT
        CASE 
            WHEN SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 THEN SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0))
            ELSE 0
        END AS allowed_salary_revenue_ratio,
        -- Tỷ lệ vượt quỹ = QL/DT lũy kế - QL/DT được phép
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 AND SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN (SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))) - (SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))
            ELSE 0
        END AS excess_ratio,
        -- Quỹ cứng vượt = Tỷ lệ vượt quỹ * Tổng doanh thu
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 AND SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN ((SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))) - (SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))) * SUM(COALESCE(r.total_revenue_2025, 0))
            ELSE 0
        END AS excess_fund,
        -- Quỹ lương phải bù thêm = Quỹ cứng vượt / (12 - số tháng đã chia)
        -- Sử dụng 5 tháng đã chia như mặc định (có thể điều chỉnh sau)
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 AND SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN ((SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))) - (SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))) * SUM(COALESCE(r.total_revenue_2025, 0)) / (12 - 5)
            ELSE 0
        END AS additional_salary_fund
    FROM "Chi_tieu_2025" k
    LEFT JOIN aggregated_salary a
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = a.department_key
    LEFT JOIN revenue_data r
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = r.department_key
    WHERE k."Loại" = 'Các tỉnh'
    AND k."Địa điểm_ngành dọc" NOT IN ('Medcom', 'Medon')
    GROUP BY 
        CASE 
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
            ELSE TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)])
        END
    ORDER BY department_name;
END;
$$; 