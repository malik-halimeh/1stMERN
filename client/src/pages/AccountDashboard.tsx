import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ClipboardList, MapPin, Heart, User, Trash, Plus, ShieldCheck, Mail, Save, ExternalLink, LogOut } from 'lucide-react';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import Button from '../components/ui/Button.js';
import Input from '../components/ui/Input.js';
import EmptyState from '../components/ui/EmptyState.js';
import Skeleton from '../components/ui/Skeleton.js';
import Badge from '../components/ui/Badge.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import api from '../services/api.js';

type TabType = 'orders' | 'addresses' | 'wishlist' | 'details';

interface OrderRow {
  _id: string;
  orderNumber: string;
  totalCents: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
}

interface UserAddress {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  isDefault?: boolean;
}

const AccountDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser, logout } = useAuth();
  const { addToast } = useToast();

  const handleLogout = async () => {
    try { await logout(); } catch { /* swallowed */ }
    navigate('/');
  };

  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Address inputs
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [label, setLabel] = useState('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('United States');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Wishlist state
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Profile details state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Redirect if guest
  useEffect(() => {
    if (!isAuthenticated) {
      addToast('Please login to access your account dashboard.', 'warning');
      navigate('/login?redirect=/account');
    }
  }, [isAuthenticated]);

  // Sync profile details input
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
    }
  }, [user]);

  // Fetch orders
  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await api.get('/orders');
      if (res.data?.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Fetch wishlist
  const fetchWishlist = async () => {
    try {
      setWishlistLoading(true);
      const res = await api.get('/wishlist');
      if (res.data?.success) {
        setWishlistItems(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load wishlist:', err);
    } finally {
      setWishlistLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'orders') fetchOrders();
      if (activeTab === 'wishlist') fetchWishlist();
    }
  }, [activeTab, isAuthenticated]);

  // Handle name update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      addToast('Please provide a profile name.', 'error');
      return;
    }

    try {
      setIsSavingProfile(true);
      const res = await api.patch('/auth/profile', { name: profileName.trim() });
      if (res.data?.success) {
        setUser({ ...user, name: res.data.data.name });
        addToast('Account profile details updated.', 'success');
      }
    } catch (err: any) {
      addToast('Profile update failed.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle address addition
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!line1.trim() || !city.trim() || !country.trim()) {
      addToast('Please fill in Line 1, City, and Country.', 'error');
      return;
    }

    try {
      setIsSavingAddress(true);
      const newAddr: UserAddress = {
        label: label.trim(),
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        city: city.trim(),
        country: country.trim(),
        isDefault: user?.addresses && user.addresses.length === 0,
      };

      const existingAddresses = user?.addresses || [];
      const updatedAddresses = [...existingAddresses, newAddr];

      const res = await api.patch('/auth/profile', { addresses: updatedAddresses });
      if (res.data?.success) {
        setUser({ ...user, addresses: res.data.data.addresses });
        addToast('New address saved.', 'success');
        
        // Clear fields
        setLine1('');
        setLine2('');
        setCity('');
        setLabel('Home');
        setShowAddressForm(false);
      }
    } catch (err: any) {
      addToast('Failed to save shipping address.', 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Remove address
  const handleRemoveAddress = async (index: number) => {
    const existing = user?.addresses || [];
    const updated = existing.filter((_, idx) => idx !== index);

    try {
      const res = await api.patch('/auth/profile', { addresses: updated });
      if (res.data?.success) {
        setUser({ ...user, addresses: res.data.data.addresses });
        addToast('Address removed successfully.', 'success');
      }
    } catch (err: any) {
      addToast('Failed to delete address.', 'error');
    }
  };

  // Remove wishlist item
  const handleRemoveWishlistItem = async (productId: string) => {
    try {
      const res = await api.delete(`/wishlist/${productId}`);
      if (res.data?.success) {
        setWishlistItems(wishlistItems.filter((item) => item._id !== productId));
        addToast('Wishlist item removed.', 'success');
      }
    } catch (err) {
      addToast('Failed to remove wishlist item.', 'error');
    }
  };

  // Move wishlist item to cart
  const handleMoveToCart = async (productId: string, variantSku: string) => {
    try {
      const res = await api.post('/cart/items', { productId, variantSku, quantity: 1 });
      if (res.data?.success) {
        addToast('Product moved to shopping cart.', 'success');
        // Delete from wishlist
        await handleRemoveWishlistItem(productId);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Cannot add variant to cart. Out of stock.';
      addToast(msg, 'error');
    }
  };

  // Fixed 7-state badge colors helper
  const getStatusBadge = (status: OrderRow['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-200">Pending</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">Confirmed</span>;
      case 'processing':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-800 border border-yellow-200">Processing</span>;
      case 'shipped':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">Shipped</span>;
      case 'delivered':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200">Delivered</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">Cancelled</span>;
      case 'refunded':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">Refunded</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-800">Status</span>;
    }
  };

  return (
    <StorefrontLayout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Account Dashboard' }]}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
        <h1 className="text-3xl font-bold text-text-primary text-left mb-8">Account Management</h1>

        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Left sub-navigation sidebar */}
          <div className="w-full md:w-64 bg-surface border border-dashboard-section-bg/50 rounded-card p-2 shadow-level1 flex-shrink-0 text-left">
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-btn transition-colors ${
                activeTab === 'orders' ? 'bg-primary-dark text-white' : 'text-text-secondary hover:bg-dashboard-section-bg/30'
              }`}
            >
              <ClipboardList className="h-4.5 w-4.5" /> Orders History
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-btn transition-colors ${
                activeTab === 'addresses' ? 'bg-primary-dark text-white' : 'text-text-secondary hover:bg-dashboard-section-bg/30'
              }`}
            >
              <MapPin className="h-4.5 w-4.5" /> Address Book
            </button>
            <button
              onClick={() => setActiveTab('wishlist')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-btn transition-colors ${
                activeTab === 'wishlist' ? 'bg-primary-dark text-white' : 'text-text-secondary hover:bg-dashboard-section-bg/30'
              }`}
            >
              <Heart className="h-4.5 w-4.5" /> Wishlist
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-btn transition-colors ${
                activeTab === 'details' ? 'bg-primary-dark text-white' : 'text-text-secondary hover:bg-dashboard-section-bg/30'
              }`}
            >
              <User className="h-4.5 w-4.5" /> Account Details
            </button>

            {/* Logout — always visible at bottom of sidebar */}
            <div className="mt-4 pt-4 border-t border-dashboard-section-bg/50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-btn text-danger hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>

          {/* Right tab panel workspace */}
          <div className="flex-grow w-full">
            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 text-left space-y-6">
                <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider border-b border-dashboard-section-bg pb-3">
                  Orders History
                </h2>

                {ordersLoading ? (
                  <div className="space-y-4">
                    <Skeleton variant="rect" className="h-16 w-full" />
                    <Skeleton variant="rect" className="h-16 w-full" />
                  </div>
                ) : orders.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList className="h-10 w-10 text-text-secondary" />}
                    title="No orders found"
                    description="You haven't placed any appliance orders yet."
                    actionLabel="View Products"
                    onAction={() => navigate('/products')}
                  />
                ) : (
                  <div className="space-y-4">
                    {orders.map((ord) => (
                      <div
                        key={ord._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-dashboard-section-bg/50 hover:border-primary/30 rounded-card bg-surface transition-all gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-text-primary text-sm">{ord.orderNumber}</span>
                            {getStatusBadge(ord.status)}
                          </div>
                          <span className="text-[11px] text-text-muted block mt-1">
                            Placed on {new Date(ord.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-text-secondary mt-2 block">
                            {ord.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-dashboard-section-bg pt-3 sm:pt-0">
                          <div className="text-right">
                            <span className="text-[10px] text-text-muted block">Total Price</span>
                            <span className="text-sm font-bold text-primary-dark">${(ord.totalCents / 100).toFixed(2)}</span>
                          </div>
                          <Link
                            to={`/orders/${ord._id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
                          >
                            Track <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ADDRESSES TAB */}
            {activeTab === 'addresses' && (
              <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 text-left space-y-6">
                <div className="flex items-center justify-between border-b border-dashboard-section-bg pb-3">
                  <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">
                    Shipping Addresses
                  </h2>
                  <Button
                    onClick={() => setShowAddressForm(!showAddressForm)}
                    variant="secondary"
                    className="py-1 px-3 text-xs"
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add Address
                  </Button>
                </div>

                {showAddressForm && (
                  <form onSubmit={handleAddAddress} className="bg-dashboard-section-bg/25 border border-dashboard-section-bg/50 p-4 rounded-card space-y-4 animate-slide-in">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Add Shipping Address</span>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        id="addr-label"
                        label="Label (e.g. Home, Office)"
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        required
                      />
                      <Input
                        id="addr-country"
                        label="Country"
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        required
                      />
                    </div>
                    <Input
                      id="addr-line1"
                      label="Address Line 1"
                      type="text"
                      placeholder="Street address, company name"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      required
                    />
                    <Input
                      id="addr-line2"
                      label="Address Line 2 (Optional)"
                      type="text"
                      placeholder="Apartment, suite, unit"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                    />
                    <Input
                      id="addr-city"
                      label="City"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => setShowAddressForm(false)}
                        className="py-1 px-3 text-xs bg-transparent border border-text-disabled hover:bg-white text-text-secondary"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={isSavingAddress}
                        className="py-1 px-4 text-xs font-bold"
                      >
                        Save Address
                      </Button>
                    </div>
                  </form>
                )}

                {user?.addresses && user.addresses.length === 0 ? (
                  <EmptyState
                    icon={<MapPin className="h-10 w-10 text-text-secondary" />}
                    title="No addresses stored"
                    description="Save your shipping destinations here for single-click checkouts."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {user?.addresses?.map((addr: any, index: number) => (
                      <div
                        key={index}
                        className={`p-4 border rounded-card bg-surface relative flex flex-col justify-between ${
                          addr.isDefault ? 'border-primary ring-1 ring-primary/10' : 'border-dashboard-section-bg/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-text-primary text-sm">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="bg-success-bg/15 border border-success/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase text-success">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{addr.line1}</p>
                          {addr.line2 && <p className="text-xs text-text-secondary leading-relaxed">{addr.line2}</p>}
                          <p className="text-xs text-text-secondary leading-relaxed">{addr.city}, {addr.country}</p>
                        </div>
                        <div className="flex justify-end mt-4 pt-3 border-t border-dashboard-section-bg/40">
                          <button
                            onClick={() => handleRemoveAddress(index)}
                            className="text-text-muted hover:text-danger text-xs font-semibold flex items-center gap-1 focus:outline-none"
                          >
                            <Trash className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* WISHLIST TAB */}
            {activeTab === 'wishlist' && (
              <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 text-left space-y-6">
                <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider border-b border-dashboard-section-bg pb-3">
                  My Wishlist
                </h2>

                {wishlistLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton variant="rect" className="h-56 w-full" />
                    <Skeleton variant="rect" className="h-56 w-full" />
                  </div>
                ) : wishlistItems.length === 0 ? (
                  <EmptyState
                    icon={<Heart className="h-10 w-10 text-text-secondary" />}
                    title="Your wishlist is empty"
                    description="Save items to purchase them later."
                    actionLabel="View Catalog"
                    onAction={() => navigate('/products')}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {wishlistItems.map((item: any) => {
                      const firstVariant = item.variants?.[0] || {};
                      const itemPrice = item.basePriceCents + firstVariant.priceDeltaCents;
                      return (
                        <div key={item._id} className="p-4 border border-dashboard-section-bg/50 rounded-card bg-surface flex flex-col justify-between hover:shadow-level1 transition-all">
                          <div className="flex gap-3">
                            <div className="h-16 w-16 bg-dashboard-section-bg rounded flex items-center justify-center text-2xl">
                              {item.thumbnail || '🧊'}
                            </div>
                            <div className="text-left flex-grow">
                              {item.brand && <span className="text-[9px] uppercase font-bold text-text-muted">{item.brand}</span>}
                              <Link to={`/products/${item.slug}`} className="block text-xs font-bold text-text-primary hover:text-primary transition-colors">
                                {item.name}
                              </Link>
                              <span className="text-xs font-bold text-primary-dark mt-1 block">${(itemPrice / 100).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4 pt-3 border-t border-dashboard-section-bg/40">
                            <Button
                              onClick={() => handleMoveToCart(item._id, firstVariant.sku)}
                              className="w-full py-1.5 text-[10px] font-bold"
                            >
                              Move to Cart
                            </Button>
                            <button
                              onClick={() => handleRemoveWishlistItem(item._id)}
                              className="p-1 text-text-muted hover:text-danger hover:bg-danger-bg/25 rounded"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* DETAILS TAB */}
            {activeTab === 'details' && (
              <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 text-left space-y-6">
                <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider border-b border-dashboard-section-bg pb-3">
                  Account details
                </h2>

                <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                  <div className="flex items-center gap-3 bg-dashboard-section-bg/30 p-3 rounded-lg border border-dashboard-section-bg mb-4">
                    <Mail className="h-5 w-5 text-text-muted" />
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold block">Email Address (Locked)</span>
                      <span className="text-sm font-semibold text-text-primary">{user?.email}</span>
                    </div>
                  </div>

                  <Input
                    id="profile-name"
                    label="Full Name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSavingProfile}
                    className="w-full py-2.5 font-bold flex justify-center text-xs"
                    icon={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
};

export default AccountDashboard;
