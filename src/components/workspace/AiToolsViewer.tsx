
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { listAvailableTools, type AiToolInfo } from '@/ai/flows/list-tools-flow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, Settings2, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function AiToolsViewer() {
  const [tools, setTools] = useState<AiToolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAiTools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listAvailableTools();
      setTools(result.tools);
    } catch (e: any) {
      console.error("Error fetching AI tools:", e);
      setError(e.message || "An unexpected error occurred while fetching AI tools.");
      setTools([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAiTools();
  }, [fetchAiTools]);

  return (
    <Card className="shadow-md rounded-lg flex flex-col h-full">
      <CardHeader className="pt-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <CardTitle className="text-lg font-semibold">Công Cụ AI Khả Dụng (Genkit Tools)</CardTitle>
            <CardDescription className="text-xs">
              Danh sách các công cụ (functions) mà chatbot AI có thể sử dụng để tương tác và lấy dữ liệu.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden p-0">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground flex-grow">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p className="text-sm">Đang tải danh sách công cụ AI...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-4 text-destructive bg-destructive/10 p-3 rounded-md flex-grow m-3">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="font-semibold text-md">Lỗi Tải Công Cụ AI</p>
            <p className="text-sm text-center">{error}</p>
          </div>
        )}
        {!isLoading && !error && tools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground flex-grow m-3">
             <Info className="h-8 w-8 mb-2" />
            <p className="text-md font-medium">Không tìm thấy công cụ AI nào.</p>
            <p className="text-sm text-center">Có thể chưa có công cụ nào được định nghĩa hoặc đã xảy ra lỗi khi lấy danh sách.</p>
          </div>
        )}
        {!isLoading && !error && tools.length > 0 && (
          <ScrollArea className="flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
              {tools.map((tool) => (
                <Card key={tool.name} className="shadow-sm break-inside-avoid">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-base font-semibold text-primary">{tool.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1.5 pt-1 pb-3">
                    <p className="text-muted-foreground leading-relaxed">{tool.description}</p>
                    {tool.inputSchema && (
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">Đầu vào (Input Schema):</p>
                        <Badge variant="secondary" className="whitespace-normal text-left font-mono text-[10px] leading-tight p-1.5 h-auto">
                           {tool.inputSchema}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
