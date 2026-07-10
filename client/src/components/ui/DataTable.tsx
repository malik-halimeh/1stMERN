import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import Button from './Button';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

// Controlled pagination driven by the server's meta { total, page, pages }.
// When provided, `data` is treated as one already-fetched page: no client-side
// slicing happens and prev/next delegate to onPageChange (a new fetch).
export interface ServerPagination {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | string;
  onSelectionChange?: (selectedRows: T[]) => void;
  rowsPerPageDefault?: number;
  serverPagination?: ServerPagination;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  onSelectionChange,
  rowsPerPageDefault = 10,
  serverPagination,
}: DataTableProps<T>) {
  // Sort State
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(rowsPerPageDefault);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<any>>(new Set());

  // Column Visibility State
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    new Set(columns.map((c) => c.key))
  );
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  // Toggle Single Column Visibility
  const toggleColumnVisibility = (key: string) => {
    const next = new Set(visibleKeys);
    if (next.has(key)) {
      if (next.size > 1) { // Prevent hiding all columns
        next.delete(key);
      }
    } else {
      next.add(key);
    }
    setVisibleKeys(next);
  };

  // Filter columns based on visibility
  const activeColumns = useMemo(() => {
    return columns.filter((col) => visibleKeys.has(col.key));
  }, [columns, visibleKeys]);

  // Handle Sort Toggle
  const handleSort = (key: string) => {
    if (sortColumn === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  // Sort Data
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;


    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const order = sortDirection === 'asc' ? 1 : -1;
      if (typeof aVal === 'string') {
        return aVal.localeCompare(bVal) * order;
      }
      return (aVal < bVal ? -1 : 1) * order;
    });
  }, [data, sortColumn, sortDirection, columns]);

  // Paginated Data (server mode: data is already a single page — no slicing)
  const paginatedData = useMemo(() => {
    if (serverPagination) return sortedData;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage, serverPagination]);

  const page = serverPagination ? serverPagination.page : currentPage;
  const totalPages = serverPagination
    ? serverPagination.pages
    : Math.ceil(data.length / rowsPerPage) || 1;
  const totalEntries = serverPagination ? serverPagination.total : data.length;

  const goToPage = (p: number) => {
    const next = Math.min(Math.max(p, 1), totalPages);
    if (serverPagination) {
      serverPagination.onPageChange(next);
    } else {
      setCurrentPage(next);
    }
  };

  // Bulk Selection Logic
  const paginatedIds = useMemo(() => {
    return paginatedData.map((row) => row[keyField as string]);
  }, [paginatedData, keyField]);

  const isAllPaginatedSelected = useMemo(() => {
    if (paginatedIds.length === 0) return false;
    return paginatedIds.every((id) => selectedIds.has(id));
  }, [paginatedIds, selectedIds]);

  const handleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllPaginatedSelected) {
      // Deselect all on current page
      paginatedIds.forEach((id) => next.delete(id));
    } else {
      // Select all on current page
      paginatedIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);

    if (onSelectionChange) {
      const selectedRows = data.filter((row) => next.has(row[keyField as string]));
      onSelectionChange(selectedRows);
    }
  };

  const handleSelectRow = (id: any) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);

    if (onSelectionChange) {
      const selectedRows = data.filter((row) => next.has(row[keyField as string]));
      onSelectionChange(selectedRows);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-secondary">
      {/* Table Toolbar */}
      <div className="flex justify-between items-center bg-surface p-4 rounded-card border border-dashboard-section-bg/50 shadow-level1">
        <span className="text-secondary font-medium">
          {selectedIds.size > 0 ? `${selectedIds.size} rows selected` : 'All items'}
        </span>

        {/* Column Visibility Control */}
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setShowColumnToggle(!showColumnToggle)}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          >
            Columns
          </Button>

          {showColumnToggle && (
            <div className="absolute right-0 mt-2 w-56 bg-surface border border-text-disabled rounded-dropdown shadow-level2 z-30 p-2">
              <p className="text-caption text-text-muted px-2 py-1 font-medium border-b border-dashboard-section-bg">
                Toggle Visibility
              </p>
              <div className="max-h-60 overflow-y-auto mt-2">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-dashboard-section-bg rounded-btn cursor-pointer text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={visibleKeys.has(col.key)}
                      onChange={() => toggleColumnVisibility(col.key)}
                      className="rounded border-text-disabled text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto border border-dashboard-section-bg rounded-card bg-surface shadow-level1">
        <table className="w-full text-left border-collapse">
          {/* Header */}
          <thead className="bg-dashboard-section-bg sticky top-0 z-10 select-none">
            <tr className="border-b border-text-disabled/20">
              {onSelectionChange && (
                <th className="p-4 w-12 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={isAllPaginatedSelected}
                    onChange={handleSelectAll}
                    className="rounded border-text-disabled text-primary focus:ring-primary h-4 w-4"
                  />
                </th>
              )}

              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`p-4 font-semibold text-label-sm text-text-primary ${
                    col.sortable ? 'cursor-pointer hover:bg-text-disabled/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="text-text-muted">
                        {sortColumn === col.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-primary" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-dashboard-section-bg text-body">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rIdx) => {
                const isSelected = selectedIds.has(row[keyField as string]);
                return (
                  <tr
                    key={row[keyField as string] || rIdx}
                    className={`transition-colors hover:bg-dashboard-section-bg/30 ${
                      isSelected ? 'bg-primary/5' : 'even:bg-background/20'
                    }`}
                  >
                    {onSelectionChange && (
                      <td className="p-4 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(row[keyField as string])}
                          className="rounded border-text-disabled text-primary focus:ring-primary h-4 w-4"
                        />
                      </td>
                    )}

                    {activeColumns.map((col) => (
                      <td key={col.key} className="p-4 align-middle">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={activeColumns.length + (onSelectionChange ? 1 : 0)}
                  className="p-16 text-center text-text-muted"
                >
                  No items match the query criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center bg-surface p-4 border border-dashboard-section-bg rounded-card shadow-level1 select-none">
        <span className="text-secondary text-caption">
          {serverPagination
            ? `Showing ${data.length} of ${totalEntries} entries · page ${page} of ${totalPages}`
            : `Showing ${data.length ? (currentPage - 1) * rowsPerPage + 1 : 0} to ${Math.min(
                currentPage * rowsPerPage,
                data.length
              )} of ${data.length} entries`}
        </span>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={page === 1}
            onClick={() => goToPage(page - 1)}
            icon={<ChevronLeft className="h-4 w-4" />}
          />
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            icon={<ChevronRight className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}
