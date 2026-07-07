import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Eye, Trash, Plus } from 'lucide-react';

// UI components
import Button from './components/ui/Button.js';
import { DataTable } from './components/ui/DataTable.js';
import type { Column } from './components/ui/DataTable.js';
import Badge from './components/ui/Badge.js';
import type { BadgeVariant } from './components/ui/Badge.js';

// Layouts
import AdminLayout from './components/layout/AdminLayout.js';
import type { AdminRole } from './components/layout/AdminLayout.js';

// Toast Context
import { useToast } from './context/ToastContext.js';

// Pages
import Home from './pages/Home.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import ForgotPassword from './pages/ForgotPassword.js';
import ProductList from './pages/ProductList.js';
import ProductDetail from './pages/ProductDetail.js';
import Cart from './pages/Cart.js';
import Checkout from './pages/Checkout.js';
import CheckoutRedirect from './pages/CheckoutRedirect.js';
import OrderConfirmation from './pages/OrderConfirmation.js';
import AccountDashboard from './pages/AccountDashboard.js';
import OrderDetail from './pages/OrderDetail.js';
import Wishlist from './pages/Wishlist.js';

// Mock inventory data for DataTable showcase in Admin Portal
interface ProductRow {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

const MOCK_INVENTORY: ProductRow[] = [
  { sku: 'REF-RF29-SS', name: 'French Door Refrigerator 29 cu. ft.', category: 'Refrigerators', price: 1899.0, stock: 12, status: 'In Stock' },
  { sku: 'RNG-IND-30', name: 'Smart Induction Slide-in Range', category: 'Ranges & Ovens', price: 1249.0, stock: 5, status: 'Low Stock' },
  { sku: 'DSH-BLT-Quiet', name: 'Built-in Dishwasher 44dBA', category: 'Dishwashers', price: 799.0, stock: 0, status: 'Out of Stock' },
  { sku: 'WSH-DRY-FL', name: 'Front Load Washer & Dryer Combo', category: 'Washers & Dryers', price: 2199.0, stock: 8, status: 'In Stock' },
  { sku: 'MIC-CONV-15', name: 'Convection Microwave Oven 1.5 cu. ft.', category: 'Microwaves', price: 299.0, stock: 24, status: 'In Stock' },
  { sku: 'COF-ESP-Bar', name: 'Espresso Bar Coffee Machine', category: 'Coffee Makers', price: 599.0, stock: 3, status: 'Low Stock' },
  { sku: 'BLD-PRO-1000', name: 'Professional High-Speed Blender', category: 'Blenders & Juicers', price: 189.0, stock: 15, status: 'In Stock' },
  { sku: 'TST-TOUCH-4', name: 'Touchscreen Toaster 4-Slice', category: 'Toasters & Ovens', price: 89.0, stock: 18, status: 'In Stock' },
];

function App() {
  const { addToast } = useToast();
  const [adminRole, setAdminRole] = useState<AdminRole>('super_admin');
  const [selectedProducts, setSelectedProducts] = useState<ProductRow[]>([]);

  // Columns for DataTable
  const inventoryColumns: Column<ProductRow>[] = [
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'name', label: 'Product Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (row) => <span>${row.price.toFixed(2)}</span>
    },
    { key: 'stock', label: 'Stock Qty', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        let badgeVar: BadgeVariant = 'neutral';
        if (row.status === 'In Stock') badgeVar = 'success';
        if (row.status === 'Low Stock') badgeVar = 'warning';
        if (row.status === 'Out of Stock') badgeVar = 'danger';
        return <Badge variant={badgeVar}>{row.status}</Badge>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => addToast(`Viewing item: ${row.name}`, 'info')}
            icon={<Eye className="h-4 w-4" />}
            className="p-1"
          />
          <Button
            variant="ghost"
            onClick={() => addToast(`Deleted mock item: ${row.sku}`, 'error')}
            icon={<Trash className="h-4 w-4 text-danger" />}
            className="p-1"
          />
        </div>
      )
    }
  ];

  // Admin Dashboard view component
  const AdminDashboard = () => (
    <AdminLayout role={adminRole} activePath="/admin/products">
      <div className="flex flex-col gap-6">
        {/* Top Welcome Title */}
        <div className="bg-surface p-6 rounded-card border border-dashboard-section-bg/50 shadow-level1 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
          <div>
            <h1 className="text-h1 font-bold text-primary-dark">Admin Inventory Control</h1>
            <p className="text-caption text-text-secondary mt-1">
              Super Admin and Inventory Manager control center. Manage stock, active coupons, and alerts.
            </p>
          </div>

          {/* Role Toggle for Showcase */}
          <div className="flex gap-2 items-center bg-dashboard-section-bg p-1.5 rounded-btn select-none">
            <span className="text-caption text-text-secondary font-bold px-2">Role:</span>
            <button
              onClick={() => { setAdminRole('inventory_manager'); addToast('Switched role to Inventory Manager', 'info'); }}
              className={`px-3 py-1 rounded-btn text-xs font-semibold transition-all ${
                adminRole === 'inventory_manager' ? 'bg-primary-dark text-white' : 'hover:bg-white/40 text-text-secondary'
              }`}
            >
              Inventory Manager
            </button>
            <button
              onClick={() => { setAdminRole('super_admin'); addToast('Switched role to Super Admin', 'info'); }}
              className={`px-3 py-1 rounded-btn text-xs font-semibold transition-all ${
                adminRole === 'super_admin' ? 'bg-primary-dark text-white' : 'hover:bg-white/40 text-text-secondary'
              }`}
            >
              Super Admin
            </button>
          </div>
        </div>

        {/* Reusable DataTable Component Showcase */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-section-title font-semibold">Products Inventory Table</h2>
            <Button
              variant="primary"
              onClick={() => addToast('Adding new mock item...', 'info')}
              icon={<Plus className="h-4 w-4" />}
            >
              Add Product
            </Button>
          </div>

          <DataTable
            columns={inventoryColumns}
            data={MOCK_INVENTORY}
            keyField="sku"
            onSelectionChange={(selected) => setSelectedProducts(selected)}
            rowsPerPageDefault={5}
          />

          {selectedProducts.length > 0 && (
            <div className="bg-primary-dark text-white p-4 rounded-card flex justify-between items-center animate-scale-in">
              <span className="text-sm font-semibold">{selectedProducts.length} items selected for bulk actions</span>
              <div className="flex gap-2">
                <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => addToast(`Bulk update triggering on: ${selectedProducts.map((p) => p.sku).join(', ')}`, 'info')}>
                  Update Status
                </Button>
                <Button variant="danger" onClick={() => { addToast('Bulk deleted mock items.', 'error'); setSelectedProducts([]); }}>
                  Delete Selected
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );

  return (
    <Router>
      <div className="relative min-h-screen">
        {/* Floating Developer Toolbar Switcher link */}
        <div className="fixed bottom-6 left-6 z-50 bg-primary-dark border border-white/20 px-3 py-2 rounded-modal shadow-level3 flex items-center gap-3 text-white font-sans text-xs select-none">
          <span className="font-semibold text-text-muted">Portals:</span>
          <Link to="/" className="text-white font-bold hover:text-secondary hover:underline transition-colors">Store</Link>
          <div className="h-4 w-px bg-white/20" />
          <Link to="/admin" className="text-white font-bold hover:text-secondary hover:underline transition-colors">Admin</Link>
        </div>

        <Routes>
          {/* Storefront Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout-redirect" element={<CheckoutRedirect />} />
          <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
          <Route path="/account" element={<AccountDashboard />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/wishlist" element={<Wishlist />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
