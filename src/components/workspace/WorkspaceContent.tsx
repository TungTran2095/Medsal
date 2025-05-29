
"use client";

import React, { useState, ChangeEvent, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Loader2, LayoutDashboard, Database, Sun, Moon } from "lucide-react";
import type { PayrollEntry } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SupabaseTableList from './SupabaseTableList';
import { Separator } from '@/components/ui/separator';
import TotalSalaryCard from '@/components/dashboard/TotalSalaryCard';
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
        const distinctMonths = Array.from(
          new Set(
            data
              .map(item => {
                if (item.thang === null || item.thang === undefined) return null;
                if (typeof item.thang === 'string') {
                  const match = item.thang.match(/\d+/);
                  return match ? parseInt(match[0], 10) : null;
                }
                return Number(item.thang);
              })
              .filter(month => month !== null && month >= 1 && month <= 12) as number[]
          )
        ).sort((a, b) => a - b);
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
          salary: parseFloat(String(row['Salary'] || row['salary'] || row['tong_thu_nhap'] || '0').replace(/,/g, '')),
          pay_date: row['Pay Date'] || row['pay_date'] || '',
        })).filter(entry => entry.employee_id && entry.employee_name && entry.pay_date);

        if (payrollEntries.length === 0 && data.length > 0) {
          toast({
            title: "CSV Parsing Issue",
            description: "Could not parse valid entries. Check CSV headers: 'Employee ID', 'Employee Name', 'Salary' (or 'tong_thu_nhap'), 'Pay Date'.",
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
        let payDateObj = null;
        let thang = null;
        let nam = null;

        if (entry.pay_date) {
          const datePartsDMY = entry.pay_date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
          const datePartsMDY = entry.pay_date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
          const dateISO = entry.pay_date.match(/^\d{4}-\d{2}-\d{2}/);

          if (dateISO) {
             payDateObj = new Date(entry.pay_date);
          } else if (datePartsDMY) {
            payDateObj = new Date(parseInt(datePartsDMY[3]), parseInt(datePartsDMY[2]) - 1, parseInt(datePartsDMY[1]));
          } else if (datePartsMDY) {
            payDateObj = new Date(parseInt(datePartsMDY[3]), parseInt(datePartsMDY[1]) - 1, parseInt(datePartsMDY[2]));
          } else {
             payDateObj = new Date(entry.pay_date);
          }

          if (payDateObj && !isNaN(payDateObj.getTime())) {
            thang = payDateObj.getMonth() + 1;
            nam = payDateObj.getFullYear();
          } else {
            console.warn(`Invalid date format for pay_date: ${entry.pay_date}. Setting thang and nam to null.`);
            payDateObj = null;
          }
        }

        return {
          employee_id: entry.employee_id,
          employee_name: entry.employee_name,
          tong_thu_nhap: entry.salary,
          pay_date: payDateObj ? payDateObj.toISOString().split('T')[0] : null,
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
    <SidebarProvider defaultOpen={false} >
      <Sidebar collapsible="icon">
        <SidebarHeader>
           <div className="flex items-center justify-between p-2">
            <span className="text-base font-semibold text-sidebar-primary group-data-[state=collapsed]:hidden">
              Workspace
            </span>
            <SidebarTrigger className="h-7 w-7" />
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
                    size="sm"
                  >
                    <IconComponent className="h-4 w-4"/>
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
                  className="h-5 w-9 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 [&>span]:h-4 [&>span]:w-4"
                />
                <Moon className="h-4 w-4 text-sidebar-foreground" />
              </div>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex-grow overflow-y-auto p-3 md:p-4"> {/* Adjusted padding for inset */}
        <div className="space-y-3 h-full"> {/* Adjusted spacing */}
          {activeView === 'dbManagement' && (
            <>
              <Card className="w-full flex flex-col shadow-md rounded-lg">
                <CardHeader className="items-center border-b pb-2 pt-3">
                  <FileText className="h-5 w-5 mb-0.5 text-primary" />
                  <CardTitle className="text-base font-bold">Payroll CSV Import</CardTitle>
                  <CardDescription className="text-xs">Import payroll data from CSV files and upload to Supabase 'Fulltime' table.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col p-2 space-y-1">
                  <div className="space-y-0.5">
                    <label htmlFor="payroll-csv-input" className="text-xs font-medium">
                      Upload Payroll CSV
                    </label>
                    <Input
                      id="payroll-csv-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={isLoadingCsv || isUploading}
                      className="file:mr-2 file:py-1 file:px-1.5 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 h-8 text-xs"
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {parsedData.length > 0 && !isLoadingCsv && (
                    <div className="space-y-1 flex-grow flex flex-col min-h-[80px]">
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
                      <div className="flex flex-col items-center justify-center text-muted-foreground py-2 min-h-[50px]">
                          <Loader2 className="h-4 w-4 animate-spin mb-0.5" />
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

              <Separator className="my-2"/> {/* Adjusted margin */}

              <SupabaseTableList />
            </>
          )}
          {activeView === 'dashboard' && (
             <Card className="shadow-md rounded-lg h-full flex flex-col">
              <CardHeader className="pb-3 pt-4 px-4 md:px-6"> {/* Consistent padding */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                      <LayoutDashboard className="h-5 w-5" />
                      Payroll Dashboard
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      Analytics and overview of payroll data from 'Fulltime' table.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 mt-2 sm:mt-0">
                    <div>
                      <Label htmlFor="month-filter" className="text-xs font-medium">Month</Label>
                      <Select
                        value={selectedMonth !== null ? selectedMonth.toString() : "all"}
                        onValueChange={(value) => setSelectedMonth(value === "all" ? null : parseInt(value))}
                        disabled={isLoadingMonths}
                      >
                        <SelectTrigger id="month-filter" className="h-9 text-sm w-full sm:w-[140px] mt-1">
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
                      <Label htmlFor="year-filter" className="text-xs font-medium">Year</Label>
                      <Select
                        value={selectedYear !== null ? selectedYear.toString() : "all"}
                        onValueChange={(value) => setSelectedYear(value === "all" ? null : parseInt(value))}
                      >
                        <SelectTrigger id="year-filter" className="h-9 text-sm w-full sm:w-[120px] mt-1">
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
                </div>
              </CardHeader>
              <CardContent className="pt-3 px-4 md:px-6 pb-4 flex-grow overflow-auto space-y-4"> {/* Consistent padding and spacing */}
                <div className="grid gap-4 md:grid-cols-2"> {/* Adjusted gap */}
                    <TotalSalaryCard selectedMonth={selectedMonth} selectedYear={selectedYear} />
                    <EmployeeCountCard selectedMonth={selectedMonth} selectedYear={selectedYear} />
                </div>
                <div className="mt-0"> {/* Removed unnecessary margin top */}
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

