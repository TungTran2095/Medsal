
'use server';
/**
 * @fileOverview Genkit tools for querying dashboard-specific Supabase RPC functions.
 *
 * This file defines tools that allow the AI to fetch aggregated data
 * relevant to the application's dashboard, such as total salaries,
 * revenue figures, and trends.
 */

import {ai} from '@/ai/genkit';
import {supabase} from '@/lib/supabaseClient';
import {z} from 'genkit';

// Common Input Schema for filters
const DashboardQueryFilterSchema = z.object({
  filter_year: z.number().optional().describe('The year to filter by (e.g., 2023).'),
  filter_months: z.array(z.number()).optional().describe('An array of months to filter by (1-12).'),
});
export type DashboardQueryFilterInput = z.infer<typeof DashboardQueryFilterSchema>;

// Common Trend Input Schema
const TrendQueryFilterSchema = z.object({
  p_filter_year: z.number().optional().describe('The year to filter trends by (e.g., 2023).'),
});

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


// Tool for get_total_salary_fulltime
export const getTotalSalaryFulltimeTool = ai.defineTool(
  {
    name: 'getTotalSalaryFulltimeTool',
    description: 'Fetches the total full-time salary based on optional year and/or month filters. Use this for queries like "tổng lương nhân viên full-time".',
    inputSchema: DashboardQueryFilterSchema,
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_salary_fulltime', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu lương full-time cho kỳ đã chọn.' };
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
    description: 'Fetches the total part-time salary based on optional year and/or month filters. Use for queries like "tổng lương nhân viên part-time".',
    inputSchema: DashboardQueryFilterSchema,
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_salary_parttime', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu lương part-time cho kỳ đã chọn.' };
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
    description: 'Fetches the total revenue based on optional year and/or month filters. Use for queries like "tổng doanh thu".',
    inputSchema: DashboardQueryFilterSchema,
    outputSchema: SingleValueOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_total_revenue', {
        filter_year: input.filter_year,
        filter_months: input.filter_months,
      });
      if (error) throw error;
      if (data === null || data === undefined) return { value: null, message: 'Không có dữ liệu doanh thu cho kỳ đã chọn.' };
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
    description: 'Fetches the monthly salary trend for full-time employees for a given year. Use for "xu hướng lương full-time hàng tháng".',
    inputSchema: TrendQueryFilterSchema,
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_salary_trend_fulltime', {
        p_filter_year: input.p_filter_year,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng lương full-time cho năm đã chọn.' };
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
    description: 'Fetches the monthly salary trend for part-time employees for a given year. Use for "xu hướng lương part-time hàng tháng".',
    inputSchema: TrendQueryFilterSchema,
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_salary_trend_parttime', {
        p_filter_year: input.p_filter_year,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng lương part-time cho năm đã chọn.' };
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
    description: 'Fetches the monthly revenue trend for a given year. Use for "xu hướng doanh thu hàng tháng".',
    inputSchema: TrendQueryFilterSchema,
    outputSchema: TrendDataOutputSchema,
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_revenue_trend', {
        p_filter_year: input.p_filter_year,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu xu hướng doanh thu cho năm đã chọn.' };
      return { data, message: 'Truy vấn xu hướng doanh thu thành công.' };
    } catch (e: any) {
      console.error('Error in getMonthlyRevenueTrendTool:', e);
      return { data: null, message: `Lỗi khi lấy xu hướng doanh thu: ${e.message}` };
    }
  }
);

// Tool for get_salary_revenue_ratio_components_by_location
const LocationRatioInputSchema = z.object({
  p_filter_year: z.number().optional().describe('The year to filter by (e.g., 2023).'),
  p_filter_months: z.array(z.number()).optional().describe('An array of months to filter by (1-12).'),
});
export const getLocationSalaryRevenueRatiosTool = ai.defineTool(
  {
    name: 'getLocationSalaryRevenueRatiosTool',
    description: 'Fetches salary-to-revenue ratio components (FT salary component, PT salary component, total ratio) for each location, based on optional year and month filters. Use for "tỷ lệ quỹ lương trên doanh thu theo địa điểm".',
    inputSchema: LocationRatioInputSchema,
    outputSchema: TrendDataOutputSchema, // Re-using TrendDataOutputSchema as it fits structure {data: array|null, message: string}
  },
  async (input) => {
    try {
      const { data, error } = await supabase.rpc('get_salary_revenue_ratio_components_by_location', {
        p_filter_year: input.p_filter_year,
        p_filter_months: input.p_filter_months,
      });
      if (error) throw error;
      if (!data || data.length === 0) return { data: null, message: 'Không có dữ liệu tỷ lệ quỹ lương/doanh thu theo địa điểm cho kỳ đã chọn.' };
      return { data, message: 'Truy vấn tỷ lệ quỹ lương/doanh thu theo địa điểm thành công.' };
    } catch (e: any) {
      console.error('Error in getLocationSalaryRevenueRatiosTool:', e);
      return { data: null, message: `Lỗi khi lấy tỷ lệ quỹ lương/doanh thu theo địa điểm: ${e.message}` };
    }
  }
);
    