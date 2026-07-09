import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { FileText } from 'lucide-react';

interface AuditLogRow {
  _id: string;
  actorName: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId: string;
  changeDelta: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  timestamp: string;
}

const formatDelta = (delta: AuditLogRow['changeDelta']) => {
  try {
    const before = delta?.before ? JSON.stringify(delta.before) : '';
    const after = delta?.after ? JSON.stringify(delta.after) : '';
    if (!before && !after) return '—';
    return `${before} → ${after}`;
  } catch {
    return '—';
  }
};

const AdminAuditLogs = () => {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

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
        <span className="text-caption font-mono text-text-secondary line-clamp-2 max-w-md block">
          {formatDelta(row.changeDelta)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Audit Logs</h1>
        <p className="mt-1 text-text-secondary">
          Immutable record of all privileged administrative actions.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12 text-text-muted" />}
          title="No audit entries"
          description="No privileged actions have been recorded yet."
        />
      ) : (
        <DataTable columns={columns} data={logs} keyField="_id" rowsPerPageDefault={15} />
      )}
    </div>
  );
};

export default AdminAuditLogs;
