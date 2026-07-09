import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
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

  const canResolve = user?.role === 'inventory_manager';

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
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to resolve alert.';
      addToast(message, 'error');
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

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12 text-text-muted" />}
          title="No low-stock alerts"
          description="All variants are above their stock thresholds."
        />
      ) : (
        <DataTable columns={columns} data={alerts} keyField="_id" rowsPerPageDefault={15} />
      )}
    </div>
  );
};

export default AdminLowStock;
