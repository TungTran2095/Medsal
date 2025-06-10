import { z } from "zod";

// Schema cho việc tìm kiếm doanh thu
export const searchRevenueSchema = z.object({
  year: z.number().optional(),
  month: z.number().optional(),
  location: z.string().optional(),
});

// Schema cho việc tìm kiếm lương nhân viên
export const searchSalarySchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
  year: z.number().optional(),
  month: z.number().optional(),
  location: z.string().optional(),
  isFulltime: z.boolean().optional(),
});

// Schema cho việc so sánh doanh thu và lương
export const compareRevenueSalarySchema = z.object({
  year: z.number().optional(),
  month: z.number().optional(),
  location: z.string().optional(),
});

// Định nghĩa các functions
export const chatbotFunctions = {
  searchRevenue: {
    name: "searchRevenue",
    description: "Tìm kiếm thông tin doanh thu theo năm, tháng và địa điểm",
    parameters: searchRevenueSchema,
  },
  searchSalary: {
    name: "searchSalary",
    description: "Tìm kiếm thông tin lương của nhân viên theo ID, tên, năm, tháng, địa điểm và loại hợp đồng",
    parameters: searchSalarySchema,
  },
  compareRevenueSalary: {
    name: "compareRevenueSalary",
    description: "So sánh doanh thu và lương theo năm, tháng và địa điểm",
    parameters: compareRevenueSalarySchema,
  },
}; 