"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Trash2, 
  Download, 
  RefreshCw, 
  User,
  MessageSquare
} from 'lucide-react';

interface ChatSessionInfoProps {
  sessionInfo: {
    userId: string;
    sessionId: string;
  };
  messageCount: number;
  onClearMessages: () => void;
  onExportMessages: () => void;
  onCreateNewSession: () => void;
  onRefreshMessages: () => void;
}

export default function ChatSessionInfo({
  sessionInfo,
  messageCount,
  onClearMessages,
  onExportMessages,
  onCreateNewSession,
  onRefreshMessages
}: ChatSessionInfoProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshMessages();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-muted/30">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {sessionInfo.userId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3 text-muted-foreground" />
          <Badge variant="secondary" className="text-xs">
            {messageCount} tin nhắn
          </Badge>
        </div>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-3 w-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Tải lại tin nhắn
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExportMessages}>
            <Download className="h-3 w-3 mr-2" />
            Xuất tin nhắn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCreateNewSession}>
            <MessageSquare className="h-3 w-3 mr-2" />
            Phiên mới
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={onClearMessages}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Xóa tất cả
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

