import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  AlertTriangle,
  Ticket,
  Star,
  Users,
  FileText,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export type AdminRole = 'inventory_manager' | 'super_admin';

interface AdminLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: AdminRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard-lite',
    href: '/admin/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['inventory_manager', 'super_admin'],
  },
  {
    label: 'Products',
    href: '/admin/products',
    icon: <Package className="h-5 w-5" />,
    roles: ['inventory_manager', 'super_admin'],
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: <ShoppingBag className="h-5 w-5" />,
    roles: ['inventory_manager', 'super_admin'],
  },
  {
    label: 'Low Stock Alerts',
    href: '/admin/low-stock',
    icon: <AlertTriangle className="h-5 w-5" />,
    roles: ['inventory_manager', 'super_admin'],
  },
  {
    label: 'Coupons',
    href: '/admin/coupons',
    icon: <Ticket className="h-5 w-5" />,
    roles: ['inventory_manager', 'super_admin'],
  },
  {
    label: 'Reviews',
    href: '/admin/reviews',
    icon: <Star className="h-5 w-5" />,
    roles: ['inventory_manager', 'super_admin'],
  },
  // Super Admin Role-Scoped Items
  {
    label: 'Users',
    href: '/admin/users',
    icon: <Users className="h-5 w-5" />,
    roles: ['super_admin'],
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: <FileText className="h-5 w-5" />,
    roles: ['super_admin'],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['super_admin'],
  },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activePath = '/admin/dashboard',
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Derive display values from the authenticated user
  const role: AdminRole = (user?.role as AdminRole) ?? 'inventory_manager';
  const userName = user?.name || 'Admin';
  const userEmail = user?.email || '';
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Filter items matching current user role
  const filteredNavItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    try {
      await logout(); // clears in-memory token + calls POST /api/auth/logout
    } catch {
      // logout already swallows errors; navigate regardless
    }
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col justify-between bg-primary-dark text-white font-sans">
      {/* Upper Section */}
      <div>
        {/* Sidebar Header */}
        <div className={`p-4 border-b border-white/10 flex items-center justify-between ${isCollapsed ? 'justify-center' : ''}`}>
          {!isCollapsed && (
            <Link to="/admin/dashboard" className="text-h3 font-bold tracking-tight text-white select-none">
              OptiCart <span className="text-primary text-sm font-semibold block uppercase">Admin Portal</span>
            </Link>
          )}
          {isCollapsed && (
            <span className="h-8 w-8 rounded-btn bg-primary flex items-center justify-center font-bold text-lg select-none">
              O
            </span>
          )}

          {/* Desktop Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-btn transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-btn"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Sidebar Links */}
        <nav className="p-2 flex flex-col gap-1 mt-4 select-none">
          {filteredNavItems.map((item) => {
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.label}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-secondary font-medium transition-all group ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:bg-white/5 hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-text-muted group-hover:text-white'}`}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout Row */}
      <div className="p-2 border-t border-white/10 select-none">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-secondary font-medium text-text-muted hover:bg-red-950/40 hover:text-red-300 transition-colors group`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 text-text-muted group-hover:text-red-300 flex-shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-text-primary font-sans">
      {/* 1. Desktop Sidebar */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-30 transition-all duration-300 border-r border-white/10 bg-primary-dark ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* 2. Mobile Sidebar Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-text-primary/40 backdrop-blur-sm">
          <div className="w-64 h-full shadow-level3 animate-slide-in">
            <SidebarContent />
          </div>
          {/* Dismiss Click Area */}
          <div className="flex-grow" onClick={() => setIsMobileOpen(false)} />
        </div>
      )}

      {/* Main Body (Offset by Sidebar Width on Desktop) */}
      <div
        className={`flex-grow flex flex-col min-h-screen transition-all duration-300 ${
          isCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-20 bg-surface border-b border-dashboard-section-bg shadow-level1 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-1.5 text-text-secondary hover:bg-dashboard-section-bg rounded-btn"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Quick Search */}
            <div className="hidden sm:flex items-center gap-2 bg-dashboard-section-bg rounded-input px-3 py-1.5 border border-transparent focus-within:border-primary/20">
              <Search className="h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search orders, SKU..."
                className="bg-transparent border-none text-secondary outline-none placeholder:text-text-muted text-sm w-48 focus:w-64 transition-all duration-300"
              />
            </div>
          </div>

          {/* Right Controls: User info & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-dashboard-section-bg transition-colors focus:outline-none"
            >
              <span className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-caption shadow-level1">
                {userName.split(' ').map((n) => n[0]).join('')}
              </span>
              <div className="hidden md:flex flex-col text-left select-none pr-1">
                <span className="text-caption font-bold leading-tight">{userName}</span>
                <span className="text-[10px] text-text-muted uppercase font-semibold leading-none">{role.replace('_', ' ')}</span>
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-text-disabled rounded-dropdown shadow-level2 p-2 z-30 select-none">
                <div className="px-3 py-2 border-b border-dashboard-section-bg">
                  <p className="text-sm font-semibold">{userName}</p>
                  <p className="text-caption text-text-muted truncate">{userEmail}</p>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <Link
                    to="/admin/profile"
                    className="flex items-center gap-2 px-3 py-2 hover:bg-dashboard-section-bg text-secondary text-sm rounded-btn"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <User className="h-4 w-4 text-text-muted" /> Profile Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-danger text-sm rounded-btn"
                  >
                    <LogOut className="h-4 w-4" /> Logout Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow p-6 bg-dashboard-section-bg/40">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
