import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { getApiErrorMessage } from '../../utils/apiError';
import { PackagePlus } from 'lucide-react';

interface VariantOption {
  sku: string;
  color?: string;
  size?: string;
  capacity?: string;
  stock: number;
}

interface ProductOption {
  _id: string;
  name: string;
  variants: VariantOption[];
}

interface PurchaseRow {
  _id: string;
  productId: string;
  productName: string;
  variantSku: string;
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
  note?: string;
  createdByName: string;
  createdAt: string;
}

interface PurchaseForm {
  productId: string;
  variantSku: string;
  quantity: string;
  unitCost: string; // dollars
  note: string;
}

const EMPTY_FORM: PurchaseForm = {
  productId: '',
  variantSku: '',
  quantity: '',
  unitCost: '',
  note: '',
};

const inputClass =
  'w-full rounded-input border border-text-disabled bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary';

const dollarsToCents = (v: string) => Math.round(parseFloat(v || '0') * 100);

const variantLabel = (v: VariantOption) => {
  const traits = [v.color, v.size, v.capacity].filter(Boolean).join(' / ');
  return `${v.sku}${traits ? ` — ${traits}` : ''} (stock: ${v.stock})`;
};

const AdminPurchases = () => {
  const { addToast } = useToast();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PurchaseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await api.get(`/purchases?page=${page}&limit=20`);
      // Deleting the last row of the last page leaves us past the end — step back
      if (res.data.data.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setPurchases(res.data.data);
      setMeta({
        total: res.data.meta?.total ?? res.data.data.length,
        pages: res.data.meta?.pages ?? 1,
      });
    } catch (err) {
      console.error('Failed to fetch purchases:', err);
      addToast('Failed to load purchases.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, addToast]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    // Admin catalog omits inStock so sold-out products are still purchasable
    api
      .get('/products?limit=100')
      .then((res) => setProducts(res.data.data))
      .catch((err) => console.error('Failed to fetch products:', err));
  }, []);

  const selectedProduct = products.find((p) => p._id === form.productId) || null;
  const qtyNum = parseInt(form.quantity) || 0;
  const totalCents = qtyNum > 0 && form.unitCost ? qtyNum * dollarsToCents(form.unitCost) : 0;

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.productId || !form.variantSku) {
      addToast('Product and variant are required.', 'error');
      return;
    }
    if (!qtyNum || qtyNum < 1) {
      addToast('Quantity must be at least 1.', 'error');
      return;
    }
    const unitCostCents = dollarsToCents(form.unitCost);
    if (isNaN(unitCostCents) || unitCostCents < 0) {
      addToast('Unit cost must be a non-negative amount.', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.post('/purchases', {
        productId: form.productId,
        variantSku: form.variantSku,
        quantity: qtyNum,
        unitCostCents,
        note: form.note.trim() || undefined,
      });
      addToast(`Purchase recorded — stock of ${form.variantSku} increased by ${qtyNum}.`, 'success');
      setModalOpen(false);
      setPage(1);
      await fetchPurchases();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to record purchase.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: PurchaseRow) => {
    if (
      !window.confirm(
        `Delete this purchase? Stock of ${row.variantSku} will be reduced by ${row.quantity}. ` +
          'Cost price is not reverted. This cannot be undone.'
      )
    )
      return;
    setDeletingId(row._id);
    try {
      await api.delete(`/purchases/${row._id}`);
      addToast('Purchase deleted and stock reverted.', 'success');
      await fetchPurchases();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to delete purchase.'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<PurchaseRow>[] = [
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-text-secondary whitespace-nowrap">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'productName',
      label: 'Product',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-primary">{row.productName}</span>
          {row.note && <span className="text-caption text-text-muted">{row.note}</span>}
        </div>
      ),
    },
    {
      key: 'variantSku',
      label: 'SKU',
      render: (row) => <span className="text-caption text-text-muted font-mono">{row.variantSku}</span>,
    },
    {
      key: 'quantity',
      label: 'Qty',
      sortable: true,
      render: (row) => <span className="text-text-secondary">{row.quantity}</span>,
    },
    {
      key: 'unitCostCents',
      label: 'Unit Cost',
      render: (row) => <span className="text-text-secondary">${(row.unitCostCents / 100).toFixed(2)}</span>,
    },
    {
      key: 'totalCostCents',
      label: 'Total',
      sortable: true,
      render: (row) => <span className="font-semibold">${(row.totalCostCents / 100).toFixed(2)}</span>,
    },
    {
      key: 'createdByName',
      label: 'By',
      render: (row) => <span className="text-text-secondary">{row.createdByName}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          onClick={() => handleDelete(row)}
          disabled={deletingId === row._id}
          className="text-xs font-semibold text-danger hover:text-red-800 disabled:opacity-50"
        >
          {deletingId === row._id ? 'Deleting…' : 'Delete'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h1 font-bold text-primary-dark">Purchases</h1>
          <p className="mt-1 text-text-secondary">
            Record stock bought from suppliers — quantities are added to inventory automatically.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          Record Purchase
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={<PackagePlus className="h-12 w-12 text-text-muted" />}
          title="No purchases yet"
          description="Record your first stock purchase to start tracking procurement spend."
          actionLabel="Record Purchase"
          onAction={openCreate}
        />
      ) : (
        <DataTable
          columns={columns}
          data={purchases}
          keyField="_id"
          serverPagination={{
            page,
            pages: meta.pages,
            total: meta.total,
            onPageChange: setPage,
          }}
        />
      )}

      {/* Record purchase modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Purchase"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Record Purchase'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-label text-text-secondary mb-1">Product *</label>
            <select
              className={inputClass}
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value, variantSku: '' })}
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-label text-text-secondary mb-1">Variant *</label>
            <select
              className={inputClass}
              value={form.variantSku}
              onChange={(e) => setForm({ ...form, variantSku: e.target.value })}
              disabled={!selectedProduct}
            >
              <option value="">
                {selectedProduct ? 'Select variant…' : 'Select a product first'}
              </option>
              {selectedProduct?.variants.map((v) => (
                <option key={v.sku} value={v.sku}>
                  {variantLabel(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-label text-text-secondary mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                step="1"
                className={inputClass}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="e.g. 20"
              />
            </div>
            <div className="flex-1">
              <label className="block text-label text-text-secondary mb-1">Unit cost ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                placeholder="e.g. 5.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-label text-text-secondary mb-1">Note</label>
            <textarea
              className={`${inputClass} min-h-16`}
              maxLength={500}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional — e.g. supplier invoice #, batch info"
            />
          </div>

          <div className="rounded-card bg-dashboard-section-bg/30 border border-dashboard-section-bg px-3 py-2 text-sm">
            <span className="text-text-secondary">Total: </span>
            <span className="font-semibold text-text-primary">
              ${(totalCents / 100).toFixed(2)}
            </span>
            <span className="text-text-muted">
              {' '}
              — stock will increase by {qtyNum > 0 ? qtyNum : 0} and the variant cost price will
              update to the weighted average.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPurchases;
