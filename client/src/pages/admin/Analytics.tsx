import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ColumnChart from '../../components/ui/ColumnChart';
import { BarChart3 } from 'lucide-react';

interface RevenueData {
  windowDays: number;
  bucket: string;
  totalRevenueCents: number;
  deliveredOrders: number;
  avgOrderValueCents: number;
  series: Array<{ period: string; revenueCents: number; orders: number }>;
}

interface TopSkusData {
  skus: Array<{ sku: string; productName: string; units: number; revenueCents: number }>;
}

interface OrderVolumeData {
  totalOrders: number;
  series: Array<{ period: string; orders: number }>;
}

interface CustomerGrowthData {
  totalCustomers: number;
  newCustomers: number;
  series: Array<{ period: string; customers: number }>;
}

interface PurchaseSpendData {
  totalSpendCents: number;
  totalPurchases: number;
  totalUnits: number;
  series: Array<{ period: string; spendCents: number; purchases: number; units: number }>;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const compactMoney = (cents: number) => {
  const v = cents / 100;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};

const StatTile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="bg-surface border border-dashboard-section-bg rounded-card p-5 shadow-level1 flex flex-col gap-1">
    <span className="text-label text-text-secondary">{label}</span>
    <span className="text-[28px] leading-tight font-semibold text-text-primary">{value}</span>
    {hint && <span className="text-caption text-text-muted">{hint}</span>}
  </div>
);

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-surface border border-dashboard-section-bg rounded-card p-5 shadow-level1">
    <h2 className="text-section-title-sm font-semibold text-text-primary mb-4">{title}</h2>
    {children}
  </div>
);

const AdminAnalytics = () => {
  const { addToast } = useToast();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [topSkus, setTopSkus] = useState<TopSkusData | null>(null);
  const [orderVolume, setOrderVolume] = useState<OrderVolumeData | null>(null);
  const [customerGrowth, setCustomerGrowth] = useState<CustomerGrowthData | null>(null);
  const [purchaseSpend, setPurchaseSpend] = useState<PurchaseSpendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rev, skus, vol, growth, spend] = await Promise.all([
          api.get(`/analytics/revenue?days=${days}`),
          api.get(`/analytics/top-skus?days=${days}&limit=10`),
          api.get(`/analytics/order-volume?days=${days}`),
          api.get(`/analytics/customer-growth?days=${days}`),
          api.get(`/analytics/purchase-spend?days=${days}`),
        ]);
        setRevenue(rev.data.data);
        setTopSkus(skus.data.data);
        setOrderVolume(vol.data.data);
        setCustomerGrowth(growth.data.data);
        setPurchaseSpend(spend.data.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        addToast('Failed to load analytics.', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days, addToast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!revenue || !orderVolume || !customerGrowth || !topSkus || !purchaseSpend) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-12 w-12 text-text-muted" />}
        title="Analytics unavailable"
        description="Could not load analytics data. Try again later."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-primary-dark">Analytics</h1>
          <p className="mt-1 text-text-secondary">
            Delivered revenue, order volume, and customer growth — last {revenue.windowDays}{' '}
            days.
          </p>
        </div>
        <div className="flex gap-1 bg-dashboard-section-bg rounded-btn p-1 self-start">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-btn text-xs font-semibold transition-colors ${
                days === d
                  ? 'bg-surface text-text-primary shadow-level1'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* 5 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile
          label="Total revenue"
          value={money(revenue.totalRevenueCents)}
          hint="Delivered orders only"
        />
        <StatTile
          label="Total orders"
          value={orderVolume.totalOrders.toLocaleString()}
          hint="All statuses"
        />
        <StatTile
          label="New customers"
          value={customerGrowth.newCustomers.toLocaleString()}
          hint={`${customerGrowth.totalCustomers.toLocaleString()} total`}
        />
        <StatTile
          label="Avg order value"
          value={money(revenue.avgOrderValueCents)}
          hint={`${revenue.deliveredOrders} delivered orders`}
        />
        <StatTile
          label="Purchase spend"
          value={money(purchaseSpend.totalSpendCents)}
          hint={`${purchaseSpend.totalUnits.toLocaleString()} units bought`}
        />
      </div>

      {/* Revenue trend */}
      <ChartCard title={`Revenue (delivered, ${revenue.bucket})`}>
        <ColumnChart
          points={revenue.series.map((p) => ({
            label: p.period,
            value: p.revenueCents,
            tooltip: `${money(p.revenueCents)} · ${p.orders} order${p.orders === 1 ? '' : 's'} · ${p.period}`,
          }))}
          formatTick={compactMoney}
        />
        <details className="mt-4">
          <summary className="text-caption font-semibold text-text-secondary cursor-pointer select-none">
            View as table
          </summary>
          <table className="mt-2 text-caption w-full max-w-md">
            <thead>
              <tr className="text-left text-text-muted border-b border-dashboard-section-bg">
                <th className="py-1 pr-4 font-medium">Period</th>
                <th className="py-1 pr-4 font-medium">Orders</th>
                <th className="py-1 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {revenue.series.map((p) => (
                <tr key={p.period} className="border-b border-dashboard-section-bg/50">
                  <td className="py-1 pr-4 text-text-secondary">{p.period}</td>
                  <td className="py-1 pr-4 tabular-nums text-text-secondary">{p.orders}</td>
                  <td className="py-1 tabular-nums text-text-primary">{money(p.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </ChartCard>

      {/* Purchase spend trend (stock bought from suppliers) */}
      <ChartCard title={`Purchase spend (${purchaseSpend.totalPurchases} purchase${purchaseSpend.totalPurchases === 1 ? '' : 's'})`}>
        <ColumnChart
          points={purchaseSpend.series.map((p) => ({
            label: p.period,
            value: p.spendCents,
            tooltip: `${money(p.spendCents)} · ${p.units} unit${p.units === 1 ? '' : 's'} · ${p.period}`,
          }))}
          formatTick={compactMoney}
          heightClass="h-44"
        />
      </ChartCard>

      {/* Order volume + customer growth side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title={`Order volume (${orderVolume.totalOrders} total)`}>
          <ColumnChart
            points={orderVolume.series.map((p) => ({
              label: p.period,
              value: p.orders,
              tooltip: `${p.orders} order${p.orders === 1 ? '' : 's'} · ${p.period}`,
            }))}
            formatTick={(v) => String(Math.round(v))}
            heightClass="h-44"
          />
        </ChartCard>
        <ChartCard title={`Customer growth (${customerGrowth.newCustomers} new)`}>
          <ColumnChart
            points={customerGrowth.series.map((p) => ({
              label: p.period,
              value: p.customers,
              tooltip: `${p.customers} new customer${p.customers === 1 ? '' : 's'} · ${p.period}`,
            }))}
            formatTick={(v) => String(Math.round(v))}
            heightClass="h-44"
          />
        </ChartCard>
      </div>

      {/* Top SKUs table */}
      <ChartCard title="Top SKUs by units sold">
        {topSkus.skus.length === 0 ? (
          <p className="text-sm text-text-secondary py-8 text-center">
            No delivered sales in this window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-dashboard-section-bg">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 font-medium">Units</th>
                  <th className="py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topSkus.skus.map((s, i) => (
                  <tr key={s.sku} className="border-b border-dashboard-section-bg/50 last:border-0">
                    <td className="py-2 pr-4 text-text-muted tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-4 font-mono text-text-secondary">{s.sku}</td>
                    <td className="py-2 pr-4 font-medium text-text-primary">{s.productName}</td>
                    <td className="py-2 pr-4 tabular-nums font-semibold">{s.units}</td>
                    <td className="py-2 tabular-nums text-text-secondary">
                      {money(s.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
};

export default AdminAnalytics;
