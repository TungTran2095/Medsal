
"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListChecks, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { SupabaseTable } from '@/types';
import SupabaseTableDataViewer from './SupabaseTableDataViewer';

export default function SupabaseTableList() {
  const [tables, setTables] = useState<SupabaseTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!selectedTableName) { // Only fetch table list if no table is selected for viewing
      fetchTables();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTableName]); // Re-fetch if selectedTableName becomes null

  const fetchTables = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_public_tables');

      if (rpcError) {
        console.error("Supabase RPC Error Object:", JSON.stringify(rpcError, null, 2));
        const isFunctionNotFoundError = rpcError.code === '42883' || rpcError.code === 'PGRST202';

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
      console.error("Unexpected error fetching Supabase tables:", e);
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
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTableName(tableName);
  };

  const handleBackToTables = () => {
    setSelectedTableName(null);
    // fetchTables will be called by useEffect
  };

  if (selectedTableName) {
    // When a table is selected, SupabaseTableDataViewer takes over the full space
    // as its root Card has h-full and flex flex-col.
    // The parent of SupabaseTableList (in WorkspaceContent) is a flex-grow area.
    return <SupabaseTableDataViewer tableName={selectedTableName} onBack={handleBackToTables} />;
  }

  return (
    <Card className="shadow-md rounded-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <ListChecks className="h-8 w-8 text-primary" />
          <div>
            <CardTitle className="text-xl font-semibold">Supabase Public Tables</CardTitle>
            <CardDescription>List of tables in your public Supabase schema. Click a table to view its data.</CardDescription>
            <p className="text-xs text-muted-foreground mt-1">
              Ensure Row Level Security (RLS) is enabled on your tables if exposing this to non-admin users.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p>Loading tables...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-destructive bg-destructive/10 p-4 rounded-md">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Error Loading Tables</p>
            <p className="text-sm text-center">{error}</p>
            {error.includes("was not found in your Supabase project") && (
                 <p className="text-xs mt-2 text-center">
                    Please refer to the README.md for instructions on how to create the `get_public_tables` function.
                 </p>
            )}
          </div>
        )}
        {!isLoading && !error && tables.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No tables found in the public schema or RPC function returned no data.</p>
        )}
        {!isLoading && !error && tables.length > 0 && (
          <div className="border rounded-md overflow-y-auto"> {/* Removed max-h-80 */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.table_name} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleTableSelect(table.table_name)}>
                    <TableCell className="font-medium">{table.table_name}</TableCell>
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
