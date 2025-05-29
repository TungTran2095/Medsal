
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Banknote } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TotalSalaryCardProps {
  selectedMonths?: number[]; 
  selectedYears?: number[]; // Updated to array
}

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function TotalSalaryCard({ selectedMonths, selectedYears }: TotalSalaryCardProps) {
  const [totalSalary, setTotalSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("all periods");

  const fetchTotalSalary = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let description = "all periods";
    const yearDesc = selectedYears && selectedYears.length > 0 
      ? `Year(s) ${selectedYears.join(', ')}` 
      : "All Years";
    const monthDesc = selectedMonths && selectedMonths.length > 0 
      ? `Month(s) ${selectedMonths.join(', ')}` 
      : "All Months";

    if ((selectedYears && selectedYears.length > 0) && (selectedMonths && selectedMonths.length > 0)) {
      description = `${monthDesc}, ${yearDesc}`;
    } else if (selectedYears && selectedYears.length > 0) {
      description = yearDesc;
    } else if (selectedMonths && selectedMonths.length > 0) {
      description = `${monthDesc} (all years)`;
    }
    setFilterDescription(description);
    

    try {
      const rpcArgs: { filter_years?: number[]; filter_months?: number[] } = {};
      rpcArgs.filter_years = selectedYears && selectedYears.length > 0 ? selectedYears : undefined;
      rpcArgs.filter_months = selectedMonths && selectedMonths.length > 0 ? selectedMonths : undefined;


      const functionName = 'get_total_salary_fulltime';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        
        const isFunctionMissingError =
          rpcError.code === '42883' || 
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) || 
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        if (isFunctionMissingError) {
          throw { 
            type: 'rpcMissing' as 'rpcMissing', 
            message: `The '${functionName}' RPC function was not found. Please create it in your Supabase SQL Editor. See instructions in README.md if needed.` 
          };
        }
        throw { type: 'generic' as 'generic', message: rpcError.message || 'An unknown RPC error occurred.'};
      }

      const rawTotal = data;
      const numericTotal = typeof rawTotal === 'string' 
        ? parseFloat(rawTotal.replace(/,/g, '')) 
        : (typeof rawTotal === 'number' ? rawTotal : 0);
      
      setTotalSalary(numericTotal || 0);

    } catch (err: any) {
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
  }, [selectedMonths, selectedYears, supabase]);

  useEffect(() => {
    fetchTotalSalary();
  }, [fetchTotalSalary]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Fulltime Salary</CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-center h-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-destructive text-sm font-medium flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Salary Data Error
          </CardTitle>
           <Banknote className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              Please create the `get_total_salary_fulltime` function in your Supabase SQL Editor. Refer to the README.md for the SQL script. Ensure `thang` and `nam` columns in `Fulltime` table are numeric or castable.
            </p>
          )}
          {error.type === 'generic' && (
            <p className="text-xs text-muted-foreground mt-1">
              Check 'Fulltime' table structure: 'tong_thu_nhap' (numeric or text convertible to double precision), 'thang' (text like 'Tháng 01', will be parsed to number), and 'nam' (numeric) columns. Ensure RPC function is updated for text 'thang' parsing and correct year handling.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (totalSalary === null || totalSalary === 0) {
     return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
           <CardTitle className="text-sm font-medium text-muted-foreground">Total Fulltime Salary</CardTitle>
           <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
           <div className="text-2xl font-bold text-muted-foreground">
            0 VND
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            No salary data for: {filterDescription}.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const formattedTotalSalary = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalSalary);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Total Fulltime Salary</CardTitle>
        <Banknote className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
         <div className="text-2xl font-bold text-primary">
            {formattedTotalSalary}
          </div>
          <p className="text-xs text-muted-foreground">
            For: {filterDescription}
          </p>
      </CardContent>
    </Card>
  );
}
