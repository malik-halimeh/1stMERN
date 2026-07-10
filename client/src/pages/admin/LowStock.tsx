import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import SearchBox from '../../components/ui/SearchBox';
import { getApiErrorMessage } from '../../utils/apiError';
import { AlertTriangle } from 'lucide-react';

interface AlertRow {
  _id: string;
  productId: { _id: string; name: string } | null;
  variantSku: string;
  currentStock: number;
  thresholdAtTrigger: number;
  status: string;
  createdAt: string;
}

const AdminLowStock = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Filter as you type over the already-loaded list (endpoint returns all alerts)
  const filteredAlerts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return alerts;
    return alerts.filter(
      (a) =>
        (a.productId?.name || '').toLowerCase().includes(term) ||
        a.variantSku.toLowerCase().includes(term)
    );
  }, [alerts, search]);

  const canResolve = user?.role === 'inventory_manager' || user?.role === 'super_admin';

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/low-stock');
      setAlerts(res.data.data);
    } catch (err) {
      console.error('Failed to fetch low-stock alerts:', err);
      addToast('Failed to load low-stock alerts.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const resolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      await api.patch(`/low-stock/${id}/resolve`);
      addToast('Alert resolved.', 'success');
      await fetchAlerts();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to resolve alert.'), 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const columns: Column<AlertRow>[] = [
    {
      key: 'product',
      label: 'Product',
      render: (row) => (
        <span className="font-medium text-text-primary">{row.productId?.name || '—'}</span>
      ),
    },
    {
      key: 'variantSku',
      label: 'Variant SKU',
      sortable: true,
      render: (row) => <span className="font-mono text-text-secondary">{row.variantSku}</span>,
    },
    {
      key: 'currentStock',
      label: 'Stock',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-danger">{row.currentStock}</span>
      ),
    },
    {
      key: 'thresholdAtTrigger',
      label: 'Threshold',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            row.status === 'active'
              ? 'bg-danger/10 text-danger border-danger/25'
              : 'bg-green-100 text-green-800 border-green-200'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Triggered',
      sortable: true,
      render: (row) => (
        <span className="text-text-secondary">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    ...(canResolve
      ? [
          {
            key: 'actions',
            label: 'Action',
            render: (row: AlertRow) =>
              row.status === 'active' ? (
                <Button
                  variant="secondary"
                  onClick={() => resolveAlert(row._id)}
                  disabled={resolvingId === row._id}
                  className="!px-3 !py-1 text-xs"
                >
                  {resolvingId === row._id ? 'Resolving…' : 'Resolve'}
                </Button>
              ) : (
                <span className="text-caption text-text-muted">—</span>
              ),
          } as Column<AlertRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Low Stock Alerts</h1>
        <p className="mt-1 text-text-secondary">
          Variants that have fallen at or below their stock threshold.
        </p>
      </div>

      {/* Filter as you type */}
      <SearchBox value={search} onChange={setSearch} placeholder="Search product or SKU…" />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12 text-text-muted" />}
          title="No low-stock alerts"
          description={
            search.trim()
              ? `No alerts match "${search.trim()}".`
              : 'All variants are above their stock thresholds.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredAlerts}
          keyField="_id"
          rowsPerPageDefault={15}
        />
      )}
    </div>
  );
};

export default AdminLowStock;
