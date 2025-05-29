
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
      let query = supabase
        .from('Fulltime')
        .select('tong_thu_nhap');

      if (selectedYear) {
        query = query.eq('nam', selectedYear);
      }
      if (selectedMonth) {
        query = query.eq('thang', selectedMonth);
      }
      
      const { data, error: dbError } = await query;

      if (dbError) throw dbError;

      if (data) {
        const sum = data.reduce((acc, currentRow) => {
          // Remove commas and then parse to float, handle NaN
          const valueString = String(currentRow.tong_thu_nhap).replace(/,/g, '');
          const value = parseFloat(valueString);
          return acc + (isNaN(value) ? 0 : value);
        }, 0);
        setTotalSalary(sum);
      } else {
        setTotalSalary(0);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch total salary data.';
      setError(errorMessage);
      console.error("Error fetching total salary:", JSON.stringify(err, null, 2));
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
          <CardTitle className="text-destructive text-sm">Error Loading Chart</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Please ensure the 'Fulltime' table exists and contains 'tong_thu_nhap'.
            For filtering to work, it must also contain numeric 'thang' (month) and 'nam' (year) columns.
          </p>
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
          <p className="text-xs text-muted-foreground">No salary data found for the selected period or total is zero.</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Data from 'tong_thu_nhap' column in 'Fulltime' table. Check if 'thang' and 'nam' columns match your filter.
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
    currency: 'USD', // Change as needed
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
            Calculated from 'tong_thu_nhap' for {filterDescription}.
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
                formatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value as number)}
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
                formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(value)}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs p-2">
        <div className="leading-none text-muted-foreground">
          Sum of 'tong_thu_nhap' from 'Fulltime' table.
        </div>
      </CardFooter>
    </Card>
  );
}
