import { useCallback, useEffect, useRef, useState } from 'react';
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
import { isUsableImageUrl } from '../../utils/productImage';
import { GripVertical, ImagePlus, Link2, Package, Plus, RefreshCw, Trash2, X } from 'lucide-react';

interface VariantImage {
  url: string;
  publicId: string;
}

interface Variant {
  sku: string;
  color?: string;
  size?: string;
  capacity?: string;
  stock: number;
  priceDeltaCents: number;
  costPriceCents?: number;
  lowStockThreshold: number;
  /** Ordered variant photos — images[0] is the variant's default image */
  images?: VariantImage[];
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

/**
 * One image tile in a variant's ordered image list. Either a freshly chosen
 * file (upload pending, previewed via an object URL) or an image that already
 * has a real URL (stored on the server, or pasted by the admin).
 */
interface VariantImageEntry {
  key: string; // stable local id for React keys and drag-reorder
  file: File | null;
  url: string; // object URL for files, the real URL otherwise
  publicId?: string; // present for images already stored on the server
}

interface VariantForm {
  sku: string;
  color: string;
  capacity: string;
  size: string; // pass-through only (kept so edits don't erase it)
  stock: string;
  priceDelta: string; // dollars
  costPrice: string; // dollars
  lowStockThreshold: string;
  images: VariantImageEntry[]; // ordered — first image is the variant's default
}

interface ProductForm {
  name: string;
  brand: string;
  description: string;
  categoryId: string;
  basePrice: string; // dollars
  variants: VariantForm[];
}

const EMPTY_VARIANT: VariantForm = {
  sku: '',
  color: '',
  capacity: '',
  size: '',
  stock: '0',
  priceDelta: '0',
  costPrice: '0',
  lowStockThreshold: '5',
  images: [],
};

const EMPTY_FORM: ProductForm = {
  name: '',
  brand: '',
  description: '',
  categoryId: '',
  basePrice: '',
  variants: [{ ...EMPTY_VARIANT }],
};

const inputClass =
  'w-full rounded-input border border-text-disabled bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary';

const dollarsToCents = (v: string) => Math.round(parseFloat(v || '0') * 100);

// Matches the server's multer limit — oversized files used to surface as an
// opaque 500 ("File too large"), so we reject them before the request now.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

let imageEntryCounter = 0;
const nextEntryKey = () => `img-${++imageEntryCounter}`;

const fileEntry = (file: File): VariantImageEntry => ({
  key: nextEntryKey(),
  file,
  url: URL.createObjectURL(file),
});

const urlEntry = (url: string, publicId?: string): VariantImageEntry => ({
  key: nextEntryKey(),
  file: null,
  url,
  publicId,
});

const releaseEntry = (entry: VariantImageEntry) => {
  if (entry.file) URL.revokeObjectURL(entry.url);
};

/**
 * Shopify-style image manager for one variant: ordered thumbnails with
 * delete / replace / drag-reorder, plus the two ways to add images —
 * upload from computer and paste an image URL ("Add by URL").
 */
const VariantImageManager = ({
  images,
  variantLabel,
  onChange,
}: {
  images: VariantImageEntry[];
  variantLabel: string;
  onChange: (images: VariantImageEntry[]) => void;
}) => {
  const { addToast } = useToast();
  const [urlDraft, setUrlDraft] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number>(-1);
  // Index of the tile being dragged; live-reordered as it passes over others
  const dragIndexRef = useRef<number>(-1);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (fileList: FileList | null): File[] => {
    const files = Array.from(fileList || []);
    const ok = files.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (ok.length < files.length) {
      addToast('Some images were skipped — each image must be 5 MB or smaller.', 'error');
    }
    return ok;
  };

  const handleAddFiles = (fileList: FileList | null) => {
    const files = acceptFiles(fileList);
    if (files.length > 0) onChange([...images, ...files.map(fileEntry)]);
  };

  const handleAddUrl = () => {
    const url = urlDraft.trim();
    if (!/^https?:\/\//i.test(url)) {
      addToast('Enter a valid image URL starting with http:// or https://.', 'error');
      return;
    }
    onChange([...images, urlEntry(url)]);
    setUrlDraft('');
  };

  const handleDelete = (idx: number) => {
    releaseEntry(images[idx]);
    onChange(images.filter((_, i) => i !== idx));
  };

  const handleReplace = (fileList: FileList | null) => {
    const [file] = acceptFiles(fileList);
    const idx = replaceIndexRef.current;
    if (!file || idx < 0 || idx >= images.length) return;
    releaseEntry(images[idx]);
    onChange(images.map((entry, i) => (i === idx ? fileEntry(file) : entry)));
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <label className="block text-label text-text-secondary mb-1">Variant images</label>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((entry, idx) => (
            <div
              key={entry.key}
              draggable
              onDragStart={(e) => {
                dragIndexRef.current = idx;
                setDragging(true);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnter={() => {
                const from = dragIndexRef.current;
                if (from !== -1 && from !== idx) {
                  moveImage(from, idx);
                  dragIndexRef.current = idx;
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => {
                dragIndexRef.current = -1;
                setDragging(false);
              }}
              className={`relative group/img h-20 w-20 rounded-lg border bg-surface overflow-hidden cursor-grab active:cursor-grabbing ${
                dragging && dragIndexRef.current === idx
                  ? 'border-primary shadow-level1 opacity-70'
                  : 'border-dashboard-section-bg'
              }`}
            >
              <img
                src={entry.url}
                alt={`${variantLabel} image ${idx + 1}`}
                className="h-full w-full object-cover pointer-events-none"
              />
              {idx === 0 && (
                <span className="absolute bottom-0 inset-x-0 bg-primary/80 text-white text-[8px] font-bold uppercase text-center py-0.5 pointer-events-none">
                  Default
                </span>
              )}
              {/* Hover controls: drag handle, replace, delete */}
              <div className="absolute inset-0 bg-text-primary/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-start justify-between p-1">
                <GripVertical className="h-3.5 w-3.5 text-white/90 mt-0.5" aria-hidden />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      replaceIndexRef.current = idx;
                      replaceInputRef.current?.click();
                    }}
                    className="p-1 rounded bg-white/90 text-text-primary hover:bg-white"
                    title="Replace image"
                    aria-label={`Replace ${variantLabel} image ${idx + 1}`}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="p-1 rounded bg-white/90 text-danger hover:bg-white"
                    title="Delete image"
                    aria-label={`Delete ${variantLabel} image ${idx + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {/* Keyboard-accessible reorder (drag alternative) */}
              <div className="absolute bottom-0 right-0 hidden group-hover/img:flex">
                <button
                  type="button"
                  onClick={() => moveImage(idx, idx - 1)}
                  disabled={idx === 0}
                  className="px-1 bg-white/90 text-[10px] font-bold text-text-primary disabled:opacity-30 rounded-tl"
                  aria-label={`Move ${variantLabel} image ${idx + 1} earlier`}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(idx, idx + 1)}
                  disabled={idx === images.length - 1}
                  className="px-1 bg-white/90 text-[10px] font-bold text-text-primary disabled:opacity-30"
                  aria-label={`Move ${variantLabel} image ${idx + 1} later`}
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => addInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-btn border border-dashed border-text-disabled px-3 py-2 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Upload images
        </button>
        <div className="flex flex-grow gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            placeholder="https://… paste an image URL"
            className={`${inputClass} flex-grow`}
            aria-label={`${variantLabel} image URL`}
          />
          <button
            type="button"
            onClick={handleAddUrl}
            disabled={!urlDraft.trim()}
            className="flex items-center gap-1 rounded-btn bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-40 whitespace-nowrap"
          >
            <Link2 className="h-3.5 w-3.5" /> Add by URL
          </button>
        </div>
      </div>
      <p className="mt-1 text-caption text-text-muted">
        The first image is the variant's default photo. Drag thumbnails to reorder. Up to 5 MB per
        file.
      </p>

      {/* Hidden pickers: bulk add + targeted replace */}
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleReplace(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
};

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
        capacity: v.capacity || '',
        size: v.size || '',
        stock: String(v.stock),
        priceDelta: (v.priceDeltaCents / 100).toFixed(2),
        costPrice: ((v.costPriceCents ?? 0) / 100).toFixed(2),
        lowStockThreshold: String(v.lowStockThreshold),
        // Drop unusable (mock/broken) stored images so saving self-heals them
        images: (v.images || [])
          .filter((img) => isUsableImageUrl(img.url))
          .map((img) => urlEntry(img.url, img.publicId)),
      })),
    });
    setModalOpen(true);
  };

  // Release object-URL previews for any not-yet-uploaded files on close
  const closeModal = () => {
    form.variants.forEach((v) => v.images.forEach(releaseEntry));
    setModalOpen(false);
  };

  const setVariant = (idx: number, patch: Partial<VariantForm>) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }));
  };

  // Variants JSON + the new photo files. Each variant sends its ordered
  // `images` list: fresh files become { fileSlot: n } (the server matches
  // slot n → n-th variantImages file); stored images and pasted URLs ride
  // as { url, publicId } — so the admin-arranged order is preserved exactly.
  const buildVariantsPayload = () => {
    const files: File[] = [];
    const variants = form.variants
      .filter((v) => v.sku.trim())
      .map((v) => ({
        sku: v.sku.trim(),
        color: v.color.trim() || undefined,
        capacity: v.capacity.trim() || undefined,
        size: v.size.trim() || undefined,
        stock: parseInt(v.stock) || 0,
        priceDeltaCents: dollarsToCents(v.priceDelta),
        costPriceCents: dollarsToCents(v.costPrice),
        lowStockThreshold: parseInt(v.lowStockThreshold) || 0,
        images: v.images.map((entry) =>
          entry.file
            ? { fileSlot: files.push(entry.file) - 1 }
            : { url: entry.url, publicId: entry.publicId }
        ),
      }));
    return { variants, files };
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.categoryId || !form.basePrice) {
      addToast('Name, description, category, and base price are required.', 'error');
      return;
    }
    const { variants, files: variantImageFiles } = buildVariantsPayload();
    if (variants.length === 0) {
      addToast('At least one variant with an SKU is required.', 'error');
      return;
    }

    // Both create and update are multipart: variants ride as a JSON string
    // beside their photo files (referenced by fileSlot index)
    const fd = new FormData();
    fd.append('name', form.name);
    if (form.brand) fd.append('brand', form.brand);
    fd.append('description', form.description);
    fd.append('categoryId', form.categoryId);
    fd.append('basePriceCents', String(dollarsToCents(form.basePrice)));
    fd.append('variants', JSON.stringify(variants));
    for (const file of variantImageFiles) {
      fd.append('variantImages', file);
    }

    setSaving(true);
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct._id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        addToast(`Product "${form.name}" updated.`, 'success');
      } else {
        await api.post('/products', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        addToast(`Product "${form.name}" created.`, 'success');
      }
      closeModal();
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
        onClose={closeModal}
        title={editingProduct ? `Edit ${editingProduct.name}` : 'Add Product'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-label text-text-secondary mb-1">Name *</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div className="w-full sm:w-40">
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

          <div className="flex flex-col sm:flex-row gap-3">
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
            <div className="w-full sm:w-40">
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    <div>
                      <label className="block text-label text-text-secondary mb-1">Capacity</label>
                      <input
                        className={inputClass}
                        value={v.capacity}
                        onChange={(e) => setVariant(idx, { capacity: e.target.value })}
                        placeholder="e.g. 500L"
                      />
                    </div>
                  </div>

                  {/* Short one-line labels keep the four inputs aligned */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-label text-text-secondary mb-1 whitespace-nowrap">Stock</label>
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
                      <label className="block text-label text-text-secondary mb-1 whitespace-nowrap">
                        Price Δ ($)
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
                      <label className="block text-label text-text-secondary mb-1 whitespace-nowrap">
                        Cost ($)
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
                      <label className="block text-label text-text-secondary mb-1 whitespace-nowrap">
                        Low stock
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

                  {/* Ordered variant photos — the product's only image source.
                      The first variant's first image is the storefront card image. */}
                  <VariantImageManager
                    images={v.images}
                    variantLabel={v.color.trim() || v.sku.trim() || `Variant ${idx + 1}`}
                    onChange={(images) => setVariant(idx, { images })}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-caption text-text-muted">
              Product cards across the store show the first image of the first variant.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminProducts;
