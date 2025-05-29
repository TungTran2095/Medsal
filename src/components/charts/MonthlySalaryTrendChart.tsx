
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, LineChart as LineChartIcon, AlertTriangle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  totalSalary: {
    label: 'Total Salary',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

interface MonthlyData {
  month: number;
  year: number;
  total_salary: number;
  name: string; // For chart display: "MM/YYYY"
}

interface MonthlySalaryTrendChartProps {
  selectedYear?: number | null;
}

const CRITICAL_SETUP_ERROR_PREFIX = "CRITICAL SETUP REQUIRED:";

export default function MonthlySalaryTrendChart({ selectedYear }: MonthlySalaryTrendChartProps) {
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("all years");

  const fetchMonthlyTrend = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let description = selectedYear ? `Year ${selectedYear}` : "all available years";
    setFilterDescription(description);
    
    try {
      const rpcArgs: { p_filter_year?: number } = {};
      if (selectedYear !== null && selectedYear !== undefined) {
        rpcArgs.p_filter_year = selectedYear;
      } else {
        // Handled by RPC default or logic
      }

      const functionName = 'get_monthly_salary_trend_fulltime';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        
        const isFunctionMissingError =
          rpcError.code === '42883' || // PostgreSQL: undefined_function
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) || // PostgREST: "Could not find the function..."
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        if (isFunctionMissingError) {
          throw new Error(`${CRITICAL_SETUP_ERROR_PREFIX} The Supabase RPC function '${functionName}' is missing. This chart cannot display data without it. Please create this function in your Supabase SQL Editor using the script found in the 'Required SQL Functions' section of README.md.`);
        }
        throw rpcError; // Re-throw other RPC errors
      }

      if (data) {
        const formattedData = data.map((item: any) => ({
          ...item,
          name: `${String(item.month).padStart(2, '0')}/${item.year}`,
          total_salary: Number(item.total_salary) || 0,
        }));
        setChartData(formattedData);
      } else {
        setChartData([]);
      }

    } catch (err: any) {
      let uiErrorMessage = err.message || 'Failed to fetch monthly salary trend via RPC.';
      setError(uiErrorMessage);
      console.error("Error fetching monthly salary trend via RPC. Details:", {
          message: err.message,
          name: err.name,
          code: err.code,
          stack: err.stack,
          originalErrorObject: err
      });
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchMonthlyTrend();
  }, [fetchMonthlyTrend]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-medium">Monthly Salary Trend</CardTitle>
          <CardDescription className="text-xs">Loading trend data...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] pt-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-medium text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Monthly Trend Error
          </CardTitle>
           <CardDescription className="text-xs text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {error.startsWith(CRITICAL_SETUP_ERROR_PREFIX) && (
            <p className="text-xs text-muted-foreground mt-1">
              Please refer to the `README.md` file, specifically the "Required SQL Functions" section, for instructions on how to create the missing Supabase function. Double-check for copy-paste errors when running the SQL.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  if (chartData.length === 0) {
    return (
     <Card  className="h-full">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm text-muted-foreground">Monthly Salary Trend</CardTitle>
          <CardDescription className="text-xs">For: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[200px]">
         <p className="text-xs text-muted-foreground">No salary data found for the selected period.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card  className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-medium">Monthly Salary Trend</CardTitle>
        <CardDescription className="text-xs">
          Total salary ('tong_thu_nhap') per month for {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)}
              />
              <Tooltip
                content={<ChartTooltipContent 
                    indicator="line"
                    formatter={(value, name, props) => {
                        // Assuming name is 'total_salary', adjust if dataKey in <Line> changes
                        if (typeof value === 'number') { // Check if value is a number before formatting
                           return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0  }).format(value);
                        }
                        return String(value); // Fallback for non-numeric or unexpected values
                    }}
                />}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="total_salary" // This should match the field name from your RPC
                stroke="var(--color-totalSalary)"
                strokeWidth={2}
                dot={false}
                name="Total Salary" // This name is used by Legend and potentially Tooltip if not overridden
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
