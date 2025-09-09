-- Test function để kiểm tra quỹ lương còn lại được chia
SELECT 
    department_name,
    ft_salary_month,
    pt_salary_month,
    total_salary_month,
    quy_luong_con_lai_duoc_chia,
    CASE 
        WHEN LOWER(department_name) LIKE '%hệ thống kcb ngoại viện%' 
        THEN 'Sử dụng FT salary'
        ELSE 'Sử dụng cumulative_total_salary'
    END as calculation_method
FROM get_simple_monthly_salary_hanoi(7, 2024, 7)
WHERE LOWER(department_name) LIKE '%hệ thống kcb ngoại viện%'
ORDER BY total_salary_month DESC;
