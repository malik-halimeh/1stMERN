import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { ShoppingBag } from 'lucide-react';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

interface OrderRow {
  _id: string;
  orderNumber: string;
  userId: { _id: string; name: string; email: string } | null;
  items: Array<{ name: string; quantity: number }>;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
}

const ALL_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

// Forward transitions per the server state machine; cancel allowed from any
// non-terminal state
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

const TERMINAL: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-amber-100 text-amber-700 border-amber-200',
};

const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span
    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[status]}`}
  >
    {status}
  </span>
);

const AdminOrders = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Super admins get read-only visibility; only managers advance statuses
  const canAdvance = user?.role === 'inventory_manager';

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
      const res = await api.get(`/orders?limit=100${params}`);
      setOrders(res.data.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      addToast('Failed to load orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, addToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const changeStatus = async (order: OrderRow, status: OrderStatus) => {
    setUpdatingId(order._id);
    try {
      await api.patch(`/orders/${order._id}/status`, { status });
      addToast(`Order ${order.orderNumber} moved to ${status}.`, 'success');
      await fetchOrders();
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message || 'Failed to update order status.';
      addToast(message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const columns: Column<OrderRow>[] = [
    {
      key: 'orderNumber',
      label: 'Order',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-semibold text-text-primary">{row.orderNumber}</span>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-primary">{row.userId?.name || '—'}</span>
          <span className="text-caption text-text-muted">{row.userId?.email || ''}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-text-secondary">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      render: (row) => (
        <span className="text-text-secondary">
          {row.items.reduce((sum, i) => sum + i.quantity, 0)}
        </span>
      ),
    },
    {
      key: 'totalCents',
      label: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-semibold">${(row.totalCents / 100).toFixed(2)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    ...(canAdvance
      ? [
          {
            key: 'actions',
            label: 'Advance',
            render: (row: OrderRow) => {
              if (TERMINAL.includes(row.status)) {
                return <span className="text-caption text-text-muted">Locked</span>;
              }
              const next = NEXT_STATUS[row.status];
              const isBusy = updatingId === row._id;
              return (
                <select
                  value=""
                  disabled={isBusy}
                  onChange={(e) => {
                    if (e.target.value) changeStatus(row, e.target.value as OrderStatus);
                  }}
                  className="text-xs border border-text-disabled rounded-input px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="" disabled>
                    {isBusy ? 'Updating…' : 'Move to…'}
                  </option>
                  {next && <option value={next}>→ {next}</option>}
                  <option value="cancelled">✕ cancelled</option>
                  <option value="refunded">↩ refunded</option>
                </select>
              );
            },
          } as Column<OrderRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Order Fulfillment Queue</h1>
        <p className="mt-1 text-text-secondary">
          {canAdvance
            ? 'Advance order statuses through the fulfillment pipeline.'
            : 'Read-only overview of all customer orders.'}
        </p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...ALL_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s as OrderStatus | 'all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-colors ${
              statusFilter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-text-secondary border-text-disabled hover:border-primary hover:text-primary'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-12 w-12 text-text-muted" />}
          title="No orders found"
          description={
            statusFilter === 'all'
              ? 'No orders have been placed yet.'
              : `No orders with status "${statusFilter}".`
          }
        />
      ) : (
        <DataTable columns={columns} data={orders} keyField="_id" rowsPerPageDefault={15} />
      )}
    </div>
  );
};

export default AdminOrders;
