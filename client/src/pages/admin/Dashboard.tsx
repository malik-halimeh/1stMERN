import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import Skeleton from '../../components/ui/Skeleton';
import { ShoppingBag, Clock, AlertTriangle, Package, Ticket } from 'lucide-react';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

interface RecentOrder {
  _id: string;
  orderNumber: string;
  userId: { name: string; email: string } | null;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-amber-100 text-amber-700 border-amber-200',
};

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  activeAlerts: number;
  totalProducts: number;
  activeCoupons: number;
  recentOrders: RecentOrder[];
}

const StatTile = ({
  label,
  value,
  icon,
  to,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
  highlight?: boolean;
}) => (
  <Link
    to={to}
    className="bg-surface border border-dashboard-section-bg rounded-card p-5 shadow-level1 hover:shadow-level2 transition-shadow flex items-start justify-between"
  >
    <div className="flex flex-col gap-1">
      <span className="text-label text-text-secondary">{label}</span>
      <span
        className={`text-[32px] leading-tight font-semibold ${
          highlight && value > 0 ? 'text-danger' : 'text-text-primary'
        }`}
      >
        {value.toLocaleString()}
      </span>
    </div>
    <span className="p-2 rounded-btn bg-dashboard-section-bg text-text-secondary">{icon}</span>
  </Link>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [orders, pending, products, lowStock, coupons] = await Promise.all([
          api.get('/orders?limit=5'),
          api.get('/orders?status=pending&limit=1'),
          api.get('/products?limit=1'),
          // Both endpoints paginate at 20 by default — fetch the max page so
          // the "active" tiles count the whole list, not just the first page
          api.get('/low-stock?limit=100'),
          api.get('/coupons?limit=100'),
        ]);
        setStats({
          totalOrders: orders.data.meta?.total ?? 0,
          pendingOrders: pending.data.meta?.total ?? 0,
          totalProducts: products.data.meta?.total ?? 0,
          activeAlerts: lowStock.data.data.filter(
            (a: { status: string }) => a.status === 'active'
          ).length,
          activeCoupons: coupons.data.data.filter((c: { isActive: boolean }) => c.isActive)
            .length,
          recentOrders: orders.data.data,
        });
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        setStats({
          totalOrders: 0,
          pendingOrders: 0,
          totalProducts: 0,
          activeAlerts: 0,
          activeCoupons: 0,
          recentOrders: [],
        });
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Dashboard</h1>
        <p className="mt-1 text-text-secondary">
          Overview of orders, inventory, and platform activity.
        </p>
      </div>

      {!stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatTile
              label="Total orders"
              value={stats.totalOrders}
              icon={<ShoppingBag className="h-5 w-5" />}
              to="/admin/orders"
            />
            <StatTile
              label="Pending orders"
              value={stats.pendingOrders}
              icon={<Clock className="h-5 w-5" />}
              to="/admin/orders"
              highlight
            />
            <StatTile
              label="Low-stock alerts"
              value={stats.activeAlerts}
              icon={<AlertTriangle className="h-5 w-5" />}
              to="/admin/low-stock"
              highlight
            />
            <StatTile
              label="Products"
              value={stats.totalProducts}
              icon={<Package className="h-5 w-5" />}
              to="/admin/products"
            />
            <StatTile
              label="Active coupons"
              value={stats.activeCoupons}
              icon={<Ticket className="h-5 w-5" />}
              to="/admin/coupons"
            />
          </div>

          {/* Recent orders */}
          <div className="bg-surface border border-dashboard-section-bg rounded-card shadow-level1 overflow-hidden">
            <div className="px-5 py-4 border-b border-dashboard-section-bg flex items-center justify-between">
              <h2 className="text-section-title-sm font-semibold text-text-primary">
                Recent orders
              </h2>
              <Link
                to="/admin/orders"
                className="text-xs font-semibold text-primary hover:text-primary-dark"
              >
                View all →
              </Link>
            </div>
            {stats.recentOrders.length === 0 ? (
              <p className="p-5 text-sm text-text-secondary">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {stats.recentOrders.map((o) => (
                      <tr
                        key={o._id}
                        className="border-b border-dashboard-section-bg/60 last:border-0"
                      >
                        <td className="px-5 py-3 font-mono font-semibold text-text-primary">
                          {o.orderNumber}
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {o.userId?.name || '—'}
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 font-semibold tabular-nums">
                          ${(o.totalCents / 100).toFixed(2)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[o.status]}`}
                          >
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
