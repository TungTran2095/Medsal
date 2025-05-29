
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
// TotalSalaryChart and Select components are removed as per request
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
  const [activeView, setActiveView] = useState<WorkspaceView>('dashboard'); // Default to dashboard
  const { theme, toggleTheme } = useTheme();

  // Removed states and constants related to filters and chart:
  // selectedMonth, selectedYear, availableMonths, isLoadingMonths, currentYear, years

  const navItems: NavItem[] = [
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
      const dataToUpload = parsedData.map(entry => ({
        employee_id: entry.employee_id,
        employee_name: entry.employee_name,
        tong_thu_nhap: entry.salary, 
        pay_date: entry.pay_date,
      }));

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

  // Removed fetchDistinctMonths function and its useEffect call

  return (
    <SidebarProvider defaultOpen={true} >
      <Sidebar collapsible="icon">
        <SidebarHeader>
           <div className="flex items-center justify-between p-2"> {/* Reduced padding */}
            <span className="text-base font-semibold text-sidebar-primary group-data-[state=collapsed]:hidden">
              Workspace
            </span>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-1 flex flex-col"> {/* Use flex-col to allow footer to be at bottom */} {/* Reduced padding */}
          <SidebarMenu className="flex-grow"> {/* Menu takes available space */}
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
          {/* Theme Toggle Section */}
          <div className="mt-auto p-2 group-data-[state=expanded]:border-t group-data-[state=expanded]:border-sidebar-border"> {/* Pushes to bottom when expanded */} {/* Reduced padding */}
            <div className="flex items-center justify-between group-data-[state=collapsed]:justify-center">
              <Label htmlFor="theme-toggle" className="text-xs text-sidebar-foreground group-data-[state=collapsed]:hidden">
                Theme
              </Label>
              <div className="flex items-center gap-2"> {/* Reduced gap */}
                <Sun className="h-4 w-4 text-sidebar-foreground" /> {/* Smaller icon */}
                <Switch
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                  aria-label="Toggle theme"
                />
                <Moon className="h-4 w-4 text-sidebar-foreground" /> {/* Smaller icon */}
              </div>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex-grow overflow-y-auto p-1"> {/* Reduced padding */}
        <div className="space-y-1 h-full"> {/* Reduced spacing */}
          {activeView === 'dbManagement' && (
            <>
              <Card className="w-full flex flex-col shadow-md rounded-lg">
                <CardHeader className="items-center border-b pb-2 pt-3"> {/* Reduced padding */}
                  <FileText className="h-6 w-6 mb-1 text-primary" /> {/* Smaller icon */}
                  <CardTitle className="text-lg font-bold">Payroll CSV Import</CardTitle>
                  <CardDescription className="text-xs">Import payroll data from CSV files and upload to Supabase 'Fulltime' table.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col p-2 space-y-2"> {/* Reduced padding & spacing */}
                  <div className="space-y-1"> {/* Reduced spacing */}
                    <label htmlFor="payroll-csv-input" className="text-xs font-medium">
                      Upload Payroll CSV
                    </label>
                    <Input
                      id="payroll-csv-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={isLoadingCsv || isUploading}
                      className="file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 h-8 text-xs" // Reduced height & text size
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {parsedData.length > 0 && !isLoadingCsv && (
                    <div className="space-y-1 flex-grow flex flex-col min-h-[100px]"> {/* Reduced spacing */}
                      <h3 className="text-sm font-semibold">Parsed Data Preview (First 5 Rows)</h3>
                      <div className="border rounded-md overflow-x-auto flex-grow">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-1 px-1.5 text-xs">Emp. ID</TableHead> {/* Reduced padding & text size */}
                              <TableHead className="py-1 px-1.5 text-xs">Emp. Name</TableHead> {/* Reduced padding & text size */}
                              <TableHead className="py-1 px-1.5 text-xs">Salary</TableHead> {/* Reduced padding & text size */}
                              <TableHead className="py-1 px-1.5 text-xs">Pay Date</TableHead> {/* Reduced padding & text size */}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedData.slice(0, 5).map((entry, index) => (
                              <TableRow key={index}>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.employee_id}</TableCell> {/* Reduced padding & text size */}
                                <TableCell className="py-1 px-1.5 text-xs">{entry.employee_name}</TableCell> {/* Reduced padding & text size */}
                                <TableCell className="py-1 px-1.5 text-xs">{entry.salary.toFixed(2)}</TableCell> {/* Reduced padding & text size */}
                                <TableCell className="py-1 px-1.5 text-xs">{entry.pay_date}</TableCell> {/* Reduced padding & text size */}
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
                      <div className="flex flex-col items-center justify-center text-muted-foreground py-2 min-h-[60px]"> {/* Reduced padding */}
                          <Loader2 className="h-5 w-5 animate-spin mb-0.5" /> {/* Smaller icon */}
                          <p className="text-xs">Processing file...</p>
                      </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isLoadingCsv || parsedData.length === 0}
                    className="w-full mt-auto text-xs py-1 h-8" // Reduced height & text size
                  >
                    {isUploading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> // Smaller icon
                    ) : (
                      <UploadCloud className="mr-1.5 h-3.5 w-3.5" /> // Smaller icon
                    )}
                    Upload to Supabase Fulltime Table
                  </Button>
                </CardContent>
              </Card>

              <Separator className="my-1"/> {/* Reduced margin */}

              <SupabaseTableList />
            </>
          )}
          {activeView === 'dashboard' && (
            <Card className="shadow-md rounded-lg h-full"> {/* Added h-full to make card take full height */}
              <CardHeader className="pt-3 pb-2"> {/* Reduced padding */}
                <div className="flex items-center gap-1.5"> {/* Reduced gap */}
                   <LayoutDashboard className="h-4 w-4 text-primary" /> {/* Smaller icon */}
                  <div>
                      <CardTitle className="text-base font-semibold">Payroll Dashboard</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">Analytics and overview of payroll data.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 px-2 pb-2 h-full"> {/* Reduced padding, Added h-full */}
                {/* Content for the dashboard will go here. Currently blank. */}
                 <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm">Dashboard content is under development.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

