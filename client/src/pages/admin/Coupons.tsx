import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import SearchBox from '../../components/ui/SearchBox';
import { getApiErrorMessage } from '../../utils/apiError';
import { Plus, Ticket } from 'lucide-react';

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

interface CouponForm {
  code: string;
  type: 'percentage' | 'fixed';
  value: string; // % for percentage, dollars for fixed
  minOrderValue: string; // dollars
  expiryDate: string; // yyyy-mm-dd
  usageLimit: string;
  perUserLimit: string;
}

const EMPTY_COUPON_FORM: CouponForm = {
  code: '',
  type: 'percentage',
  value: '',
  minOrderValue: '0',
  expiryDate: '',
  usageLimit: '100',
  perUserLimit: '1',
};

const inputClass =
  'w-full rounded-input border border-text-disabled bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary';

const AdminCoupons = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(EMPTY_COUPON_FORM);
  const [saving, setSaving] = useState(false);

  // Filter as you type over the already-loaded list (endpoint returns all coupons)
  const filteredCoupons = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return coupons;
    return coupons.filter((c) => c.code.toLowerCase().includes(term));
  }, [coupons, search]);

  const canManage = user?.role === 'inventory_manager' || user?.role === 'super_admin';

  const fetchCoupons = useCallback(async () => {
    try {
      // Server paginates (default 20) — request the max page size so the
      // client-side search box actually covers the whole list
      const res = await api.get('/coupons?limit=100');
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

  const openCreate = () => {
    setForm(EMPTY_COUPON_FORM);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    const code = form.code.trim().toUpperCase();
    const value = parseFloat(form.value);
    const minOrder = parseFloat(form.minOrderValue || '0');
    const usageLimit = parseInt(form.usageLimit);
    const perUserLimit = parseInt(form.perUserLimit);

    if (!code) {
      addToast('Coupon code is required.', 'error');
      return;
    }
    if (isNaN(value) || value <= 0) {
      addToast('Discount value must be a positive number.', 'error');
      return;
    }
    if (form.type === 'percentage' && value > 100) {
      addToast('Percentage discount cannot exceed 100%.', 'error');
      return;
    }
    if (!form.expiryDate || new Date(form.expiryDate).getTime() <= Date.now()) {
      addToast('Expiry date must be in the future.', 'error');
      return;
    }
    if (isNaN(usageLimit) || usageLimit <= 0 || isNaN(perUserLimit) || perUserLimit <= 0) {
      addToast('Usage limits must be at least 1.', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.post('/coupons', {
        code,
        type: form.type,
        // Fixed discounts are stored in cents; percentages as whole numbers
        value: form.type === 'fixed' ? Math.round(value * 100) : value,
        minOrderValueCents: Math.round((isNaN(minOrder) ? 0 : minOrder) * 100),
        expiryDate: form.expiryDate,
        usageLimit,
        perUserLimit,
        isActive: true,
      });
      addToast(`Coupon "${code}" created.`, 'success');
      setModalOpen(false);
      setLoading(true);
      await fetchCoupons();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to create coupon.'), 'error');
    } finally {
      setSaving(false);
    }
  };

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h1 font-bold text-primary-dark">Coupons</h1>
          <p className="mt-1 text-text-secondary">
            Discount codes — usage, expiry, and activation state.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Add Coupon
          </Button>
        )}
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
          actionLabel={canManage && !search.trim() ? 'Add Coupon' : undefined}
          onAction={canManage && !search.trim() ? openCreate : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredCoupons}
          keyField="_id"
          rowsPerPageDefault={15}
        />
      )}

      {/* Create coupon modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Coupon"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create Coupon'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-label text-text-secondary mb-1">Code *</label>
            <input
              className={`${inputClass} uppercase font-mono`}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SUMMER25"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-label text-text-secondary mb-1">Type *</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as CouponForm['type'] })
                }
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-label text-text-secondary mb-1">
                {form.type === 'percentage' ? 'Discount (%) *' : 'Discount ($) *'}
              </label>
              <input
                type="number"
                min="0"
                step={form.type === 'percentage' ? '1' : '0.01'}
                className={inputClass}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'percentage' ? 'e.g. 15' : 'e.g. 10.00'}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-label text-text-secondary mb-1">
                Min order ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.minOrderValue}
                onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-label text-text-secondary mb-1">Expires *</label>
              <input
                type="date"
                className={inputClass}
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-label text-text-secondary mb-1">
                Total usage limit *
              </label>
              <input
                type="number"
                min="1"
                className={inputClass}
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-label text-text-secondary mb-1">
                Per-user limit *
              </label>
              <input
                type="number"
                min="1"
                className={inputClass}
                value={form.perUserLimit}
                onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                placeholder="1"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminCoupons;
