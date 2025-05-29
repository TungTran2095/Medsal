
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  totalSalary: {
    label: 'Total Salary',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

interface TotalSalaryChartProps {
  selectedMonth?: number | null;
  selectedYear?: number | null;
}

export default function TotalSalaryChart({ selectedMonth, selectedYear }: TotalSalaryChartProps) {
  const [totalSalary, setTotalSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("all periods");

  const fetchTotalSalary = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let description = "all periods";
    if (selectedYear && selectedMonth) {
      description = `Month ${selectedMonth}, ${selectedYear}`;
    } else if (selectedYear) {
      description = `Year ${selectedYear}`;
    } else if (selectedMonth) {
      description = `Month ${selectedMonth} (all years)`;
    }
    setFilterDescription(description);

    try {
      // Prepare arguments for RPC call, ensuring nulls are passed if filters are not set
      const rpcArgs: { filter_year?: number; filter_month?: number } = {};
      if (selectedYear !== null && selectedYear !== undefined) {
        rpcArgs.filter_year = selectedYear;
      }
      if (selectedMonth !== null && selectedMonth !== undefined) {
        rpcArgs.filter_month = selectedMonth;
      }

      const { data, error: rpcError } = await supabase.rpc(
        'get_total_salary_fulltime',
        rpcArgs
      );

      if (rpcError) {
        // Check if the error is because the RPC function doesn't exist
        if (rpcError.code === '42883' || (rpcError.message && rpcError.message.toLowerCase().includes("function get_total_salary_fulltime") && rpcError.message.toLowerCase().includes("does not exist"))) {
          throw new Error("The 'get_total_salary_fulltime' RPC function was not found. Please create it in your Supabase SQL Editor. See instructions if needed.");
        }
        throw rpcError;
      }

      // The RPC function directly returns the sum.
      // It might return null if no rows match or if all matching 'tong_thu_nhap' are null.
      setTotalSalary(data === null ? 0 : Number(data));

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch total salary data via RPC.';
      setError(errorMessage);
      console.error("Error fetching total salary via RPC:", JSON.stringify(err, null, 2));
      setTotalSalary(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchTotalSalary();
  }, [fetchTotalSalary]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pt-3 pb-2">
          <CardTitle className="text-destructive text-sm">Error Loading Chart Data</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Please ensure the 'Fulltime' table exists and contains a 'tong_thu_nhap' column with numeric data.
            For filtering to work, it must also contain numeric 'thang' (month) and 'nam' (year) columns.
            If the error mentions 'get_total_salary_fulltime', ensure the RPC function is created in Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (totalSalary === null || totalSalary === 0) { // Handle both null and 0 explicitly for clarity
     return (
      <Card>
        <CardHeader className="pt-3 pb-2">
           <CardTitle className="text-sm text-muted-foreground">Total Fulltime Salary</CardTitle>
           <CardDescription className="text-xs">For: {filterDescription}</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-muted-foreground">No salary data found for the selected period, or the total is zero.</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Data summed from 'tong_thu_nhap' column in 'Fulltime' table using RPC.
            Check if 'thang' and 'nam' columns match your filter and if 'tong_thu_nhap' has values for the period.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    {
      category: `Salary (${filterDescription})`,
      totalSalary: totalSalary,
    },
  ];
  
  const formattedTotalSalary = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND', // Changed to VND as per large numbers
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalSalary);


  return (
    <Card>
      <CardContent className="pt-4 px-2 pb-2">
         <div className="text-2xl font-bold text-primary mb-1">
            {formattedTotalSalary}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Calculated from 'tong_thu_nhap' for {filterDescription} via RPC.
          </p>
        <ChartContainer config={chartConfig} className="mx-auto aspect-auto h-[80px] max-w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 0, top: 0, right: 0, bottom: 0 }} 
          >
            <CartesianGrid horizontal={false} vertical={false} />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              tickMargin={0} 
              axisLine={false}
              className="text-xs sr-only"
              hide 
            />
            <XAxis dataKey="totalSalary" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent 
                indicator="line" 
                hideLabel 
                formatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(value as number)}
              />}
            />
            <Bar
              dataKey="totalSalary"
              fill="var(--color-totalSalary)"
              radius={4}
              barSize={30}
            >
              <LabelList
                position="right"
                offset={8}
                className="fill-foreground text-xs"
                formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', notation: 'compact' }).format(value)}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs p-2">
        <div className="leading-none text-muted-foreground">
          Sum of 'tong_thu_nhap' from 'Fulltime' table (via RPC).
        </div>
      </CardFooter>
    </Card>
  );
}
