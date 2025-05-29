
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EmployeeCountCardProps {
  selectedMonth?: number | null;
  selectedYear?: number | null;
}

export default function EmployeeCountCard({ selectedMonth, selectedYear }: EmployeeCountCardProps) {
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("all periods");

  const fetchEmployeeCount = useCallback(async () => {
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

      const functionName = 'get_employee_count_fulltime';
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
          throw new Error(`The '${functionName}' RPC function was not found. Please create it in your Supabase SQL Editor. See instructions provided in the README.md.`);
        }
        throw rpcError;
      }
      
      setEmployeeCount(data as number ?? 0);

    } catch (err: any) {
      let uiErrorMessage = err.message || 'Failed to fetch employee count via RPC.';
      setError(uiErrorMessage);
      console.error("Error fetching employee count via RPC. Details:", {
          message: err.message,
          name: err.name,
          code: err.code,
          stack: err.stack,
          originalErrorObject: err
      });
      setEmployeeCount(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchEmployeeCount();
  }, [fetchEmployeeCount]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle className="text-sm font-medium text-destructive">Employee Count Error</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
           {error.includes("RPC function was not found") && (
             <p className="text-xs text-muted-foreground mt-1">
               Please ensure the `get_employee_count_fulltime` RPC function is created in Supabase as per the README.md.
             </p>
           )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="text-2xl font-bold text-primary">
          {employeeCount !== null ? employeeCount.toLocaleString() : 'N/A'}
        </div>
        <p className="text-xs text-muted-foreground">
          For: {filterDescription}
        </p>
      </CardContent>
    </Card>
  );
}

