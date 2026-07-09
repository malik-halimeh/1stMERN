import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { Star } from 'lucide-react';

interface ReviewRow {
  _id: string;
  productId: { _id: string; name: string; slug: string } | null;
  userId: { _id: string; name: string; email: string } | null;
  rating: number;
  text: string;
  createdAt: string;
}

const AdminReviews = () => {
  const { addToast } = useToast();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await api.get('/reviews?limit=100');
      setReviews(res.data.data);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      addToast('Failed to load reviews.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const removeReview = async (row: ReviewRow) => {
    if (!window.confirm(`Remove this review of "${row.productId?.name}"?`)) return;
    setRemovingId(row._id);
    try {
      await api.delete(`/reviews/${row._id}`);
      addToast('Review removed (audit-logged).', 'success');
      await fetchReviews();
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to remove review.';
      addToast(message, 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const columns: Column<ReviewRow>[] = [
    {
      key: 'product',
      label: 'Product',
      render: (row) => (
        <span className="font-medium text-text-primary">{row.productId?.name || '—'}</span>
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
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-warning">
          {'★'.repeat(row.rating)}
          <span className="text-text-disabled">{'★'.repeat(5 - row.rating)}</span>
        </span>
      ),
    },
    {
      key: 'text',
      label: 'Review',
      render: (row) => (
        <p className="text-text-secondary max-w-md line-clamp-2" title={row.text}>
          {row.text}
        </p>
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
      key: 'actions',
      label: 'Moderate',
      render: (row) => (
        <Button
          variant="danger"
          onClick={() => removeReview(row)}
          disabled={removingId === row._id}
          className="!px-3 !py-1 text-xs"
        >
          {removingId === row._id ? 'Removing…' : 'Remove'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Review Moderation</h1>
        <p className="mt-1 text-text-secondary">
          All customer reviews. Removals are soft-deleted and audit-logged.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<Star className="h-12 w-12 text-text-muted" />}
          title="No reviews"
          description="No customer reviews have been submitted yet."
        />
      ) : (
        <DataTable columns={columns} data={reviews} keyField="_id" rowsPerPageDefault={15} />
      )}
    </div>
  );
};

export default AdminReviews;
