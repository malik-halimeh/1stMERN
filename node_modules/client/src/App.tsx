import React from 'react';
import { Navigate, BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// Layouts
import AdminLayout from './components/layout/AdminLayout.js';

// Auth
import { useAuth } from './context/AuthContext.js';

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

// --------------------------------------------------------------------------
// Route Guards
// --------------------------------------------------------------------------

/**
 * Redirects unauthenticated users to /login.
 * Redirects authenticated users with wrong role to the homepage.
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRoles?: Array<'customer' | 'inventory_manager' | 'super_admin'>;
}> = ({ children, requiredRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
        replace
      />
    );
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// --------------------------------------------------------------------------
// Admin page components
// Each admin path renders its own AdminPage so the sidebar highlights
// correctly and navigating between /admin/* paths re-renders the content
// without a full browser reload.
// --------------------------------------------------------------------------

/** Reads the current pathname and passes it as activePath to AdminLayout */
const AdminPage: React.FC<{ title: string; description?: string }> = ({ title, description }) => {
  const { pathname } = useLocation();
  return (
    <AdminLayout activePath={pathname}>
      <div className="flex flex-col gap-4">
        <h1 className="text-h1 font-bold text-primary-dark">{title}</h1>
        {description && <p className="text-text-secondary">{description}</p>}
      </div>
    </AdminLayout>
  );
};

/** Wraps an AdminPage in the role-guard so each route stays DRY */
const AdminRoute: React.FC<{ title: string; description?: string }> = (props) => (
  <ProtectedRoute requiredRoles={['inventory_manager', 'super_admin']}>
    <AdminPage {...props} />
  </ProtectedRoute>
);

// --------------------------------------------------------------------------
// App — routing tree
// --------------------------------------------------------------------------

function App() {
  return (
    <Router>
      <Routes>
        {/* ── Storefront Routes ── */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />

        {/* Customer-only protected routes */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route path="/checkout-redirect" element={<CheckoutRedirect />} />
        <Route
          path="/order-confirmation/:id"
          element={
            <ProtectedRoute>
              <OrderConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetail />
            </ProtectedRoute>
          }
        />

        {/* ── Admin Routes ──────────────────────────────────────────────────
            Every path gets its OWN route so navigating between admin sections
            triggers a component re-render without a browser reload.
            /admin (bare) redirects to /admin/dashboard. */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute
              title="Admin Dashboard"
              description="Overview of orders, inventory, and platform activity."
            />
          }
        />
        <Route
          path="/admin/products"
          element={
            <AdminRoute
              title="Products"
              description="Manage your appliance catalog — add, edit, and remove products."
            />
          }
        />
        <Route
          path="/admin/orders"
          element={
            <AdminRoute
              title="Orders"
              description="View and advance order statuses across all customers."
            />
          }
        />
        <Route
          path="/admin/low-stock"
          element={
            <AdminRoute
              title="Low Stock Alerts"
              description="Monitor variants that have fallen below their stock threshold."
            />
          }
        />
        <Route
          path="/admin/coupons"
          element={
            <AdminRoute
              title="Coupons"
              description="Create, edit, and deactivate discount coupon codes."
            />
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <AdminRoute
              title="Reviews"
              description="Moderate customer product reviews."
            />
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute
              title="Users"
              description="Manage platform accounts and role assignments."
            />
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <AdminRoute
              title="Audit Logs"
              description="Immutable record of all privileged administrative actions."
            />
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <AdminRoute
              title="Analytics"
              description="Revenue trends, top products, and customer activity reports."
            />
          }
        />
        <Route
          path="/admin/profile"
          element={
            <AdminRoute
              title="Profile Settings"
              description="Update your admin account details."
            />
          }
        />

        {/* Catch-all → home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
