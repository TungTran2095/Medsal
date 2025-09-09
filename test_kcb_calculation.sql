-- Test tính toán cho Hệ thống KCB ngoại viện
SELECT 
    department_name,
    ft_salary_month,
    pt_salary_month,
    total_salary_month,
    cumulative_ft_salary,
    cumulative_total_salary,
    quy_luong_con_lai_duoc_chia,
    -- Tính thủ công để kiểm tra
    CASE 
        WHEN LOWER(department_name) LIKE '%hệ thống kcb ngoại viện%' 
        THEN 'Sử dụng cumulative_ft_salary'
        ELSE 'Sử dụng cumulative_total_salary'
    END as calculation_method
FROM get_simple_monthly_salary_hanoi(7, 2024, 7)
WHERE LOWER(department_name) LIKE '%hệ thống kcb ngoại viện%';
