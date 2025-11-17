
'use server';
/**
 * @fileOverview Genkit tools for querying dashboard-specific Supabase RPC functions.
 *
 * This file defines tools that allow the AI to fetch aggregated data
 * relevant to the application's dashboard, such as total salaries,
 * revenue figures, and trends, with support for time and location filters.
 */

import {ai} from '@/ai/genkit';
import {supabase} from '@/lib/supabaseClient';
import {z} from 'genkit';

// Common Input Schema for filters that take year, months, and locations
const DashboardQueryFilterSchema = z.object({
  filter_year: z.number().optional().describe('The year to filter by (e.g., 2023).'),
  filter_months: z.array(z.number()).optional().describe('An array of months to filter by (1-12).'),
  filter_locations: z.array(z.string()).optional().describe('An array of location names (department names) to filter by.'),
});
export type DashboardQueryFilterInput = z.infer<typeof DashboardQueryFilterSchema>;

// Extended Dashboard Query Filter Schema that also includes nganh_docs
const DashboardQueryFilterWithNganhDocSchema = DashboardQueryFilterSchema.extend({
  filter_nganh_docs: z.array(z.string()).optional().describe('An array of "nganh_doc" names to filter by.'),
});
export type DashboardQueryFilterWithNganhDocInput = z.infer<typeof DashboardQueryFilterWithNganhDocSchema>;

// Extended Dashboard Query Filter Schema that also includes donvi2
const DashboardQueryFilterWithDonVi2Schema = DashboardQueryFilterSchema.extend({
  filter_donvi2: z.array(z.string()).optional().describe('An array of "Don_vi_2" names to filter by.'),
});
export type DashboardQueryFilterWithDonVi2Input = z.infer<typeof DashboardQueryFilterWithDonVi2Schema>;


// Common Trend Input Schema that take year and locations
const TrendQueryFilterSchema = z.object({
  p_filter_year: z.number().optional().describe('The year to filter trends by (e.g., 2023).'),
  p_filter_locations: z.array(z.string()).optional().describe('An array of location names (department names) to filter trends by.'),
});

// Input schema for Location Ratio Tool
const LocationRatioInputSchema = z.object({
  p_filter_year: z.number().optional().describe('The year to filter by (e.g., 2023).'),
  p_filter_months: z.array(z.number()).optional().describe('An array of months to filter by (1-12).'),
  p_filter_locations: z.array(z.string()).optional().describe('An array of specific location names (department names) to include in the ratio calculation.'),
});

// Input schema for Location Comparison Metrics Tool
const LocationComparisonMetricsInputSchema = z.object({
    p_filter_year: z.number().describe('The year to fetch metrics for (e.g., 2024).'),
    p_filter_months: z.array(z.number()).optional().describe('An array of months to filter by (1-12).'),
    p_filter_locations: z.array(z.string()).optional().describe('An array of specific location names (department names) to filter by.'),
});
export type LocationComparisonMetricsInput = z.infer<typeof LocationComparisonMetricsInputSchema>;

// Schema for input for Nganh Doc and DonVi2 queries (year, months)
const NganhDocDonVi2QueryFilterSchema = z.object({
  p_filter_year: z.number().describe('The year to filter by (e.g., 2024).'),
  p_filter_months: z.array(z.number()).optional().describe('An array of months to filter by (1-12).'),
});
export type NganhDocDonVi2QueryFilterInput = z.infer<typeof NganhDocDonVi2QueryFilterSchema>;

// Input schema for Monthly Employee Trend Tool
const MonthlyEmployeeTrendInputSchema = z.object({
  p_filter_year: z.number().optional().describe('The year to filter trends by (e.g., 2023).'),
  p_filter_locations: z.array(z.string()).optional().describe('An array of location names (department names) to filter trends by.'),
  p_filter_nganh_docs: z.array(z.string()).optional().describe('An array of "nganh_doc" names to filter trends by.'),
});
export type MonthlyEmployeeTrendInput = z.infer<typeof MonthlyEmployeeTrendInputSchema>;

// Input schema for Monthly FT Salary/Revenue Per Employee Trend Tool
const MonthlyFTSalaryRevenuePerEmployeeTrendInputSchema = z.object({
  p_filter_year: z.number().optional().describe('The year to filter trends by (e.g., 2023).'),
  p_filter_locations: z.array(z.string()).optional().describe('An array of location names to filter trends by.'),
  p_filter_nganh_docs: z.array(z.string()).optional().describe('An array of "nganh_doc" names to filter trends by.'),
});
export type MonthlyFTSalaryRevenuePerEmployeeTrendInput = z.infer<typeof MonthlyFTSalaryRevenuePerEmployeeTrendInputSchema>;


// Generic Output Schema for single value results
const SingleValueOutputSchema = z.object({
  value: z.number().nullable().describe('The numerical value of the query, or null if not applicable.'),
  message: z.string().optional().describe('A message describing the result, success, no data, or error.'),
});

// Generic Output Schema for trend data results
const TrendDataOutputSchema = z.object({
  data: z.array(z.any()).nullable().describe('An array of data points for the trend, or null.'),
  message: z.string().optional().describe('A message describing the result, success, no data, or error.'),
});

// Output Schema for Location Comparison Metrics Tool
const LocationComparisonMetricsOutputSchema = z.object({
    data: z.array(z.object({
        location_name: z.string(),
        ft_salary: z.number(),
        pt_salary: z.number(),
        total_revenue: z.number(),
    })).nullable().describe('An array of metrics per location, or null.'),
    message: z.string().optional().describe('A message describing the result, success, no data, or error.'),
});
export type LocationComparisonMetricsOutput = z.infer<typeof LocationComparisonMetricsOutputSchema>;

// Output Schema for Nganh Doc FT Salary (Hanoi) Tool
const NganhDocFTSalaryHanoiOutputSchema = z.object({
    data: z.array(z.object({
        nganh_doc_key: z.string(),
        ft_salary: z.number(),
    })).nullable().describe('An array of FT salaries by "nganh_doc" for Hanoi, or null.'),
    message: z.string().optional().describe('A message describing the result, success, no data, or error.'),
});
export type NganhDocFTSalaryHanoiOutput = z.infer<typeof NganhDocFTSalaryHanoiOutputSchema>;

// Output Schema for DonVi2 PT Salary Tool
const DonVi2PTSalaryOutputSchema = z.object({
    data: z.array(z.object({
        don_vi_2_key: z.string(),
        pt_salary: z.number(),
    })).nullable().describe('An array of PT salaries by "Don_vi_2", or null.'),
    message: z.string().optional().describe('A message describing the result, success, no data, or error.'),
});
export type DonVi2PTSalaryOutput = z.infer<typeof DonVi2PTSalaryOutputSchema>;

// Output schema for Monthly Employee Trend Tool
const MonthlyEmployeeTrendOutputSchema = z.object({
  data: z.array(z.object({
    month_label: z.string(),
    year_val: z.number(),
    employee_count: z.number(),
  })).nullable().describe('An array of monthly employee counts, or null.'),
  message: z.string().optional().describe('A message describing the result, success, no data, or error.'),
});
export type MonthlyEmployeeTrendOutput = z.infer<typeof MonthlyEmployeeTrendOutputSchema>;

// Output schema for Monthly FT Salary/Revenue Per Employee Trend Tool
const MonthlyFTSalaryRevenuePerEmployeeTrendOutputSchema = z.object({
  data: z.array(z.object({
    month_label: z.string(),
    year_val: z.number(),
    avg_salary_per_employee: z.number().nullable(),
    revenue_per_employee: z.number().nullable(),
  })).nullable().describe('An array of monthly average salary per FT employee and revenue per FT employee, or null.'),
  message: z.string().optional().describe('A message describing the result, success, no data, or error.'),
});
export type MonthlyFTSalaryRevenuePerEmployeeTrendOutput = z.infer<typeof MonthlyFTSalaryRevenuePerEmployeeTrendOutputSchema>;


// Tool for get_total_salary_fulltime
export const getTotalSalaryFulltimeTool = ai.defineTool(
  {
    name: 'getTotalSalaryFulltimeTool',
    description: 'Fetches the total full-time salary based on optional year, month, location, and/or "nganh_doc" filters. Use this for queries like "tổng lương nhân viên full-time".',
    inputSchema: DashboardQueryFilterWithNganhDocSchema,
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_salary_fulltime', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
        filter_locations: input.filter_locations,
        filter_nganh_docs: input.filter_nganh_docs,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu lương full-time cho kỳ và bộ lọc đã chọn.' };
      return { value: Number(data), message: 'Truy vấn tổng lương full-time thành công.' };
    } catch (e: any) {
      console.error('Error in getTotalSalaryFulltimeTool:', e);
      return { value: null, message: `Lỗi khi lấy tổng lương full-time: ${e.message}` };
    }
  }
);

// Tool for get_total_salary_parttime
export const getTotalSalaryParttimeTool = ai.defineTool(
  {
    name: 'getTotalSalaryParttimeTool',
    description: 'Fetches the total part-time salary based on optional year, month, location, and/or "Don_vi_2" filters. Use for queries like "tổng lương nhân viên part-time".',
    inputSchema: DashboardQueryFilterWithDonVi2Schema, // Use schema with DonVi2
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_salary_parttime', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
        filter_locations: input.filter_locations,
        filter_donvi2: input.filter_donvi2, // Pass donvi2 filter
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu lương part-time cho kỳ và bộ lọc đã chọn.' };
      return { value: Number(data), message: 'Truy vấn tổng lương part-time thành công.' };
    } catch (e: any) {
      console.error('Error in getTotalSalaryParttimeTool:', e);
      return { value: null, message: `Lỗi khi lấy tổng lương part-time: ${e.message}` };
    }
  }
);

// Tool for get_total_revenue
export const getTotalRevenueTool = ai.defineTool(
  {
    name: 'getTotalRevenueTool',
    description: 'Fetches the total revenue based on optional year, month, and/or location filters. Use for queries like "tổng doanh thu". (Note: This RPC does not filter by "nganh_doc" or "Don_vi_2").',
    inputSchema: DashboardQueryFilterSchema, // Standard filter, no nganh_doc or donvi2
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_revenue', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
        filter_locations: input.filter_locations,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu doanh thu cho kỳ và địa điểm đã chọn.' };
      return { value: Number(data), message: 'Truy vấn tổng doanh thu thành công.' };
    } catch (e: any) {
      console.error('Error in getTotalRevenueTool:', e);
      return { value: null, message: `Lỗi khi lấy tổng doanh thu: ${e.message}` };
    }
  }
);

// Tool for get_total_workdays_fulltime
export const getTotalWorkdaysFulltimeTool = ai.defineTool(
  {
    name: 'getTotalWorkdaysFulltimeTool',
    description: 'Fetches the total workdays for full-time employees based on optional year, month, location, and/or "nganh_doc" filters. Workdays are summed from specific columns in the Fulltime table.',
    inputSchema: DashboardQueryFilterWithNganhDocSchema, // Uses nganh_doc
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_workdays_fulltime', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
        filter_locations: input.filter_locations,
        filter_nganh_docs: input.filter_nganh_docs,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu tổng công full-time cho kỳ và bộ lọc đã chọn.' };
      return { value: Number(data), message: 'Truy vấn tổng công full-time thành công.' };
    } catch (e: any) {
      console.error('Error in getTotalWorkdaysFulltimeTool:', e);
      return { value: null, message: `Lỗi khi lấy tổng công full-time: ${e.message}` };
    }
  }
);


// Tool for get_monthly_salary_trend_fulltime
export const getMonthlySalaryTrendFulltimeTool = ai.defineTool(
  {
    name: 'getMonthlySalaryTrendFulltimeTool',
    description: 'Fetches the monthly salary trend for full-time employees for a given year and optional locations and "nganh_doc". Use for "xu hướng lương full-time hàng tháng".',
    inputSchema: TrendQueryFilterSchema.extend({ p_filter_nganh_docs: z.array(z.string()).optional().describe('An array of "nganh_doc" names to filter trends by.') }),
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_salary_trend_fulltime', {
        p_filter_year: input.p_filter_year,
        p_filter_locations: input.p_filter_locations,
        p_filter_nganh_docs: input.p_filter_nganh_docs,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng lương full-time cho bộ lọc đã chọn.' };
      return { data, message: 'Truy vấn xu hướng lương full-time thành công.' };
    } catch (e: any) {
      console.error('Error in getMonthlySalaryTrendFulltimeTool:', e);
      return { data: null, message: `Lỗi khi lấy xu hướng lương full-time: ${e.message}` };
    }
  }
);

// Tool for get_monthly_salary_trend_parttime
export const getMonthlySalaryTrendParttimeTool = ai.defineTool(
  {
    name: 'getMonthlySalaryTrendParttimeTool',
    description: 'Fetches the monthly salary trend for part-time employees for a given year and optional locations and "Don_vi_2". Use for "xu hướng lương part-time hàng tháng".',
    inputSchema: TrendQueryFilterSchema.extend({ p_filter_donvi2: z.array(z.string()).optional().describe('An array of "Don_vi_2" names to filter trends by.') }),
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_salary_trend_parttime', {
        p_filter_year: input.p_filter_year,
        p_filter_locations: input.p_filter_locations,
        p_filter_donvi2: input.p_filter_donvi2,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng lương part-time cho bộ lọc đã chọn.' };
      return { data, message: 'Truy vấn xu hướng lương part-time thành công.' };
    } catch (e: any) {
      console.error('Error in getMonthlySalaryTrendParttimeTool:', e);
      return { data: null, message: `Lỗi khi lấy xu hướng lương part-time: ${e.message}` };
    }
  }
);

// Tool for get_monthly_revenue_trend
export const getMonthlyRevenueTrendTool = ai.defineTool(
  {
    name: 'getMonthlyRevenueTrendTool',
    description: 'Fetches the monthly revenue trend for a given year and optional locations. Use for "xu hướng doanh thu hàng tháng".',
    inputSchema: TrendQueryFilterSchema,
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_revenue_trend', {
        p_filter_year: input.p_filter_year,
        p_filter_locations: input.p_filter_locations,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng doanh thu cho năm và địa điểm đã chọn.' };
      return { data, message: 'Truy vấn xu hướng doanh thu thành công.' };
    } catch (e: any) {
      console.error('Error in getMonthlyRevenueTrendTool:', e);
      return { data: null, message: `Lỗi khi lấy xu hướng doanh thu: ${e.message}` };
    }
  }
);

// Tool for get_salary_revenue_ratio_components_by_location
export const getLocationSalaryRevenueRatiosTool = ai.defineTool(
  {
    name: 'getLocationSalaryRevenueRatiosTool',
    description: 'Fetches salary-to-revenue ratio components for each location, based on optional year, month, and specific location filters. Use for "tỷ lệ quỹ lương trên doanh thu theo địa điểm".',
    inputSchema: LocationRatioInputSchema, 
    outputSchema: TrendDataOutputSchema, 
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_salary_revenue_ratio_components_by_location', {
        p_filter_year: input.p_filter_year,
        p_filter_months: input.p_filter_months,
        p_filter_locations: input.p_filter_locations,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu tỷ lệ quỹ lương/doanh thu theo địa điểm cho kỳ và địa điểm đã chọn.' };
      return { data, message: 'Truy vấn tỷ lệ quỹ lương/doanh thu theo địa điểm thành công.' };
    } catch (e: any) {
      console.error('Error in getLocationSalaryRevenueRatiosTool:', e);
      return { data: null, message: `Lỗi khi lấy tỷ lệ quỹ lương/doanh thu theo địa điểm: ${e.message}` };
    }
  }
);

// Tool for get_location_comparison_metrics
export const getLocationComparisonMetricsTool = ai.defineTool(
  {
    name: 'getLocationComparisonMetricsTool',
    description: 'Fetches detailed salary (FT, PT) and revenue metrics for each location for a specific year, with optional month and location filters. Used for detailed comparison tables.',
    inputSchema: LocationComparisonMetricsInputSchema,
    outputSchema: LocationComparisonMetricsOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_location_comparison_metrics', {
        p_filter_year: input.p_filter_year,
        p_filter_months: input.p_filter_months,
        p_filter_locations: input.p_filter_locations,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: `Không có dữ liệu chi tiết theo địa điểm cho năm ${input.p_filter_year} và các bộ lọc đã chọn.` };
      const typedData = data.map((item: any) => ({
        location_name: String(item.location_name),
        ft_salary: Number(item.ft_salary) || 0,
        pt_salary: Number(item.pt_salary) || 0,
        total_revenue: Number(item.total_revenue) || 0,
      }));
      return { data: typedData, message: 'Truy vấn dữ liệu chi tiết theo địa điểm thành công.' };
    } catch (e: any) {
      console.error('Error in getLocationComparisonMetricsTool:', e);
      return { data: null, message: `Lỗi khi lấy dữ liệu chi tiết theo địa điểm: ${e.message}` };
    }
  }
);

// Tool for get_nganhdoc_ft_salary_hanoi
export const getNganhDocFTSalaryHanoiTool = ai.defineTool(
  {
    name: 'getNganhDocFTSalaryHanoiTool',
    description: 'Fetches Full-time salary aggregated by "nganh_doc" for units in Hanoi, for a given year and optional months. Assumes Fulltime table has "nganh_doc" and "hn_or_note" columns.',
    inputSchema: NganhDocDonVi2QueryFilterSchema,
    outputSchema: NganhDocFTSalaryHanoiOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_nganhdoc_ft_salary_hanoi', {
        p_filter_year: input.p_filter_year,
        p_filter_months: input.p_filter_months,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: `Không có dữ liệu lương FT theo ngành dọc (Hà Nội) cho năm ${input.p_filter_year}.` };
      const typedData = data.map((item: any) => ({
        nganh_doc_key: String(item.nganh_doc_key),
        ft_salary: Number(item.ft_salary) || 0,
      }));
      return { data: typedData, message: 'Truy vấn lương FT theo ngành dọc (Hà Nội) thành công.' };
    } catch (e: any) {
      console.error('Error in getNganhDocFTSalaryHanoiTool:', e);
      return { data: null, message: `Lỗi khi lấy lương FT theo ngành dọc (Hà Nội): ${e.message}` };
    }
  }
);

// Tool for get_donvi2_pt_salary
export const getDonVi2PTSalaryTool = ai.defineTool(
  {
    name: 'getDonVi2PTSalaryTool',
    description: 'Fetches Part-time salary aggregated by "Don_vi_2", for a given year and optional months. Assumes Parttime table has "Don_vi_2" column.',
    inputSchema: NganhDocDonVi2QueryFilterSchema,
    outputSchema: DonVi2PTSalaryOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_donvi2_pt_salary', {
        p_filter_year: input.p_filter_year,
        p_filter_months: input.p_filter_months,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: `Không có dữ liệu lương PT theo Đơn vị 2 cho năm ${input.p_filter_year}.` };
      const typedData = data.map((item: any) => ({
        don_vi_2_key: String(item.don_vi_2_key),
        pt_salary: Number(item.pt_salary) || 0,
      }));
      return { data: typedData, message: 'Truy vấn lương PT theo Đơn vị 2 thành công.' };
    } catch (e: any) {
      console.error('Error in getDonVi2PTSalaryTool:', e);
      return { data: null, message: `Lỗi khi lấy lương PT theo Đơn vị 2: ${e.message}` };
    }
  }
);

// Tool for get_monthly_employee_trend_fulltime
export const getMonthlyEmployeeTrendFulltimeTool = ai.defineTool(
  {
    name: 'getMonthlyEmployeeTrendFulltimeTool',
    description: 'Fetches the monthly trend of full-time employee count for a given year, optional locations, and optional "nganh_doc" filters. Use for "xu hướng số lượng nhân viên full-time hàng tháng".',
    inputSchema: MonthlyEmployeeTrendInputSchema,
    outputSchema: MonthlyEmployeeTrendOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_employee_trend_fulltime', {
        p_filter_year: input.p_filter_year,
        p_filter_locations: input.p_filter_locations,
        p_filter_nganh_docs: input.p_filter_nganh_docs,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng số lượng nhân viên full-time cho kỳ và bộ lọc đã chọn.' };
      return { data, message: 'Truy vấn xu hướng số lượng nhân viên full-time thành công.' };
    } catch (e: any) {
      console.error('Error in getMonthlyEmployeeTrendFulltimeTool:', e);
      return { data: null, message: `Lỗi khi lấy xu hướng số lượng nhân viên full-time: ${e.message}` };
    }
  }
);

// Tool for get_monthly_ft_salary_revenue_per_employee_trend
export const getMonthlyFTSalaryRevenuePerEmployeeTrendTool = ai.defineTool(
  {
    name: 'getMonthlyFTSalaryRevenuePerEmployeeTrendTool',
    description: 'Fetches the monthly trend of average full-time salary per FT employee and revenue per FT employee. Supports filters for year, locations, and "nganh_doc". Use for "xu hướng lương và doanh thu trung bình mỗi nhân viên full-time".',
    inputSchema: MonthlyFTSalaryRevenuePerEmployeeTrendInputSchema,
    outputSchema: MonthlyFTSalaryRevenuePerEmployeeTrendOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_ft_salary_revenue_per_employee_trend', {
        p_filter_year: input.p_filter_year,
        p_filter_locations: input.p_filter_locations,
        p_filter_nganh_docs: input.p_filter_nganh_docs,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng lương/doanh thu TB/NV cho kỳ và bộ lọc đã chọn.' };
      return { data, message: 'Truy vấn xu hướng lương/doanh thu TB/NV thành công.' };
    } catch (e: any) {
      console.error('Error in getMonthlyFTSalaryRevenuePerEmployeeTrendTool:', e);
      return { data: null, message: `Lỗi khi lấy xu hướng lương/doanh thu TB/NV: ${e.message}` };
    }
  }
);

// Input schema for Employee Salary Query Tool
const EmployeeSalaryQueryInputSchema = z.object({
  employee_id: z.string().describe('Mã nhân viên cần truy vấn lương'),
  filter_year: z.number().optional().describe('Năm cần truy vấn (mặc định là năm mới nhất)'),
  filter_months: z.array(z.number()).optional().describe('Các tháng cần truy vấn (1-12), mặc định là tất cả tháng'),
  include_calculations: z.boolean().optional().describe('Có tính toán lương/công và các chỉ số khác không'),
});

// Output schema for Employee Salary Query Tool
const EmployeeSalaryQueryOutputSchema = z.object({
  employee_info: z.object({
    ma_nhan_vien: z.string(),
    ho_va_ten: z.string(),
    dia_diem: z.string().optional(),
    job_title: z.string().optional(),
  }).optional(),
  salary_data: z.array(z.object({
    thang: z.string(),
    nam: z.number(),
    tong_thu_nhap: z.number(),
    ngay_thuong_chinh_thuc: z.number(),
    ngay_thuong_thu_viec: z.number(),
    nghi_tuan: z.number(),
    le_tet: z.number(),
    ngay_thuong_chinh_thuc2: z.number(),
    ngay_thuong_thu_viec3: z.number(),
    nghi_tuan4: z.number(),
    le_tet5: z.number(),
    nghi_nl: z.number(),
    salary_per_workday: z.number().optional(),
    total_workdays: z.number().optional(),
  })).optional(),
  summary: z.object({
    total_salary: z.number(),
    total_workdays: z.number(),
    average_salary_per_workday: z.number(),
    months_count: z.number(),
  }).optional(),
  message: z.string(),
});

export type EmployeeSalaryQueryInput = z.infer<typeof EmployeeSalaryQueryInputSchema>;
export type EmployeeSalaryQueryOutput = z.infer<typeof EmployeeSalaryQueryOutputSchema>;

// Tool for querying employee salary by ID
export const getEmployeeSalaryTool = ai.defineTool(
  {
    name: 'getEmployeeSalaryTool',
    description: 'Truy vấn thông tin lương của một nhân viên cụ thể theo mã nhân viên. Hỗ trợ lọc theo năm và tháng. Có thể tính toán lương/công và các chỉ số tổng hợp.',
    inputSchema: EmployeeSalaryQueryInputSchema,
    outputSchema: EmployeeSalaryQueryOutputSchema,
  },
  async (input) => {
    try {
      console.log('getEmployeeSalaryTool: Starting query for employee_id:', input.employee_id);
      
      // Thêm timeout cho query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
      );
      
      // Lấy thông tin cơ bản của nhân viên
      const employeeQuery = supabase
        .from('MS_CBNV')
        .select('*')
        .eq('"Mã nhân viên"', input.employee_id)
        .single();
      
      const { data: employeeData, error: employeeError } = await Promise.race([
        employeeQuery,
        timeoutPromise
      ]) as any;
      
      console.log('getEmployeeSalaryTool: Employee data:', employeeData, 'Error:', employeeError);

      if (employeeError || !employeeData) {
        return { 
          message: `Không tìm thấy nhân viên với mã ${input.employee_id}`,
          employee_info: null,
          salary_data: null,
          summary: null
        };
      }

      // Xây dựng query cho bảng Fulltime
      let query = supabase
        .from('Fulltime')
        .select('*')
        .eq('ma_nhan_vien', input.employee_id);

      if (input.filter_year) {
        query = query.eq('nam', input.filter_year);
      }

      if (input.filter_months && input.filter_months.length > 0) {
        const monthConditions = input.filter_months.map(month => 
          `thang.ilike.%Tháng ${month.toString().padStart(2, '0')}%`
        );
        query = query.or(monthConditions.join(','));
      }

      const salaryQuery = query.order('nam', { ascending: false }).order('thang', { ascending: true });
      
      const { data: salaryData, error: salaryError } = await Promise.race([
        salaryQuery,
        timeoutPromise
      ]) as any;

      console.log('getEmployeeSalaryTool: Salary data:', salaryData?.length, 'records, Error:', salaryError);

      if (salaryError) {
        console.error('getEmployeeSalaryTool: Salary query error:', salaryError);
        throw salaryError;
      }

      if (!salaryData || salaryData.length === 0) {
        return {
          employee_info: {
            ma_nhan_vien: employeeData['Mã nhân viên'] || input.employee_id,
            ho_va_ten: employeeData['Họ và tên'] || 'Không rõ',
            dia_diem: employeeData['Địa điểm'] || 'Không rõ',
            job_title: employeeData['Job title'] || 'Không rõ',
          },
          message: `Nhân viên ${employeeData['Họ và tên'] || input.employee_id} (${input.employee_id}) không có dữ liệu lương cho kỳ đã chọn`,
          salary_data: null,
          summary: null
        };
      }

      // Tính toán các chỉ số nếu được yêu cầu
      let processedSalaryData = salaryData;
      let summary = null;

      if (input.include_calculations) {
        processedSalaryData = salaryData.map(record => {
          const totalWorkdays = 
            (record.ngay_thuong_chinh_thuc || 0) +
            (record.ngay_thuong_thu_viec || 0) +
            (record.nghi_tuan || 0) +
            (record.le_tet || 0) +
            (record.ngay_thuong_chinh_thuc2 || 0) +
            (record.ngay_thuong_thu_viec3 || 0) +
            (record.nghi_tuan4 || 0) +
            (record.le_tet5 || 0) +
            (record.nghi_nl || 0);

          const salaryPerWorkday = totalWorkdays > 0 
            ? parseFloat(record.tong_thu_nhap?.toString().replace(/,/g, '') || '0') / totalWorkdays 
            : 0;

          return {
            ...record,
            total_workdays: totalWorkdays,
            salary_per_workday: salaryPerWorkday,
            tong_thu_nhap: parseFloat(record.tong_thu_nhap?.toString().replace(/,/g, '') || '0')
          };
        });

        // Tính tổng hợp
        const totalSalary = processedSalaryData.reduce((sum, record) => sum + record.tong_thu_nhap, 0);
        const totalWorkdays = processedSalaryData.reduce((sum, record) => sum + record.total_workdays, 0);
        const averageSalaryPerWorkday = totalWorkdays > 0 ? totalSalary / totalWorkdays : 0;

        summary = {
          total_salary: totalSalary,
          total_workdays: totalWorkdays,
          average_salary_per_workday: averageSalaryPerWorkday,
          months_count: salaryData.length
        };
      }

      return {
        employee_info: {
          ma_nhan_vien: employeeData['Mã nhân viên'] || input.employee_id,
          ho_va_ten: employeeData['Họ và tên'] || 'Không rõ',
          dia_diem: employeeData['Địa điểm'] || 'Không rõ',
          job_title: employeeData['Job title'] || 'Không rõ',
        },
        salary_data: processedSalaryData,
        summary: summary,
        message: `Truy vấn lương thành công cho nhân viên ${employeeData['Họ và tên'] || input.employee_id} (${input.employee_id})`
      };

    } catch (e: any) {
      console.error('Error in getEmployeeSalaryTool:', e);
      return { 
        message: `Lỗi khi truy vấn lương nhân viên: ${e.message}`,
        employee_info: null,
        salary_data: null,
        summary: null
      };
    }
  }
);

// Input schema for Employee Salary Comparison Tool
const EmployeeSalaryComparisonInputSchema = z.object({
  employee_ids: z.array(z.string()).describe('Danh sách mã nhân viên cần so sánh lương'),
  filter_year: z.number().optional().describe('Năm cần truy vấn (mặc định là năm mới nhất)'),
  filter_months: z.array(z.number()).optional().describe('Các tháng cần truy vấn (1-12), mặc định là tất cả tháng'),
  include_rankings: z.boolean().optional().describe('Có sắp xếp theo thứ hạng không'),
});

// Output schema for Employee Salary Comparison Tool
const EmployeeSalaryComparisonOutputSchema = z.object({
  comparison_data: z.array(z.object({
    employee_info: z.object({
      ma_nhan_vien: z.string(),
      ho_va_ten: z.string(),
      dia_diem: z.string().optional(),
      job_title: z.string().optional(),
    }),
    summary: z.object({
      total_salary: z.number(),
      total_workdays: z.number(),
      average_salary_per_workday: z.number(),
      months_count: z.number(),
    }),
    ranking: z.number().optional(),
  })).optional(),
  overall_stats: z.object({
    highest_salary: z.number(),
    lowest_salary: z.number(),
    average_salary: z.number(),
    total_employees: z.number(),
  }).optional(),
  message: z.string(),
});

export type EmployeeSalaryComparisonInput = z.infer<typeof EmployeeSalaryComparisonInputSchema>;
export type EmployeeSalaryComparisonOutput = z.infer<typeof EmployeeSalaryComparisonOutputSchema>;

// Tool for comparing multiple employees' salaries
export const getEmployeeSalaryComparisonTool = ai.defineTool(
  {
    name: 'getEmployeeSalaryComparisonTool',
    description: 'So sánh lương của nhiều nhân viên cùng lúc theo mã nhân viên. Hỗ trợ lọc theo năm và tháng. Có thể sắp xếp theo thứ hạng.',
    inputSchema: EmployeeSalaryComparisonInputSchema,
    outputSchema: EmployeeSalaryComparisonOutputSchema,
  },
  async (input) => {
    try {
      const comparisonData = [];
      
      // Lấy dữ liệu cho từng nhân viên
      for (const employeeId of input.employee_ids) {
        // Lấy thông tin cơ bản của nhân viên
        const { data: employeeData, error: employeeError } = await supabase
          .from('MS_CBNV')
          .select('*')
          .eq('"Mã nhân viên"', employeeId)
          .single();

        if (employeeError || !employeeData) {
          continue; // Bỏ qua nhân viên không tìm thấy
        }

        // Xây dựng query cho bảng Fulltime
        let query = supabase
          .from('Fulltime')
          .select('*')
          .eq('ma_nhan_vien', employeeId);

        if (input.filter_year) {
          query = query.eq('nam', input.filter_year);
        }

        if (input.filter_months && input.filter_months.length > 0) {
          const monthConditions = input.filter_months.map(month => 
            `thang.ilike.%Tháng ${month.toString().padStart(2, '0')}%`
          );
          query = query.or(monthConditions.join(','));
        }

        const { data: salaryData, error: salaryError } = await query.order('nam', { ascending: false }).order('thang', { ascending: true });

        if (salaryError || !salaryData || salaryData.length === 0) {
          continue; // Bỏ qua nhân viên không có dữ liệu lương
        }

        // Tính toán các chỉ số
        const processedSalaryData = salaryData.map(record => {
          const totalWorkdays = 
            (record.ngay_thuong_chinh_thuc || 0) +
            (record.ngay_thuong_thu_viec || 0) +
            (record.nghi_tuan || 0) +
            (record.le_tet || 0) +
            (record.ngay_thuong_chinh_thuc2 || 0) +
            (record.ngay_thuong_thu_viec3 || 0) +
            (record.nghi_tuan4 || 0) +
            (record.le_tet5 || 0) +
            (record.nghi_nl || 0);

          const salaryPerWorkday = totalWorkdays > 0 
            ? parseFloat(record.tong_thu_nhap?.toString().replace(/,/g, '') || '0') / totalWorkdays 
            : 0;

          return {
            ...record,
            total_workdays: totalWorkdays,
            salary_per_workday: salaryPerWorkday,
            tong_thu_nhap: parseFloat(record.tong_thu_nhap?.toString().replace(/,/g, '') || '0')
          };
        });

        // Tính tổng hợp
        const totalSalary = processedSalaryData.reduce((sum, record) => sum + record.tong_thu_nhap, 0);
        const totalWorkdays = processedSalaryData.reduce((sum, record) => sum + record.total_workdays, 0);
        const averageSalaryPerWorkday = totalWorkdays > 0 ? totalSalary / totalWorkdays : 0;

        comparisonData.push({
          employee_info: {
            ma_nhan_vien: employeeData['Mã nhân viên'] || employeeId,
            ho_va_ten: employeeData['Họ và tên'] || 'Không rõ',
            dia_diem: employeeData['Địa điểm'] || 'Không rõ',
            job_title: employeeData['Job title'] || 'Không rõ',
          },
          summary: {
            total_salary: totalSalary,
            total_workdays: totalWorkdays,
            average_salary_per_workday: averageSalaryPerWorkday,
            months_count: salaryData.length
          }
        });
      }

      if (comparisonData.length === 0) {
        return {
          message: 'Không tìm thấy dữ liệu lương cho bất kỳ nhân viên nào trong danh sách',
          comparison_data: null,
          overall_stats: null
        };
      }

      // Sắp xếp theo thứ hạng nếu được yêu cầu
      if (input.include_rankings) {
        comparisonData.sort((a, b) => b.summary.total_salary - a.summary.total_salary);
        comparisonData.forEach((item, index) => {
          item.ranking = index + 1;
        });
      }

      // Tính thống kê tổng thể
      const salaries = comparisonData.map(item => item.summary.total_salary);
      const overallStats = {
        highest_salary: Math.max(...salaries),
        lowest_salary: Math.min(...salaries),
        average_salary: salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length,
        total_employees: comparisonData.length
      };

      return {
        comparison_data: comparisonData,
        overall_stats: overallStats,
        message: `So sánh lương thành công cho ${comparisonData.length} nhân viên`
      };

    } catch (e: any) {
      console.error('Error in getEmployeeSalaryComparisonTool:', e);
      return { 
        message: `Lỗi khi so sánh lương nhân viên: ${e.message}`,
        comparison_data: null,
        overall_stats: null
      };
    }
  }
);