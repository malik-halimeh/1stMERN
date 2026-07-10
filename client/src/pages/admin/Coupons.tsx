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
import { Ticket } from 'lucide-react';

interface CouponRow {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValueCents: number;
  expiryDate: string;
  usageLimit: number;
  perUserLimit: number;
  usedBy: unknown[];
  isActive: boolean;
}

const AdminCoupons = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Filter as you type over the already-loaded list (endpoint returns all coupons)
  const filteredCoupons = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return coupons;
    return coupons.filter((c) => c.code.toLowerCase().includes(term));
  }, [coupons, search]);

  const canManage = user?.role === 'inventory_manager' || user?.role === 'super_admin';

  const fetchCoupons = useCallback(async () => {
    try {
      const res = await api.get('/coupons');
      setCoupons(res.data.data);
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      addToast('Failed to load coupons.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const toggleActive = async (coupon: CouponRow) => {
    setTogglingId(coupon._id);
    try {
      await api.patch(`/coupons/${coupon._id}`, { isActive: !coupon.isActive });
      addToast(
        `Coupon ${coupon.code} ${coupon.isActive ? 'deactivated' : 'activated'}.`,
        'success'
      );
      await fetchCoupons();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to update coupon.'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const columns: Column<CouponRow>[] = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-text-primary">{row.code}</span>
      ),
    },
    {
      key: 'value',
      label: 'Discount',
      sortable: true,
      render: (row) => (
        <span className="font-semibold">
          {row.type === 'percentage' ? `${row.value}%` : `$${(row.value / 100).toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'minOrderValueCents',
      label: 'Min Order',
      sortable: true,
      render: (row) => (
        <span className="text-text-secondary">
          ${(row.minOrderValueCents / 100).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'expiryDate',
      label: 'Expires',
      sortable: true,
      render: (row) => {
        const expired = new Date(row.expiryDate).getTime() < Date.now();
        return (
          <span className={expired ? 'text-danger font-semibold' : 'text-text-secondary'}>
            {new Date(row.expiryDate).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: 'usage',
      label: 'Usage',
      render: (row) => (
        <span className="text-text-secondary">
          {row.usedBy.length} / {row.usageLimit}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            row.isActive
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-gray-100 text-gray-800 border-gray-200'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: 'Action',
            render: (row: CouponRow) => (
              <Button
                variant="secondary"
                onClick={() => toggleActive(row)}
                disabled={togglingId === row._id}
                className="!px-3 !py-1 text-xs"
              >
                {togglingId === row._id
                  ? 'Saving…'
                  : row.isActive
                    ? 'Deactivate'
                    : 'Activate'}
              </Button>
            ),
          } as Column<CouponRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Coupons</h1>
        <p className="mt-1 text-text-secondary">
          Discount codes — usage, expiry, and activation state.
        </p>
      </div>

      {/* Filter as you type */}
      <SearchBox value={search} onChange={setSearch} placeholder="Search coupon code…" />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-12 w-12 text-text-muted" />}
          title="No coupons"
          description={
            search.trim()
              ? `No coupons match "${search.trim()}".`
              : 'No discount codes have been created yet.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredCoupons}
          keyField="_id"
          rowsPerPageDefault={15}
        />
      )}
    </div>
  );
};

export default AdminCoupons;
