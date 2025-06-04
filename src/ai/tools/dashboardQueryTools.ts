
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


// Tool for get_total_salary_fulltime
export const getTotalSalaryFulltimeTool = ai.defineTool(
  {
    name: 'getTotalSalaryFulltimeTool',
    description: 'Fetches the total full-time salary based on optional year, month, and/or location filters. Use this for queries like "tổng lương nhân viên full-time".',
    inputSchema: DashboardQueryFilterSchema,
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_salary_fulltime', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
        filter_locations: input.filter_locations,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu lương full-time cho kỳ và địa điểm đã chọn.' };
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
    description: 'Fetches the total part-time salary based on optional year, month, and/or location filters. Use for queries like "tổng lương nhân viên part-time".',
    inputSchema: DashboardQueryFilterSchema,
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_salary_parttime', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
        filter_locations: input.filter_locations,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu lương part-time cho kỳ và địa điểm đã chọn.' };
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
    description: 'Fetches the total revenue based on optional year, month, and/or location filters. Use for queries like "tổng doanh thu".',
    inputSchema: DashboardQueryFilterSchema,
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

// Tool for get_monthly_salary_trend_fulltime
export const getMonthlySalaryTrendFulltimeTool = ai.defineTool(
  {
    name: 'getMonthlySalaryTrendFulltimeTool',
    description: 'Fetches the monthly salary trend for full-time employees for a given year and optional locations. Use for "xu hướng lương full-time hàng tháng".',
    inputSchema: TrendQueryFilterSchema,
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_salary_trend_fulltime', {
        p_filter_year: input.p_filter_year,
        p_filter_locations: input.p_filter_locations,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng lương full-time cho năm và địa điểm đã chọn.' };
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
    description: 'Fetches the monthly salary trend for part-time employees for a given year and optional locations. Use for "xu hướng lương part-time hàng tháng".',
    inputSchema: TrendQueryFilterSchema,
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_salary_trend_parttime', {
        p_filter_year: input.p_filter_year,
        p_filter_locations: input.p_filter_locations,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng lương part-time cho năm và địa điểm đã chọn.' };
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
    
    

    