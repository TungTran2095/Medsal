
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, ArrowLeft, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DataRow } from '@/types';

interface SupabaseTableDataViewerProps {
  tableName: string;
  onBack: () => void;
}

const ROWS_PER_PAGE = 10;

export default function SupabaseTableDataViewer({ tableName, onBack }: SupabaseTableDataViewerProps) {
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0); // For enabling/disabling next button
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const from = (currentPage - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;

      // Fetch current page data
      const { data: pageData, error: dataError } = await supabase
        .from(tableName)
        .select('*')
        .range(from, to)
        .order('id', { ascending: true }); // Assuming 'id' column exists for ordering

      if (dataError) throw dataError;

      if (pageData) {
        setData(pageData as DataRow[]);
        if (pageData.length > 0 && columns.length === 0) {
          setColumns(Object.keys(pageData[0]));
        }
        // Estimate if there are more rows for the "Next" button logic
        // A more accurate way is to fetch count, but this is simpler for now
        setTotalRows(from + pageData.length + (pageData.length === ROWS_PER_PAGE ? 1 : 0) ); 
      } else {
        setData([]);
      }

    } catch (e: any) {
      console.error(`Error fetching data for table ${tableName}:`, e);
      const errorMessage = e.message || "An unexpected error occurred while fetching table data.";
      setError(errorMessage);
      toast({
        title: `Error Fetching Data for ${tableName}`,
        description: errorMessage,
        variant: "destructive",
      });
      setData([]);
      setColumns([]);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, currentPage, toast]); // columns is intentionally omitted to avoid re-fetching when columns are set

  useEffect(() => {
    setColumns([]); // Reset columns when table changes
    setCurrentPage(1); // Reset to first page when table changes
    fetchData();
  }, [tableName, fetchData]);
  
  useEffect(() => {
    if (columns.length > 0) { // Only fetch if columns were reset (meaning table changed) or currentPage changed
        fetchData();
    }
  }, [currentPage, columns, fetchData]);


  const renderCellContent = (item: any) => {
    if (item === null || typeof item === 'undefined') return <span className="text-muted-foreground italic">NULL</span>;
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'object') return <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(item, null, 2)}</pre>;
    return String(item);
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };
  
  const canGoNext = data.length === ROWS_PER_PAGE;


  return (
    <Card className="shadow-md rounded-lg flex flex-col h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-7 w-7 text-primary" />
            <div>
              <CardTitle className="text-xl font-semibold">Viewing Table: {tableName}</CardTitle>
              <CardDescription>Displaying rows {Math.max(1,(currentPage - 1) * ROWS_PER_PAGE + 1)} - {Math.min(totalRows, currentPage * ROWS_PER_PAGE)}</CardDescription>
            </div>
          </div>
          <Button variant="outline" onClick={onBack} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tables
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground flex-grow">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p>Loading data for {tableName}...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-destructive bg-destructive/10 p-4 rounded-md flex-grow">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Error Loading Data</p>
            <p className="text-sm text-center">{error}</p>
          </div>
        )}
        {!isLoading && !error && data.length === 0 && columns.length > 0 && (
          <p className="text-muted-foreground text-center py-8 flex-grow">No data found in table {tableName} for the current page.</p>
        )}
        {!isLoading && !error && columns.length === 0 && data.length === 0 && (
           <p className="text-muted-foreground text-center py-8 flex-grow">Table might be empty or schema could not be determined.</p>
        )}
        {!isLoading && !error && data.length > 0 && columns.length > 0 && (
          <div className="flex-grow overflow-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  {columns.map(colName => (
                    <TableHead key={colName} className="whitespace-nowrap">{colName}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map(colName => (
                      <TableCell key={`${rowIndex}-${colName}`} className="whitespace-nowrap max-w-xs truncate hover:whitespace-normal hover:max-w-none hover:bg-muted/20" title={typeof row[colName] === 'string' ? row[colName] : undefined}>
                        {renderCellContent(row[colName])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
         <div className="flex items-center justify-end space-x-2 py-4 mt-auto">
            <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || isLoading}
            >
                <ChevronLeft className="h-4 w-4 mr-1"/>
                Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!canGoNext || isLoading}
            >
                Next
                <ChevronRight className="h-4 w-4 ml-1"/>
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
