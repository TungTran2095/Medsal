
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
  const [totalRows, setTotalRows] = useState(0);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const from = (currentPage - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;

      const { data: pageData, error: dataError } = await supabase
        .from(tableName)
        .select('*')
        .range(from, to);

      if (dataError) throw dataError;

      if (pageData) {
        setData(pageData as DataRow[]);
        if (pageData.length > 0 && columns.length === 0) {
          setColumns(Object.keys(pageData[0]));
        }
        // A more accurate way to handle total rows would be to fetch count separately or if your API provides it.
        // For now, this estimation helps with 'Next' button logic.
        setTotalRows(from + pageData.length + (pageData.length === ROWS_PER_PAGE ? 1 : 0) );
      } else {
        setData([]);
      }

    } catch (e: any) {
      console.error(`Error fetching data for table ${tableName}:`, JSON.stringify(e, null, 2));
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
  }, [tableName, currentPage, toast]);

  useEffect(() => {
    setColumns([]);
    setCurrentPage(1);
    // fetchData will be called by the next useEffect when currentPage is set to 1 or if fetchData reference changes
  }, [tableName]);

  useEffect(() => {
    if (tableName) { // Ensure tableName is present before fetching
      fetchData();
    }
  }, [currentPage, fetchData, tableName]);


  const renderCellContent = (item: any) => {
    if (item === null || typeof item === 'undefined') return <span className="text-muted-foreground italic text-xs">NULL</span>;
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
      <CardHeader className="pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold">Viewing Table: {tableName}</CardTitle>
              <CardDescription className="text-xs">Displaying rows {Math.max(1,(currentPage - 1) * ROWS_PER_PAGE + 1)} - {Math.min(totalRows, currentPage * ROWS_PER_PAGE)} of approx. {totalRows > data.length ? totalRows-1 : totalRows}</CardDescription>
            </div>
          </div>
          <Button variant="outline" onClick={onBack} size="sm" className="text-xs py-1 h-auto">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Back to Tables
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground flex-grow">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <p className="text-sm">Loading data for {tableName}...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-4 text-destructive bg-destructive/10 p-3 rounded-md flex-grow">
            <AlertTriangle className="h-6 w-6 mb-1" />
            <p className="font-semibold text-sm">Error Loading Data</p>
            <p className="text-xs text-center">{error}</p>
          </div>
        )}
        {!isLoading && !error && data.length === 0 && columns.length > 0 && (
          <p className="text-muted-foreground text-center py-4 text-sm flex-grow">No data found in table {tableName} for the current page.</p>
        )}
        {!isLoading && !error && columns.length === 0 && data.length === 0 && (
           <p className="text-muted-foreground text-center py-4 text-sm flex-grow">Table might be empty or schema could not be determined.</p>
        )}
        {!isLoading && !error && data.length > 0 && columns.length > 0 && (
          <div className="flex-grow overflow-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  {columns.map(colName => (
                    <TableHead key={colName} className="whitespace-nowrap py-1.5 px-2 text-xs">
                      {colName}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map(colName => (
                      <TableCell key={`${rowIndex}-${colName}`} className="whitespace-nowrap max-w-xs truncate hover:whitespace-normal hover:max-w-none hover:bg-muted/20 py-1.5 px-2 text-xs" title={typeof row[colName] === 'string' ? row[colName] as string : undefined}>
                        {renderCellContent(row[colName])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
         <div className="flex items-center justify-end space-x-1 py-2 mt-auto">
            <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || isLoading}
                className="text-xs py-1 h-auto px-2"
            >
                <ChevronLeft className="h-3 w-3 mr-0.5"/>
                Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {currentPage}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!canGoNext || isLoading}
                className="text-xs py-1 h-auto px-2"
            >
                Next
                <ChevronRight className="h-3 w-3 ml-0.5"/>
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}

