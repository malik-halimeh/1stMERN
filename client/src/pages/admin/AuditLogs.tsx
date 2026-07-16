import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import SearchBox from '../../components/ui/SearchBox';
import { FileText, Download } from 'lucide-react';
import { exportRowsToCsv, exportToJson, buildExportFilename } from '../../utils/exportData';

interface AuditLogRow {
  _id: string;
  actorName: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId: string;
  changeDelta: { before?: unknown; after?: unknown };
  timestamp: string;
}

type Delta = Record<string, unknown>;
type StockVariant = { sku?: string; stock?: number };

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

// Treat an unknown changeDelta side as a keyed object for field access
const asRecord = (v: unknown): Delta =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Delta) : {};

// Treat an unknown changeDelta side as an array of product variants
const asVariants = (v: unknown): StockVariant[] =>
  Array.isArray(v) ? (v as StockVariant[]) : [];

// Generic fallback: list scalar fields that differ, e.g. `value: 10 → 15`
const changedFields = (beforeVal: unknown, afterVal: unknown): string[] => {
  const before = asRecord(beforeVal);
  const after = asRecord(afterVal);
  const skip = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'usedBy']);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const parts: string[] = [];
  for (const key of keys) {
    if (skip.has(key)) continue;
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    if (typeof b === 'object' && b !== null) continue; // only scalars read well
    if (typeof a === 'object' && a !== null) continue;
    parts.push(`${key}: ${str(b) || '—'} → ${str(a) || '—'}`);
  }
  return parts;
};

// Turn a changeDelta into a human sentence based on the action type
const formatDelta = (row: AuditLogRow): string => {
  const beforeVal = row.changeDelta?.before ?? null;
  const afterVal = row.changeDelta?.after ?? null;
  const before = asRecord(beforeVal);
  const after = asRecord(afterVal);
  try {
    switch (row.actionType) {
      case 'role_change':
        return `Changed role from "${str(before.role)}" to "${str(after.role)}"`;
      case 'account_status_change':
        return after.isActive ? 'Activated the account' : 'Deactivated the account';
      case 'user_delete':
        return `Deleted user "${str(before.name)}" (${str(before.email)}, ${str(before.role)})`;
      case 'order_status_change':
        return `Changed order status from "${str(before.status)}" to "${str(after.status)}"`;
      case 'review_removal':
        return before.rating
          ? `Removed a ${str(before.rating)}-star review`
          : 'Removed a review';
      case 'stock_update': {
        // Product edits log the full variants arrays — report per-SKU stock moves
        if (Array.isArray(beforeVal) || Array.isArray(afterVal)) {
          const prevStock = new Map(
            asVariants(beforeVal).map((v) => [v.sku, v.stock])
          );
          const parts = asVariants(afterVal)
            .filter((v) => prevStock.get(v.sku) !== v.stock)
            .map((v) => `${str(v.sku)}: ${str(prevStock.get(v.sku)) || '—'} → ${str(v.stock)}`);
          return parts.length ? `Stock updated — ${parts.join(', ')}` : 'Stock updated';
        }
        // Low-stock alert resolutions log the alert document
        if (str(after.status) === 'resolved') {
          return `Resolved low-stock alert for "${str(after.variantSku)}"`;
        }
        const parts = changedFields(beforeVal, afterVal);
        return parts.length ? `Stock updated — ${parts.join(', ')}` : 'Stock updated';
      }
      case 'coupon_cud': {
        if (!beforeVal && afterVal) return `Created coupon "${str(after.code)}"`;
        if (beforeVal && !afterVal) return `Deleted coupon "${str(before.code)}"`;
        const parts = changedFields(beforeVal, afterVal);
        return `Updated coupon "${str(after.code || before.code)}"${
          parts.length ? ` — ${parts.join(', ')}` : ''
        }`;
      }
      default: {
        const parts = changedFields(beforeVal, afterVal);
        return parts.length ? parts.join(', ') : '—';
      }
    }
  } catch {
    return '—';
  }
};

const AdminAuditLogs = () => {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  // Filter as you type. Matching the stringified changeDelta means names and
  // SKUs inside the change payload (e.g. stock updates) are searchable too.
  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) =>
      [
        log.actorName,
        log.actionType.replace(/_/g, ' '),
        log.targetEntityType,
        formatDelta(log),
        JSON.stringify(log.changeDelta ?? {}),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [logs, search]);

  // Export ONLY what the search currently shows (filteredLogs), so the file
  // always matches the on-screen result set. CSV opens in Excel/Sheets for
  // ops and finance; JSON keeps the full before/after payload for archival.
  const runExport = (format: 'csv' | 'json') => {
    setExportOpen(false);
    if (filteredLogs.length === 0) return;
    const filename = buildExportFilename('opticart-audit-logs', search, format);
    const count = filteredLogs.length;
    const noun = count === 1 ? 'entry' : 'entries';

    if (format === 'json') {
      exportToJson(filename, filteredLogs);
      addToast(`Exported ${count} audit ${noun} to JSON.`, 'success');
      return;
    }

    exportRowsToCsv(filename, filteredLogs, [
      { header: 'Timestamp (ISO)', value: (r) => new Date(r.timestamp).toISOString() },
      { header: 'Timestamp (Local)', value: (r) => new Date(r.timestamp).toLocaleString() },
      { header: 'Actor', value: (r) => r.actorName },
      { header: 'Action', value: (r) => r.actionType.replace(/_/g, ' ') },
      { header: 'Target Type', value: (r) => r.targetEntityType },
      { header: 'Target ID', value: (r) => str(r.targetEntityId) },
      { header: 'Change Summary', value: (r) => formatDelta(r) },
      { header: 'Before (raw)', value: (r) => JSON.stringify(r.changeDelta?.before ?? null) },
      { header: 'After (raw)', value: (r) => JSON.stringify(r.changeDelta?.after ?? null) },
    ]);
    addToast(`Exported ${count} audit ${noun} to CSV.`, 'success');
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/audit-logs?limit=100');
        setLogs(res.data.data);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        addToast('Failed to load audit logs.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [addToast]);

  const columns: Column<AuditLogRow>[] = [
    {
      key: 'timestamp',
      label: 'Time',
      sortable: true,
      render: (row) => (
        <span className="text-text-secondary whitespace-nowrap">
          {new Date(row.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actorName',
      label: 'Actor',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-text-primary">{row.actorName}</span>
      ),
    },
    {
      key: 'actionType',
      label: 'Action',
      sortable: true,
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25">
          {row.actionType.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'target',
      label: 'Target',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-primary">{row.targetEntityType}</span>
          <span className="text-caption text-text-muted font-mono">{row.targetEntityId}</span>
        </div>
      ),
    },
    {
      key: 'changeDelta',
      label: 'Change',
      render: (row) => (
        <span
          className="text-sm text-text-secondary line-clamp-2 max-w-md block"
          title={JSON.stringify(row.changeDelta ?? {}, null, 2)}
        >
          {formatDelta(row)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Audit Logs</h1>
        <p className="mt-1 text-text-secondary">
          Immutable record of all privileged administrative actions. Search covers the
          latest 100 entries.
        </p>
      </div>

      {/* Filter as you type, and export exactly the filtered result set */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-grow">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search actor, action, SKU…"
          />
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setExportOpen((o) => !o)}
            disabled={filteredLogs.length === 0}
            title={
              search.trim()
                ? `Export the ${filteredLogs.length} entries matching "${search.trim()}"`
                : `Export all ${filteredLogs.length} entries`
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-btn text-sm font-semibold bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
            <span className="text-[11px] font-bold bg-white/20 rounded-full px-2 py-0.5">
              {filteredLogs.length}
            </span>
          </button>
          {exportOpen && (
            <>
              {/* Click-away backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 mt-2 w-60 z-20 bg-surface border border-text-disabled rounded-card shadow-level2 overflow-hidden">
                <div className="px-3 py-2 text-caption text-text-muted border-b border-dashboard-section-bg">
                  {search.trim() ? 'Exporting current search' : 'Exporting all entries'}
                </div>
                <button
                  onClick={() => runExport('csv')}
                  className="w-full text-left px-3 py-2.5 text-sm text-text-primary hover:bg-dashboard-section-bg/50 transition-colors"
                >
                  <span className="font-semibold">CSV</span>
                  <span className="block text-caption text-text-muted">Opens in Excel / Google Sheets</span>
                </button>
                <button
                  onClick={() => runExport('json')}
                  className="w-full text-left px-3 py-2.5 text-sm text-text-primary hover:bg-dashboard-section-bg/50 transition-colors border-t border-dashboard-section-bg"
                >
                  <span className="font-semibold">JSON</span>
                  <span className="block text-caption text-text-muted">Full detail incl. before/after</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12 text-text-muted" />}
          title="No audit entries"
          description={
            search.trim()
              ? `No entries match "${search.trim()}".`
              : 'No privileged actions have been recorded yet.'
          }
        />
      ) : (
        <DataTable columns={columns} data={filteredLogs} keyField="_id" rowsPerPageDefault={15} />
      )}
    </div>
  );
};

export default AdminAuditLogs;
