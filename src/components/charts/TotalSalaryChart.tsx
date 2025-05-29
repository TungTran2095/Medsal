
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle } from 'lucide-react'; // AlertTriangle imported
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

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function TotalSalaryChart({ selectedMonth, selectedYear }: TotalSalaryChartProps) {
  const [totalSalary, setTotalSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
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
      const rpcArgs: { filter_year?: number; filter_month?: number } = {};
      if (selectedYear !== null && selectedYear !== undefined) {
        rpcArgs.filter_year = selectedYear;
      }
      if (selectedMonth !== null && selectedMonth !== undefined) {
        rpcArgs.filter_month = selectedMonth;
      }

      const functionName = 'get_total_salary_fulltime';
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
          throw { 
            type: 'rpcMissing', 
            message: `The '${functionName}' RPC function was not found. Please create it in your Supabase SQL Editor. See instructions in README.md if needed.` 
          };
        }
        throw { type: 'generic', message: rpcError.message || 'An unknown RPC error occurred.'};
      }

      const rawTotal = data;
      const numericTotal = typeof rawTotal === 'number' ? rawTotal : 0;
      
      setTotalSalary(numericTotal);

    } catch (err: any) {
      // The 'err' object here is what was thrown from the try block.
      if (err.type === 'rpcMissing') {
        setError(err);
      } else {
        setError({ type: 'generic', message: err.message || 'Failed to fetch total salary data via RPC.' });
      }
      
      console.error("Error fetching total salary via RPC. Details:", {
          type: err.type,
          message: err.message,
          name: err.name,
          code: err.code, 
          stack: err.stack, 
          originalErrorObject: err 
      });
      setTotalSalary(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, supabase]);

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
          <CardTitle className="text-destructive text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Error Loading Chart Data
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              Please create the `get_total_salary_fulltime` function in your Supabase SQL Editor. Refer to the README.md for the SQL script.
            </p>
          )}
          {error.type === 'generic' && (
            <p className="text-xs text-muted-foreground mt-1">
              Check 'Fulltime' table structure: 'tong_thu_nhap' (numeric or text convertible to double precision), 'thang' (numeric), and 'nam' (numeric) columns.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (totalSalary === null || totalSalary === 0) {
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
    currency: 'VND', 
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

