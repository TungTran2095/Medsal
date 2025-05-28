
"use client";

import React, { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import type { PayrollEntry } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WorkspaceContent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PayrollEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type !== 'text/csv') {
        toast({
          title: "Invalid File Type",
          description: "Please upload a CSV file.",
          variant: "destructive",
        });
        setSelectedFile(null);
        setParsedData([]);
        event.target.value = ''; // Reset file input
        return;
      }
      setSelectedFile(file);
      parseCsv(file);
    } else {
      setSelectedFile(null);
      setParsedData([]);
    }
  };

  const parseCsv = (file: File) => {
    setIsLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const payrollEntries: PayrollEntry[] = data.map(row => ({
          employee_id: row['Employee ID'] || row['employee_id'] || '',
          employee_name: row['Employee Name'] || row['employee_name'] || '',
          salary: parseFloat(row['Salary'] || row['salary'] || '0'),
          pay_date: row['Pay Date'] || row['pay_date'] || '',
        })).filter(entry => entry.employee_id && entry.employee_name && entry.pay_date); // Basic validation

        if (payrollEntries.length === 0 && data.length > 0) {
          toast({
            title: "CSV Parsing Issue",
            description: "Could not parse valid entries. Check CSV headers: 'Employee ID', 'Employee Name', 'Salary', 'Pay Date'.",
            variant: "destructive",
          });
        } else if (payrollEntries.length > 0) {
          toast({
            title: "CSV Parsed",
            description: `${payrollEntries.length} entries found. Review and upload.`,
          });
        }
        setParsedData(payrollEntries);
        setIsLoading(false);
      },
      error: (error) => {
        toast({
          title: "CSV Parsing Error",
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        setParsedData([]);
      }
    });
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast({
        title: "No Data",
        description: "No data to upload. Please select and parse a CSV file first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Map to Supabase table structure if needed, here assuming it matches PayrollEntry
      const { data, error } = await supabase
        .from('payrolls') // Your Supabase table name
        .insert(parsedData.map(entry => ({
          employee_id: entry.employee_id,
          employee_name: entry.employee_name,
          salary: entry.salary,
          pay_date: entry.pay_date,
        })));

      if (error) {
        throw error;
      }

      toast({
        title: "Upload Successful",
        description: `${parsedData.length} payroll entries uploaded to Supabase.`,
      });
      setParsedData([]); // Clear data after successful upload
      setSelectedFile(null); 
      // Reset file input visually. A bit tricky, often requires a key change or ref.
      // For simplicity, we'll rely on user selecting a new file or re-selecting.
      // Or find the input and reset its value:
      const fileInput = document.getElementById('payroll-csv-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error("Supabase upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col shadow-md rounded-lg">
      <CardHeader className="items-center border-b pb-4">
        <FileText className="h-10 w-10 mb-3 text-primary" />
        <CardTitle className="text-2xl font-bold">Payroll Management</CardTitle>
        <CardDescription>Import payroll data from CSV files and upload to Supabase.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-4 md:p-6 space-y-6">
        <div className="space-y-2">
          <label htmlFor="payroll-csv-input" className="text-sm font-medium">
            Upload Payroll CSV
          </label>
          <Input
            id="payroll-csv-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isLoading}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
           {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {selectedFile.name}
            </p>
          )}
        </div>

        {parsedData.length > 0 && !isLoading && (
          <div className="space-y-4 flex-grow flex flex-col">
            <h3 className="text-lg font-semibold">Parsed Data Preview (First 5 Rows)</h3>
            <div className="border rounded-md overflow-x-auto flex-grow">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Pay Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 5).map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{entry.employee_id}</TableCell>
                      <TableCell>{entry.employee_name}</TableCell>
                      <TableCell>{entry.salary.toFixed(2)}</TableCell>
                      <TableCell>{entry.pay_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
             {parsedData.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                Showing first 5 rows of {parsedData.length} total entries.
              </p>
            )}
          </div>
        )}
        
        {(isLoading && !parsedData.length) && (
             <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>Processing file...</p>
            </div>
        )}


        <Button
          onClick={handleUpload}
          disabled={isLoading || parsedData.length === 0}
          className="w-full mt-auto"
        >
          {isLoading && parsedData.length > 0 ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          Upload to Supabase
        </Button>
      </CardContent>
    </Card>
  );
}
