import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import SearchBox from '../../components/ui/SearchBox';
import { getApiErrorMessage } from '../../utils/apiError';
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
  feedback?: { rating: number; text: string; createdAt: string } | null;
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

const PAGE_SIZE = 20;

const AdminOrders = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Server-side pagination + search by order number
  const [searchInput, setSearchInput] = useState(''); // what's typed
  const [q, setQ] = useState(''); // applied on Enter
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [reloadKey, setReloadKey] = useState(0);

  // Managers and super admins can both advance order statuses
  const canAdvance = user?.role === 'inventory_manager' || user?.role === 'super_admin';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (q) params.set('q', q);
        const res = await api.get(`/orders?${params.toString()}`, {
          signal: controller.signal,
        });
        // A filter change can leave us past the last page — step back
        if (res.data.data.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setOrders(res.data.data);
        setMeta({
          total: res.data.meta?.total ?? res.data.data.length,
          pages: res.data.meta?.pages ?? 1,
        });
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch orders:', err);
        addToast('Failed to load orders.', 'error');
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [statusFilter, q, page, reloadKey, addToast]);

  const refetchOrders = () => setReloadKey((k) => k + 1);

  const applySearch = () => {
    setQ(searchInput.trim());
    setPage(1);
  };

  const changeStatus = async (order: OrderRow, status: OrderStatus) => {
    setUpdatingId(order._id);
    try {
      await api.patch(`/orders/${order._id}/status`, { status });
      addToast(`Order ${order.orderNumber} moved to ${status}.`, 'success');
      refetchOrders();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to update order status.'), 'error');
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
    {
      key: 'feedback',
      label: 'Feedback',
      render: (row) =>
        row.feedback ? (
          <span
            className="text-amber-500 font-semibold text-xs cursor-help"
            title={row.feedback.text}
          >
            {'★'.repeat(row.feedback.rating)}
            <span className="text-text-disabled">{'★'.repeat(5 - row.feedback.rating)}</span>
          </span>
        ) : (
          <span className="text-caption text-text-muted">—</span>
        ),
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

              // Pending orders get a one-click Confirm action
              if (row.status === 'pending') {
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeStatus(row, 'confirmed')}
                      disabled={isBusy}
                      className="px-2.5 py-1.5 rounded-btn text-xs font-bold bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      {isBusy ? 'Confirming…' : '✓ Confirm'}
                    </button>
                    <button
                      onClick={() => changeStatus(row, 'cancelled')}
                      disabled={isBusy}
                      className="px-2 py-1.5 rounded-btn text-xs font-semibold text-danger border border-danger/30 hover:bg-danger-bg/10 disabled:opacity-50"
                      title="Cancel order"
                    >
                      ✕
                    </button>
                  </div>
                );
              }

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

      {/* Search by order number (Enter to search, clear + Enter to reset) */}
      <SearchBox
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={applySearch}
        placeholder="Search order #…"
      />

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...ALL_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s as OrderStatus | 'all');
              setPage(1);
            }}
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
            q
              ? `No orders match "${q}".`
              : statusFilter === 'all'
                ? 'No orders have been placed yet.'
                : `No orders with status "${statusFilter}".`
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          keyField="_id"
          serverPagination={{
            page,
            pages: meta.pages,
            total: meta.total,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
};

export default AdminOrders;
