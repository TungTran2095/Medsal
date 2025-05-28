
"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListChecks, Loader2, AlertTriangle } from 'lucide-react';
import type { SupabaseTable } from '@/types';

export default function SupabaseTableList() {
  const [tables, setTables] = useState<SupabaseTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTables = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_public_tables');

        if (rpcError) {
          // Log the full error object for better debugging
          console.error("Supabase RPC Error Object:", JSON.stringify(rpcError, null, 2));

          const isFunctionNotFoundError = rpcError.message && 
            (
              (rpcError.message.toLowerCase().includes("public.get_public_tables") && 
                (rpcError.message.toLowerCase().includes("does not exist") || rpcError.message.toLowerCase().includes("could not find"))) ||
              rpcError.code === '42883' || // PostgreSQL undefined_function
              rpcError.code === 'PGRST202'   // PostgREST function not found / incorrect signature
            );

          if (isFunctionNotFoundError) {
             const specificErrorMsg = "The 'get_public_tables' function was not found in your Supabase project. Please create it using the SQL Editor in your Supabase dashboard. See instructions.";
             setError(specificErrorMsg);
             toast({
              title: "RPC Function Missing",
              description: "The 'get_public_tables' function needs to be created in Supabase.",
              variant: "destructive",
            });
          } else {
            // Handle other RPC errors more gracefully
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
          setTables([]); // Ensure tables are cleared on any RPC error
        } else if (data) {
          setTables(data as SupabaseTable[]);
        }
      } catch (e: any) { // Catches unexpected errors (e.g., network issues before RPC call, or bugs in this try block)
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

    fetchTables();
  }, [toast]);

  return (
    <Card className="shadow-md rounded-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <ListChecks className="h-8 w-8 text-primary" />
          <div>
            <CardTitle className="text-xl font-semibold">Supabase Tables</CardTitle>
            <CardDescription>List of tables in your public Supabase schema.</CardDescription>
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
            {/* Check if the error message indicates the specific "function not found" scenario we handled */}
            {error.includes("was not found in your Supabase project") && (
                 <p className="text-xs mt-2 text-center">
                    Please create the `get_public_tables` function in your Supabase SQL editor.
                    <br />
                    <code>
                      create or replace function get_public_tables() returns table (table_name text) language sql as $$ select tablename::text from pg_catalog.pg_tables where schemaname = 'public' order by tablename; $$;
                    </code>
                 </p>
            )}
          </div>
        )}
        {!isLoading && !error && tables.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No tables found in the public schema or RPC function returned no data.</p>
        )}
        {!isLoading && !error && tables.length > 0 && (
          <div className="border rounded-md max-h-60 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table, index) => (
                  <TableRow key={index}>
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
