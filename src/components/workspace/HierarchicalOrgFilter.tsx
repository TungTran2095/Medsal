
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
import { ChevronDown, Filter, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const baseIndentPadding = `${0.5 + level * 1.25}rem`;

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
          <span className="w-[calc(0.875rem+0.125rem+0.25rem)] shrink-0"></span>
        )}
        <DropdownMenuCheckboxItem
          checked={isSelected}
          onCheckedChange={(checked) => onToggle(node.id, checked as boolean)}
          onSelect={(e) => e.preventDefault()}
          className="text-xs py-1.5 flex-1 min-w-0"
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

  const getAllDescendantIds = useCallback((nodeId: string, nodes: OrgNode[]): string[] => {
    const descendantIds: string[] = [];
    const findNodeAndDescendants = (currentNodeId: string, currentNodes: OrgNode[]) => {
      const node = currentNodes.find(n => n.id === currentNodeId);
      if (node) {
        node.children.forEach(child => {
          descendantIds.push(child.id);
          findNodeAndDescendants(child.id, node.children); // Continue search from child's children array
        });
      } else { // If not found at current level, search deeper
        currentNodes.forEach(n => {
          if (n.children && n.children.length > 0) {
            findNodeAndDescendants(currentNodeId, n.children);
          }
        });
      }
    };
    
    // Helper to find the initial node in the top-level hierarchy
    const findInitialNodeAndGetDescendants = (searchNodeId: string, hierarchyNodes: OrgNode[]): string[] => {
        const directIds: string[] = [];
        let queue: OrgNode[] = [...hierarchyNodes];
        let head = 0;
        let targetNode: OrgNode | null = null;

        while(head < queue.length){
            const current = queue[head++];
            if(current.id === searchNodeId){
                targetNode = current;
                break;
            }
            if(current.children) queue.push(...current.children);
        }
        
        if (targetNode) {
            const childQueue: OrgNode[] = [...targetNode.children];
            head = 0;
            while(head < childQueue.length){
                const child = childQueue[head++];
                directIds.push(child.id);
                if(child.children) childQueue.push(...child.children);
            }
        }
        return directIds;
    };

    return findInitialNodeAndGetDescendants(nodeId, nodes);
  }, []);


  const handleToggle = useCallback((toggledNodeId: string, checked: boolean) => {
    const newSelectedIdsSet = new Set(selectedIds);
    const descendantIds = getAllDescendantIds(toggledNodeId, hierarchy);

    if (checked) {
      newSelectedIdsSet.add(toggledNodeId);
      descendantIds.forEach(id => newSelectedIdsSet.add(id));
    } else {
      newSelectedIdsSet.delete(toggledNodeId);
      descendantIds.forEach(id => newSelectedIdsSet.delete(id));
    }
    onSelectionChange(Array.from(newSelectedIdsSet));
  }, [selectedIds, onSelectionChange, hierarchy, getAllDescendantIds]);

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
        className="w-[350px] p-0 flex flex-col max-h-[450px]"
        align="end"
      >
        <div className="p-2 border-b shrink-0">
          <DropdownMenuLabel className="p-0 text-sm flex items-center justify-between">
            <span>Chọn Đơn Vị Theo Cơ Cấu</span>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </DropdownMenuLabel>
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto">
          <div className="p-2">
            {error && (
              <div className="p-2 text-xs text-destructive bg-destructive/10 m-1 rounded-sm flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
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
                <DropdownMenuSeparator className="my-1" />
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
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

