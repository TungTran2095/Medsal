
"use client";

import React, { useState, useCallback, useMemo } from 'react';
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
import { ChevronDown, Filter, Loader2, AlertTriangle, ChevronRight } from 'lucide-react'; // Added ChevronRight
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
  const [isExpanded, setIsExpanded] = useState(false); // Default to collapsed
  const hasChildren = node.children && node.children.length > 0;

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent checkbox toggle when clicking expander
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  // Calculate base padding for the entire item based on level for indentation
  const baseIndentPadding = `${0.5 + level * 1.25}rem`; // Start with 0.5rem for top level, then indent further

  return (
    <>
      <div 
        className="flex items-center w-full text-xs" 
        style={{ paddingLeft: baseIndentPadding }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={handleExpandToggle}
            className="p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mr-1 shrink-0"
            aria-expanded={isExpanded}
            title={isExpanded ? "Thu gọn" : "Mở rộng"}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          // Placeholder to maintain alignment for items without children (same width as button)
          <span className="w-[calc(0.875rem+0.125rem)] mr-1 shrink-0"></span> // approx (h-3.5) + padding + margin-right
        )}
        <DropdownMenuCheckboxItem
          checked={isSelected}
          onCheckedChange={(checked) => onToggle(node.id, checked as boolean)}
          onSelect={(e) => e.preventDefault()} // Prevent menu close on item select
          className="text-xs py-1.5 flex-grow !pl-2" // Override default pl-8, use !pl-2 for consistent padding near checkbox
                                                 // flex-grow allows it to take remaining space
        >
          <span className="truncate" title={node.name}>
            {node.name}
          </span>
        </DropdownMenuCheckboxItem>
      </div>

      {isExpanded && hasChildren && (
        <>
          {node.children.map(childNode => (
            <OrgCheckboxSubItem
              key={childNode.id}
              node={childNode}
              level={level + 1} // Children are one level deeper
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
        className="w-[350px] p-0 flex flex-col max-h-[450px]" // Set max height for the whole dropdown
        align="end"
      >
        <div className="p-2 border-b shrink-0"> {/* Header section */}
          <DropdownMenuLabel className="p-0 text-sm flex items-center justify-between">
            <span>Chọn Đơn Vị Theo Cơ Cấu</span>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </DropdownMenuLabel>
        </div>
        
        {/* This div will handle the scrolling for the list content */}
        <div className="flex-grow min-h-0 overflow-y-auto"> {/* Apply scroll to this container */}
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
                    level={0} // Start top-level nodes at level 0
                    selectedIds={selectedIds}
                    onToggle={handleToggle}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
