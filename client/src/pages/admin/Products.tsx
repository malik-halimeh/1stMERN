import { useCallback, useEffect, useState } from 'react';
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
import { Package, Plus, Trash2 } from 'lucide-react';

interface Variant {
  sku: string;
  color?: string;
  stock: number;
  priceDeltaCents: number;
  costPriceCents?: number;
  lowStockThreshold: number;
}

interface ProductRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  categoryId?: string;
  basePriceCents: number;
  variants: Variant[];
  ratingAvg?: number;
  reviewCount?: number;
  isTrending?: boolean;
  isMostSelling?: boolean;
}

interface CategoryOption {
  _id: string;
  name: string;
}

interface VariantForm {
  sku: string;
  color: string;
  stock: string;
  priceDelta: string; // dollars
  costPrice: string; // dollars
  lowStockThreshold: string;
}

interface ProductForm {
  name: string;
  brand: string;
  description: string;
  categoryId: string;
  basePrice: string; // dollars
  variants: VariantForm[];
  images: File[];
}

const EMPTY_VARIANT: VariantForm = {
  sku: '',
  color: '',
  stock: '0',
  priceDelta: '0',
  costPrice: '0',
  lowStockThreshold: '5',
};

const EMPTY_FORM: ProductForm = {
  name: '',
  brand: '',
  description: '',
  categoryId: '',
  basePrice: '',
  variants: [{ ...EMPTY_VARIANT }],
  images: [],
};

const inputClass =
  'w-full rounded-input border border-text-disabled bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary';

const dollarsToCents = (v: string) => Math.round(parseFloat(v || '0') * 100);

const AdminProducts = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [searchInput, setSearchInput] = useState(''); // what's typed
  const [search, setSearch] = useState(''); // applied on Enter

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Product CUD endpoints are staff scoped (manager + super admin)
  const canManage = user?.role === 'inventory_manager' || user?.role === 'super_admin';

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search); // full-text search on the server
      const res = await api.get(`/products?${params.toString()}`);
      // Deleting the last row of the last page leaves us past the end — step back
      if (res.data.data.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setProducts(res.data.data);
      setMeta({
        total: res.data.meta?.total ?? res.data.data.length,
        pages: res.data.meta?.pages ?? 1,
      });
    } catch (err) {
      console.error('Failed to fetch products:', err);
      addToast('Failed to load products.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, addToast]);

  const applySearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    // Flatten parent + subcategories into one select list
    api
      .get('/categories')
      .then((res) => {
        const flat: CategoryOption[] = [];
        for (const cat of res.data.data) {
          flat.push({ _id: cat._id, name: cat.name });
          for (const sub of cat.subcategories || []) {
            flat.push({ _id: sub._id, name: `${cat.name} / ${sub.name}` });
          }
        }
        setCategories(flat);
      })
      .catch((err) => console.error('Failed to fetch categories:', err));
  }, []);

  const openCreate = () => {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, variants: [{ ...EMPTY_VARIANT }] });
    setModalOpen(true);
  };


  const openEdit = (p: ProductRow) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      brand: p.brand || '',
      description: p.description || '',
      categoryId: (p.categoryId as string) || '',
      basePrice: (p.basePriceCents / 100).toFixed(2),
      variants: p.variants.map((v) => ({
        sku: v.sku,
        color: v.color || '',
        stock: String(v.stock),
        priceDelta: (v.priceDeltaCents / 100).toFixed(2),
        costPrice: ((v.costPriceCents ?? 0) / 100).toFixed(2),
        lowStockThreshold: String(v.lowStockThreshold),
      })),
      images: [],
    });
    setModalOpen(true);
  };

  const setVariant = (idx: number, patch: Partial<VariantForm>) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }));
  };

  const buildVariantsPayload = () =>
    form.variants
      .filter((v) => v.sku.trim())
      .map((v) => ({
        sku: v.sku.trim(),
        color: v.color.trim() || undefined,
        stock: parseInt(v.stock) || 0,
        priceDeltaCents: dollarsToCents(v.priceDelta),
        costPriceCents: dollarsToCents(v.costPrice),
        lowStockThreshold: parseInt(v.lowStockThreshold) || 0,
      }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.categoryId || !form.basePrice) {
      addToast('Name, description, category, and base price are required.', 'error');
      return;
    }
    const variants = buildVariantsPayload();
    if (variants.length === 0) {
      addToast('At least one variant with an SKU is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct._id}`, {
          name: form.name,
          brand: form.brand || undefined,
          description: form.description,
          categoryId: form.categoryId,
          basePriceCents: dollarsToCents(form.basePrice),
          variants,
        });
        addToast(`Product "${form.name}" updated.`, 'success');
      } else {
        // Create is multipart: variants ride as a JSON string beside image files
        const fd = new FormData();
        fd.append('name', form.name);
        if (form.brand) fd.append('brand', form.brand);
        fd.append('description', form.description);
        fd.append('categoryId', form.categoryId);
        fd.append('basePriceCents', String(dollarsToCents(form.basePrice)));
        fd.append('variants', JSON.stringify(variants));
        for (const file of form.images.slice(0, 5)) {
          fd.append('images', file);
        }
        await api.post('/products', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        addToast(`Product "${form.name}" created.`, 'success');
      }
      setModalOpen(false);
      await fetchProducts();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to save product.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: ProductRow) => {
    if (!window.confirm(`Delete product "${p.name}"? This cannot be undone.`)) return;
    setDeletingId(p._id);
    try {
      await api.delete(`/products/${p._id}`);
      addToast(`Product "${p.name}" deleted.`, 'success');
      await fetchProducts();
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to delete product.'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-primary">{row.name}</span>
          <span className="text-caption text-text-muted font-mono">{row.slug}</span>
        </div>
      ),
    },
    {
      key: 'basePriceCents',
      label: 'Base Price',
      sortable: true,
      render: (row) => (
        <span className="font-semibold">${(row.basePriceCents / 100).toFixed(2)}</span>
      ),
    },
    {
      key: 'variants',
      label: 'Variants',
      render: (row) => <span className="text-text-secondary">{row.variants.length}</span>,
    },
    {
      key: 'stock',
      label: 'Total Stock',
      render: (row) => {
        const total = row.variants.reduce((sum, v) => sum + v.stock, 0);
        const hasLow = row.variants.some((v) => v.stock <= v.lowStockThreshold);
        return (
          <span className={hasLow ? 'text-danger font-semibold' : 'text-text-secondary'}>
            {total}
            {hasLow && ' ⚠'}
          </span>
        );
      },
    },
    {
      key: 'ratingAvg',
      label: 'Rating',
      sortable: true,
      render: (row) => (
        <span className="text-text-secondary">
          {row.ratingAvg ? `${row.ratingAvg.toFixed(1)} ★ (${row.reviewCount ?? 0})` : '—'}
        </span>
      ),
    },
    {
      key: 'flags',
      label: 'Flags',
      render: (row) => (
        <div className="flex gap-1">
          {row.isTrending && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-accent/10 text-accent border border-accent/25">
              Trending
            </span>
          )}
          {row.isMostSelling && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-primary/10 text-primary border border-primary/25">
              Top Seller
            </span>
          )}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: 'Actions',
            render: (row: ProductRow) => (
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(row)}
                  className="text-xs font-semibold text-primary hover:text-primary-dark"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(row)}
                  disabled={deletingId === row._id}
                  className="text-xs font-semibold text-danger hover:text-red-800 disabled:opacity-50"
                >
                  {deletingId === row._id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ),
          } as Column<ProductRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-bold text-primary-dark">Products</h1>
          <p className="mt-1 text-text-secondary">
            Appliance catalog — pricing, variants, and stock levels.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={openCreate}>
            Add Product
          </Button>
        )}
      </div>

      {/* Search by name/keywords (Enter to search, clear + Enter to reset) */}
      <SearchBox
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={applySearch}
        placeholder="Search products…"
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-12 w-12 text-text-muted" />}
          title="No products"
          description={search ? `No products match "${search}".` : 'The catalog is empty.'}
          actionLabel={canManage ? 'Add Product' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={products}
          keyField="_id"
          serverPagination={{
            page,
            pages: meta.pages,
            total: meta.total,
            onPageChange: setPage,
          }}
        />
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? `Edit ${editingProduct.name}` : 'Add Product'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-label text-text-secondary mb-1">Name *</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div className="w-40">
              <label className="block text-label text-text-secondary mb-1">Brand</label>
              <input
                className={inputClass}
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-label text-text-secondary mb-1">Description *</label>
            <textarea
              className={`${inputClass} min-h-20`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Product description"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-label text-text-secondary mb-1">Category *</label>
              <select
                className={inputClass}
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-label text-text-secondary mb-1">Base price ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-label text-text-secondary">Variants *</label>
              <button
                onClick={() => setForm((f) => ({ ...f, variants: [...f.variants, { ...EMPTY_VARIANT }] }))}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark"
              >
                <Plus className="h-3.5 w-3.5" /> Add variant
              </button>
            </div>
            <div className="space-y-3">
              {form.variants.map((v, idx) => (
                <div
                  key={idx}
                  className="border border-dashboard-section-bg rounded-card bg-dashboard-section-bg/30 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">
                      Variant {idx + 1}
                    </span>
                    <button
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.filter((_, i) => i !== idx),
                        }))
                      }
                      disabled={form.variants.length === 1}
                      className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-danger disabled:opacity-30"
                      title="Remove variant"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-label text-text-secondary mb-1">SKU *</label>
                      <input
                        className={inputClass}
                        value={v.sku}
                        onChange={(e) => setVariant(idx, { sku: e.target.value })}
                        placeholder="e.g. FRZ-500-WHT"
                      />
                    </div>
                    <div>
                      <label className="block text-label text-text-secondary mb-1">Color</label>
                      <input
                        className={inputClass}
                        value={v.color}
                        onChange={(e) => setVariant(idx, { color: e.target.value })}
                        placeholder="e.g. White"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-label text-text-secondary mb-1">Stock</label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={v.stock}
                        onChange={(e) => setVariant(idx, { stock: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-label text-text-secondary mb-1">
                        Price delta ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className={inputClass}
                        value={v.priceDelta}
                        onChange={(e) => setVariant(idx, { priceDelta: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-label text-text-secondary mb-1">
                        Cost price ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        value={v.costPrice}
                        onChange={(e) => setVariant(idx, { costPrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-label text-text-secondary mb-1">
                        Low-stock alert
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={v.lowStockThreshold}
                        onChange={(e) => setVariant(idx, { lowStockThreshold: e.target.value })}
                        placeholder="5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Images — create only (the update endpoint doesn't accept files) */}
          {!editingProduct && (
            <div>
              <label className="block text-label text-text-secondary mb-1">
                Images (up to 5)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  setForm({ ...form, images: Array.from(e.target.files || []).slice(0, 5) })
                }
                className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-btn file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-dark"
              />
              {form.images.length > 0 && (
                <p className="mt-1 text-caption text-text-muted">
                  {form.images.length} file{form.images.length === 1 ? '' : 's'} selected
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AdminProducts;
