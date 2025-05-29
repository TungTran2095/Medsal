
"use client";

import React, { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Loader2, LayoutDashboard, Database } from "lucide-react";
import type { PayrollEntry } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SupabaseTableList from './SupabaseTableList';
import { Separator } from '@/components/ui/separator';
import TotalSalaryChart from '@/components/charts/TotalSalaryChart'; // New import

type WorkspaceView = 'dbManagement' | 'dashboard';

export default function WorkspaceContent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PayrollEntry[]>([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<WorkspaceView>('dbManagement');

  const navItems: { id: WorkspaceView; label: string; icon: React.ElementType }[] = [
    { id: 'dbManagement', label: 'Database Management', icon: Database },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

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
    setIsLoadingCsv(true);
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
        })).filter(entry => entry.employee_id && entry.employee_name && entry.pay_date);

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
        setIsLoadingCsv(false);
      },
      error: (error) => {
        toast({
          title: "CSV Parsing Error",
          description: error.message,
          variant: "destructive",
        });
        setIsLoadingCsv(false);
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

    setIsUploading(true);
    try {
      const { data, error } = await supabase
        .from('Fulltime')
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
        description: `${parsedData.length} payroll entries uploaded to Supabase table 'Fulltime'.`,
      });
      setParsedData([]);
      setSelectedFile(null);
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
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b">
        {navItems.map(item => {
          const IconComponent = item.icon;
          return (
            <Button
              key={item.id}
              variant={activeView === item.id ? "secondary" : "ghost"}
              onClick={() => setActiveView(item.id)}
              className="py-3 px-4 rounded-none border-b-2 data-[state=active]:border-primary data-[state=inactive]:border-transparent text-sm font-medium"
              data-state={activeView === item.id ? 'active' : 'inactive'}
            >
              <IconComponent className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
        {activeView === 'dbManagement' && (
          <>
            <Card className="w-full flex flex-col shadow-md rounded-lg">
              <CardHeader className="items-center border-b pb-4">
                <FileText className="h-10 w-10 mb-3 text-primary" />
                <CardTitle className="text-2xl font-bold">Payroll CSV Import</CardTitle>
                <CardDescription>Import payroll data from CSV files and upload to Supabase 'Fulltime' table.</CardDescription>
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
                    disabled={isLoadingCsv || isUploading}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>

                {parsedData.length > 0 && !isLoadingCsv && (
                  <div className="space-y-4 flex-grow flex flex-col min-h-[200px]">
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
                
                {(isLoadingCsv && !parsedData.length) && (
                    <div className="flex flex-col items-center justify-center text-muted-foreground py-8 min-h-[100px]">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p>Processing file...</p>
                    </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={isUploading || isLoadingCsv || parsedData.length === 0}
                  className="w-full mt-auto"
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-2 h-4 w-4" />
                  )}
                  Upload to Supabase Fulltime Table
                </Button>
              </CardContent>
            </Card>

            <Separator />

            <SupabaseTableList />
          </>
        )}
        {activeView === 'dashboard' && (
          <Card className="shadow-md rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                 <LayoutDashboard className="h-6 w-6 text-primary" /> {/* Icon size adjusted */}
                <div>
                    <CardTitle className="text-lg font-semibold">Payroll Dashboard</CardTitle> {/* Size adjusted */}
                    <CardDescription className="text-xs text-muted-foreground">Analytics and overview of payroll data.</CardDescription> {/* Size adjusted */}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4"> {/* Added padding top */}
              <h3 className="text-md font-semibold mb-2">Total Fulltime Salary</h3>
              <TotalSalaryChart />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
