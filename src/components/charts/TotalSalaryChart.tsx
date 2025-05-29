
"use client";

import React, { useState, useEffect } from 'react';
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
    label: 'Total Salary', // Label can remain generic or be updated if needed
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export default function TotalSalaryChart() {
  const [totalSalary, setTotalSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTotalSalary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // NOTE: This fetches all 'tong_thu_nhap' entries and sums them on the client.
        // For very large tables, consider using a Supabase RPC function for aggregation.
        // It uses the 'tong_thu_nhap' column.
        const { data, error: dbError } = await supabase
          .from('Fulltime')
          .select('tong_thu_nhap'); // Changed 'salary' to 'tong_thu_nhap'

        if (dbError) throw dbError;

        if (data) {
          // Changed currentRow.salary to currentRow.tong_thu_nhap
          const sum = data.reduce((acc, currentRow) => acc + (currentRow.tong_thu_nhap || 0), 0);
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
    };
    fetchTotalSalary();
  }, []);

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
        <CardHeader>
          <CardTitle className="text-destructive text-sm">Error Loading Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {/* Updated error guidance */}
            Please ensure the 'Fulltime' table exists and contains a 'tong_thu_nhap' column with numeric values.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (totalSalary === null || totalSalary === 0) {
     return (
      <Card>
        <CardHeader>
           <CardTitle className="text-sm">Total Fulltime Salary</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Updated guidance message */}
          <p className="text-xs text-muted-foreground">No salary data found in the 'tong_thu_nhap' column of the 'Fulltime' table or total is zero.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    {
      category: 'Total Fulltime Salary', // Category label for the chart
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
      <CardContent className="pt-6">
         <div className="text-3xl font-bold text-primary mb-2">
            {formattedTotalSalary}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {/* Updated description */}
            Calculated from the 'tong_thu_nhap' column in the 'Fulltime' table.
          </p>
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[100px] max-w-xs">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 0, top: 0, right: 50, bottom: 0 }} // Adjusted margin
          >
            <CartesianGrid horizontal={false} vertical={false} />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              tickMargin={0} 
              axisLine={false}
              className="text-xs"
              hide // Hiding category label on Y-axis as it's redundant for one bar
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
              barSize={40}
            >
              <LabelList
                position="right"
                offset={8}
                className="fill-foreground text-xs"
                formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-2 text-xs">
        <div className="leading-none text-muted-foreground">
          {/* Updated description */}
          Displaying the sum of all salaries from the 'tong_thu_nhap' column in the Fulltime table.
        </div>
      </CardFooter>
    </Card>
  );
}
