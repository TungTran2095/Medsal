-- Test trực tiếp KPI function cho 4 đơn vị khám chữa bệnh
SELECT 
    department_name,
    ft_salary_2025,
    pt_salary_2025,
    total_salary_2025,
    quy_cung_2025
FROM get_nganhdoc_salary_kpi_2025_hanoi(2025, ARRAY[7])
WHERE department_name IN (
    'Bệnh viện đa khoa Medlatec',
    'Phòng Khám đa khoa Cầu Giấy', 
    'Phòng Khám đa khoa Tây Hồ',
    'Phòng Khám đa khoa Thanh Xuân'
)
ORDER BY department_name;
