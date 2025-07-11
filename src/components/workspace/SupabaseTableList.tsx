
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Button is not directly used here, but might be in child components or future extensions.
// import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListChecks, Loader2, AlertTriangle } from 'lucide-react'; // ArrowLeft removed as it's for SupabaseTableDataViewer
import type { SupabaseTable } from '@/types';
import SupabaseTableDataViewer from './SupabaseTableDataViewer';

export default function SupabaseTableList() {
  const [tables, setTables] = useState<SupabaseTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_public_tables');

      if (rpcError) {
        console.error("Supabase RPC Error Object:", JSON.stringify(rpcError, null, 2));

        const isFunctionNotFoundError =
          rpcError.code === '42883' || // PostgreSQL: undefined_function
          rpcError.code === 'PGRST202'; // PostgREST: "Could not find the function"

        if (isFunctionNotFoundError) {
           const specificErrorMsg = "The 'get_public_tables' function was not found in your Supabase project. Please create it using the SQL Editor in your Supabase dashboard. See instructions in README.md.";
           setError(specificErrorMsg);
           toast({
            title: "RPC Function Missing",
            description: "The 'get_public_tables' function needs to be created in Supabase.",
            variant: "destructive",
          });
        } else {
          const message = rpcError.message || 'Unknown RPC error';
          const details = rpcError.details ? `Details: ${rpcError.details}` : '';
          const code = rpcError.code ? `Code: ${rpcError.code}` : '';
          const generalErrorMsg = `RPC Error: ${message} ${details} ${code}`.trim();
          setError(generalErrorMsg);
          toast({
            title: "Error Fetching Tables",
            description: message,
            variant: "destructive",
          });
        }
        setTables([]);
      } else if (data) {
        setTables(data as SupabaseTable[]);
      }
    } catch (e: any) {
      console.error("Unexpected error fetching Supabase tables:", JSON.stringify(e, null, 2));
      const unexpectedErrorMsg = e.message || "An unexpected error occurred. Please check the console.";
      setError(unexpectedErrorMsg);
      toast({
        title: "Unexpected Error",
        description: unexpectedErrorMsg,
        variant: "destructive",
      });
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!selectedTableName) {
      fetchTables();
    }
  }, [selectedTableName, fetchTables]);

  const handleTableSelect = (tableName: string) => {
    setSelectedTableName(tableName);
  };

  const handleBackToTables = () => {
    setSelectedTableName(null);
  };

  if (selectedTableName) {
    return <SupabaseTableDataViewer tableName={selectedTableName} onBack={handleBackToTables} />;
  }

  return (
    <Card className="shadow-md rounded-lg">
      <CardHeader className="pt-3 pb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" />
          <div>
            <CardTitle className="text-lg font-semibold">Supabase Public Tables</CardTitle>
            <CardDescription className="text-xs">List of tables in your public Supabase schema. Click a table to view its data.</CardDescription>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ensure Row Level Security (RLS) is enabled on your tables if exposing this to non-admin users.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <p className="text-sm">Loading tables...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-4 text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertTriangle className="h-6 w-6 mb-1" />
            <p className="font-semibold text-sm">Error Loading Tables</p>
            <p className="text-xs text-center">{error}</p>
            {error.includes("was not found in your Supabase project") && (
                 <p className="text-xs mt-1 text-center">
                    Please refer to the README.md for instructions on how to create the `get_public_tables` function.
                 </p>
            )}
          </div>
        )}
        {!isLoading && !error && tables.length === 0 && (
          <p className="text-muted-foreground text-center py-4 text-sm">No tables found in the public schema or RPC function returned no data.</p>
        )}
        {!isLoading && !error && tables.length > 0 && (
          <div className="border rounded-md overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-1.5 px-2 text-xs">Table Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.table_name} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleTableSelect(table.table_name)}>
                    <TableCell className="font-medium py-1.5 px-2 text-xs">{table.table_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
