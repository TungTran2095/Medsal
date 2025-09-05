"use client";

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  TrendingUp,
  Database,
  HelpCircle
} from 'lucide-react';

interface QuickSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  isLoading: boolean;
}

const suggestions = [
  {
    icon: BarChart3,
    text: "Phân tích doanh thu tháng này",
    category: "analytics"
  },
  {
    icon: Users,
    text: "Hiển thị danh sách nhân viên",
    category: "employees"
  },
  {
    icon: DollarSign,
    text: "Tính toán lương theo bộ phận",
    category: "salary"
  },
  {
    icon: TrendingUp,
    text: "So sánh KPI các tháng",
    category: "kpi"
  },
  {
    icon: Database,
    text: "Truy vấn dữ liệu bảng lương",
    category: "database"
  },
  {
    icon: HelpCircle,
    text: "Hướng dẫn sử dụng hệ thống",
    category: "help"
  }
];

export default function QuickSuggestions({ onSuggestionClick, isLoading }: QuickSuggestionsProps) {
  return (
    <div className="p-2 md:p-3 border-b bg-muted/30">
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Gợi ý nhanh</h3>
      <div className="grid grid-cols-1 gap-1">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          return (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={() => onSuggestionClick(suggestion.text)}
              disabled={isLoading}
              className={cn(
                "justify-start h-auto p-2 text-left hover:bg-primary/5 hover:text-primary",
                "transition-all duration-200 group animate-in fade-in-50 slide-in-from-left-4",
                "hover:scale-[1.02] hover:shadow-sm"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-2 w-full">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-200 group-hover:scale-110">
                  <Icon className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs font-medium truncate">{suggestion.text}</span>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
