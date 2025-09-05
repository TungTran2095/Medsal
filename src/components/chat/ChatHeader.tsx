"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  MoreVertical, 
  Trash2, 
  Download, 
  Settings, 
  Sparkles,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
  onClearChat: () => void;
  onExportChat: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  messageCount: number;
}

export default function ChatHeader({ 
  isOpen, 
  onToggle, 
  onClearChat, 
  onExportChat,
  searchValue,
  onSearchChange,
  messageCount
}: ChatHeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between p-2 md:p-3">
        {/* Left side - Branding and Search */}
        <div className={cn(
          "flex items-center gap-2 md:gap-3 transition-all duration-300 ease-in-out",
          isOpen ? "opacity-100 max-w-xs" : "opacity-0 max-w-0 pointer-events-none"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm md:text-lg font-semibold text-foreground">AI Assistant</h1>
              <p className="text-xs text-muted-foreground">
                {messageCount > 0 ? `${messageCount} tin nhắn` : 'Sẵn sàng hỗ trợ'}
              </p>
            </div>
          </div>
        </div>

        {/* Center - Search Bar - Hidden on mobile */}
        <div className={cn(
          "hidden md:flex flex-1 max-w-md mx-4 transition-all duration-300 ease-in-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm trong cuộc trò chuyện..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-4 h-9 text-sm rounded-full border-2 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {isOpen && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
                    <MoreVertical className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onClearChat} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa cuộc trò chuyện
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExportChat}>
                    <Download className="w-4 h-4 mr-2" />
                    Xuất cuộc trò chuyện
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Cài đặt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls="chatbot-content-area"
            title={isOpen ? 'Thu gọn Chatbot' : 'Mở rộng Chatbot'}
            className="h-8 w-8 md:h-9 md:w-9 hover:bg-muted/50"
          >
            {isOpen ? <PanelRightClose className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <PanelRightOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />}
            <span className="sr-only">{isOpen ? 'Thu gọn Chatbot' : 'Mở rộng Chatbot'}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
