
"use client";

import React, { useState, ChangeEvent, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Loader2, LayoutDashboard, Database, Sun, Moon, Banknote } from "lucide-react";
import type { PayrollEntry } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SupabaseTableList from './SupabaseTableList';
import { Separator } from '@/components/ui/separator';
import TotalSalaryCard from '@/components/dashboard/TotalSalaryCard'; // Updated import
import EmployeeCountCard from '@/components/dashboard/EmployeeCountCard';
import MonthlySalaryTrendChart from '@/components/charts/MonthlySalaryTrendChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";


type WorkspaceView = 'dbManagement' | 'dashboard';

interface NavItem {
  id: WorkspaceView;
  label: string;
  icon: React.ElementType;
}

export default function WorkspaceContent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PayrollEntry[]>([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<WorkspaceView>('dashboard'); 
  const { theme, toggleTheme } = useTheme();

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear()); 
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [isLoadingMonths, setIsLoadingMonths] = useState<boolean>(true);
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);


  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dbManagement', label: 'Database Management', icon: Database },
  ];

  const fetchDistinctMonths = useCallback(async () => {
    if (activeView !== 'dashboard') return; 
    setIsLoadingMonths(true);
    try {
      const { data, error } = await supabase
        .from('Fulltime')
        .select('thang'); 

      if (error) throw error;

      if (data) {
        const distinctMonths = Array.from(new Set(data.map(item => item.thang).filter(month => month !== null && month !== undefined) as number[]))
          .sort((a, b) => a - b);
        setAvailableMonths(distinctMonths);
      } else {
        setAvailableMonths([]);
      }
    } catch (error: any) {
      console.error("Error fetching distinct months:", error);
      toast({
        title: "Error Fetching Months",
        description: "Could not load month filter options from database.",
        variant: "destructive",
      });
      setAvailableMonths([]);
    } finally {
      setIsLoadingMonths(false);
    }
  }, [activeView, toast]); 

  useEffect(() => {
    fetchDistinctMonths();
  }, [fetchDistinctMonths]); 


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
        event.target.value = ''; 
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
          salary: parseFloat(String(row['Salary'] || row['salary'] || '0').replace(/,/g, '')),
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
      const dataToUpload = parsedData.map(entry => {
        let payDate = null;
        let thang = null;
        let nam = null;
        if (entry.pay_date) {
          try {
            payDate = new Date(entry.pay_date);
            // Check if payDate is valid
            if (!isNaN(payDate.getTime())) {
              thang = payDate.getMonth() + 1;
              nam = payDate.getFullYear();
            } else {
              // Handle invalid date string
              console.warn(`Invalid date format for pay_date: ${entry.pay_date}. Setting thang and nam to null.`);
              payDate = null; // Reset payDate if invalid
            }
          } catch (e) {
            console.warn(`Error parsing pay_date: ${entry.pay_date}. Setting thang and nam to null. Error:`, e);
            payDate = null;
          }
        }

        return {
          employee_id: entry.employee_id,
          employee_name: entry.employee_name,
          tong_thu_nhap: entry.salary, 
          pay_date: payDate ? payDate.toISOString().split('T')[0] : null, // Store as YYYY-MM-DD or null
          thang: thang,
          nam: nam,
        };
      });


      const { error } = await supabase
        .from('Fulltime')
        .insert(dataToUpload);

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
      fetchDistinctMonths(); 

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
    <SidebarProvider defaultOpen={true} >
      <Sidebar collapsible="icon">
        <SidebarHeader>
           <div className="flex items-center justify-between p-2">
            <span className="text-base font-semibold text-sidebar-primary group-data-[state=collapsed]:hidden">
              Workspace
            </span>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-1 flex flex-col">
          <SidebarMenu className="flex-grow">
            {navItems.map(item => {
              const IconComponent = item.icon;
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveView(item.id)}
                    isActive={activeView === item.id}
                    tooltip={{content: item.label, side: "right", align:"center"}}
                  >
                    <IconComponent />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          <div className="mt-auto p-2 group-data-[state=expanded]:border-t group-data-[state=expanded]:border-sidebar-border">
            <div className="flex items-center justify-between group-data-[state=collapsed]:justify-center">
              <Label htmlFor="theme-toggle" className="text-xs text-sidebar-foreground group-data-[state=collapsed]:hidden">
                Theme
              </Label>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-sidebar-foreground" />
                <Switch
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                  aria-label="Toggle theme"
                />
                <Moon className="h-4 w-4 text-sidebar-foreground" />
              </div>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex-grow overflow-y-auto p-1">
        <div className="space-y-1 h-full">
          {activeView === 'dbManagement' && (
            <>
              <Card className="w-full flex flex-col shadow-md rounded-lg">
                <CardHeader className="items-center border-b pb-2 pt-3">
                  <FileText className="h-6 w-6 mb-1 text-primary" />
                  <CardTitle className="text-lg font-bold">Payroll CSV Import</CardTitle>
                  <CardDescription className="text-xs">Import payroll data from CSV files and upload to Supabase 'Fulltime' table.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col p-2 space-y-2">
                  <div className="space-y-1">
                    <label htmlFor="payroll-csv-input" className="text-xs font-medium">
                      Upload Payroll CSV
                    </label>
                    <Input
                      id="payroll-csv-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={isLoadingCsv || isUploading}
                      className="file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 h-8 text-xs"
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {parsedData.length > 0 && !isLoadingCsv && (
                    <div className="space-y-1 flex-grow flex flex-col min-h-[100px]">
                      <h3 className="text-sm font-semibold">Parsed Data Preview (First 5 Rows)</h3>
                      <div className="border rounded-md overflow-x-auto flex-grow">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-1 px-1.5 text-xs">Emp. ID</TableHead>
                              <TableHead className="py-1 px-1.5 text-xs">Emp. Name</TableHead>
                              <TableHead className="py-1 px-1.5 text-xs">Salary</TableHead>
                              <TableHead className="py-1 px-1.5 text-xs">Pay Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedData.slice(0, 5).map((entry, index) => (
                              <TableRow key={index}>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.employee_id}</TableCell>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.employee_name}</TableCell>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.salary.toFixed(2)}</TableCell>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.pay_date}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {parsedData.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Showing first 5 rows of {parsedData.length} total entries.
                        </p>
                      )}
                    </div>
                  )}
                  
                  {(isLoadingCsv && !parsedData.length) && (
                      <div className="flex flex-col items-center justify-center text-muted-foreground py-2 min-h-[60px]">
                          <Loader2 className="h-5 w-5 animate-spin mb-0.5" />
                          <p className="text-xs">Processing file...</p>
                      </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isLoadingCsv || parsedData.length === 0}
                    className="w-full mt-auto text-xs py-1 h-8"
                  >
                    {isUploading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Upload to Supabase Fulltime Table
                  </Button>
                </CardContent>
              </Card>

              <Separator className="my-1"/>

              <SupabaseTableList />
            </>
          )}
          {activeView === 'dashboard' && (
             <Card className="shadow-md rounded-lg h-full flex flex-col">
              <CardHeader className="pt-3 pb-2">
                <div className="flex items-center gap-1.5">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  <div>
                    <CardTitle className="text-base font-semibold">Payroll Dashboard</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Analytics and overview of payroll data from 'Fulltime' table.
                    </CardDescription>
                  </div>
                </div>
                 <div className="flex items-center gap-2 mt-2">
                  <div>
                    <Label htmlFor="month-filter" className="text-xs">Month</Label>
                    <Select
                      value={selectedMonth !== null ? selectedMonth.toString() : "all"}
                      onValueChange={(value) => setSelectedMonth(value === "all" ? null : parseInt(value))}
                      disabled={isLoadingMonths}
                    >
                      <SelectTrigger id="month-filter" className="h-8 text-xs w-[120px]">
                        <SelectValue placeholder="Select Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {isLoadingMonths ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : (
                          availableMonths.map(month => (
                            <SelectItem key={month} value={month.toString()}>
                              {new Date(0, month - 1).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="year-filter" className="text-xs">Year</Label>
                    <Select
                      value={selectedYear !== null ? selectedYear.toString() : "all"}
                      onValueChange={(value) => setSelectedYear(value === "all" ? null : parseInt(value))}
                    >
                      <SelectTrigger id="year-filter" className="h-8 text-xs w-[100px]">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {years.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 px-2 pb-2 flex-grow overflow-auto">
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <TotalSalaryCard selectedMonth={selectedMonth} selectedYear={selectedYear} />
                    <EmployeeCountCard selectedMonth={selectedMonth} selectedYear={selectedYear} />
                    <div className="md:col-span-2 lg:col-span-1"> 
                       {/* Placeholder for potential third KPI card or to balance grid */}
                    </div>
                </div>
                <div className="mt-2">
                    <MonthlySalaryTrendChart selectedYear={selectedYear} />
                </div>

              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
