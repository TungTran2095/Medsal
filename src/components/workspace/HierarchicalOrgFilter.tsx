
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { OrgNode } from '@/types';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Filter, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HierarchicalOrgFilterProps {
  hierarchy: OrgNode[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  isLoading: boolean;
  error?: string | null;
  triggerButtonLabel?: string;
}

interface OrgCheckboxItemProps {
  node: OrgNode;
  level: number;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}

const OrgCheckboxSubItem: React.FC<OrgCheckboxItemProps> = ({ node, level, selectedIds, onToggle }) => {
  const isSelected = selectedIds.includes(node.id);

  return (
    <>
      <DropdownMenuCheckboxItem
        checked={isSelected}
        onCheckedChange={(checked) => onToggle(node.id, checked as boolean)}
        onSelect={(e) => e.preventDefault()} 
        className="text-xs py-1.5"
        style={{ paddingLeft: `${1 + level * 1.25}rem` }}
      >
        <span className="truncate" title={node.name}>
          {node.name}
        </span>
      </DropdownMenuCheckboxItem>
      {node.children && node.children.length > 0 && (
        <>
          {node.children.map(childNode => (
            <OrgCheckboxSubItem
              key={childNode.id}
              node={childNode}
              level={level + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </>
      )}
    </>
  );
};

export default function HierarchicalOrgFilter({
  hierarchy,
  selectedIds,
  onSelectionChange,
  isLoading,
  error,
  triggerButtonLabel = "Cơ cấu Tổ Chức"
}: HierarchicalOrgFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback((id: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    if (checked) {
      newSelectedIds.add(id);
    } else {
      newSelectedIds.delete(id);
    }
    onSelectionChange(Array.from(newSelectedIds));
  }, [selectedIds, onSelectionChange]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds: string[] = [];
      const getAllIdsRecursive = (nodes: OrgNode[]) => {
        nodes.forEach(node => {
          allIds.push(node.id);
          if (node.children) getAllIdsRecursive(node.children);
        });
      };
      getAllIdsRecursive(hierarchy);
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  };
  
  const isAllSelected = useMemo(() => {
    if (!hierarchy || hierarchy.length === 0) return false;
    const allNodeIds: string[] = [];
    const collectIds = (nodes: OrgNode[]) => {
        nodes.forEach(node => {
            allNodeIds.push(node.id);
            if (node.children) collectIds(node.children);
        });
    };
    collectIds(hierarchy);
    if (allNodeIds.length === 0) return false; 
    return selectedIds.length > 0 && allNodeIds.every(id => selectedIds.includes(id));
  }, [hierarchy, selectedIds]);


  const buttonLabelText = isLoading
    ? "Đang tải CCTC..."
    : error
    ? "Lỗi CCTC"
    : selectedIds.length > 0
    ? `${triggerButtonLabel} (${selectedIds.length})`
    : triggerButtonLabel;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 text-sm min-w-[180px] justify-between px-3">
          <div className="flex items-center gap-1.5 truncate">
            <Filter className="h-3.5 w-3.5 opacity-80 shrink-0" />
            <span className="truncate" title={buttonLabelText}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {buttonLabelText}
            </span>
          </div>
          <ChevronDown className="ml-1 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-[350px] p-0 flex flex-col max-h-[450px]" // Ensure flex column and set max-height
        align="end"
      >
        <div className="p-2 border-b shrink-0"> {/* Header section, does not grow/shrink */}
          <DropdownMenuLabel className="p-0 text-sm flex items-center justify-between">
            <span>Chọn Đơn Vị Theo Cơ Cấu</span>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </DropdownMenuLabel>
        </div>
        
        <ScrollArea className="flex-grow min-h-0"> {/* ScrollArea takes remaining space and handles overflow */}
          <div className="p-2"> {/* Padding for the actual list content */}
            {error && (
              <div className="p-2 text-xs text-destructive bg-destructive/10 m-1 rounded-sm flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0"/> {error}
              </div>
            )}
            {!isLoading && !error && hierarchy.length === 0 && (
                <div className="p-2 text-xs text-muted-foreground text-center">Không có dữ liệu cơ cấu tổ chức.</div>
            )}
            {!isLoading && !error && hierarchy.length > 0 && (
              <>
                <DropdownMenuCheckboxItem
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs font-medium"
                >
                    Chọn Tất Cả / Bỏ Chọn Tất Cả
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator className="my-1"/>
                {hierarchy.map(node => (
                  <OrgCheckboxSubItem
                    key={node.id}
                    node={node}
                    level={0}
                    selectedIds={selectedIds}
                    onToggle={handleToggle}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

