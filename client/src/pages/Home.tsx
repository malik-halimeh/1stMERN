import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import ProductCard from '../components/ui/ProductCard.js';
import type { ProductDoc } from '../components/ui/ProductCard.js';
import Skeleton from '../components/ui/Skeleton.js';
import Button from '../components/ui/Button.js';
import EmptyState from '../components/ui/EmptyState.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useShop } from '../context/ShopContext.js';
import api from '../services/api.js';
import { ArrowRight, ChevronLeft, ChevronRight, Percent, Award, ShieldCheck, WifiOff } from 'lucide-react';

interface CategoryDoc {
  _id: string;
  name: string;
  slug: string;
  subcategories: any[];
}

const HERO_SLIDES = [
  {
    title: 'Smart Cooling, Engineered for Life',
    subtitle: 'Discover the new generation of OptiHome refrigerators featuring touch monitoring and energy-efficient cooling.',
    cta: 'Explore Refrigerators',
    link: '/products?category=mock-refrigerators',
    image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=600',
  },
  {
    title: 'Precision Cooking, Redefined',
    subtitle: 'Elevate your culinary journey with convection ovens and rapid smart induction cooktops.',
    cta: 'Browse Cooking',
    link: '/products',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=600',
  },
  {
    title: 'Ultra-Quiet Dishwashing Solutions',
    subtitle: 'Whisper-quiet operations meeting thorough sanitization cycles. The kitchen partner you deserve.',
    cta: 'View Dishwashers',
    link: '/products',
    image: 'https://images.unsplash.com/photo-1581622558663-b2e33377dfb2?auto=format&fit=crop&q=80&w=600',
  },
];

const Home: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductDoc[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<ProductDoc[]>([]);
  const [recommendations, setRecommendations] = useState<ProductDoc[]>([]);
  
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(true);

  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = () => setReloadKey((k) => k + 1);

  // Re-fetch automatically once connectivity returns after a failed load
  useEffect(() => {
    if (!fetchFailed) return;
    const handleOnline = () => retry();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchFailed]);

  const { addToast } = useToast();
  const { user } = useAuth();
  const { addItemToCart, addItemToWishlist, isInWishlist } = useShop();
  const navigate = useNavigate();

  // Automatic slide rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Homepage data (re-runs on retry / when connectivity returns)
  useEffect(() => {
    setLoadingCats(true);
    setLoadingFeatured(true);
    setLoadingRecent(true);
    setLoadingRecs(true);
    setFetchFailed(false);

    const fetchCats = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success) setCategories(res.data.data.slice(0, 4));
      } catch (err) {
        console.error('Failed to load categories:', err);
        setFetchFailed(true);
      } finally {
        setLoadingCats(false);
      }
    };

    const fetchFeatured = async () => {
      try {
        // Query rating sorted products as featured
        const res = await api.get('/products?sort=rating_desc&limit=4&inStock=1');
        if (res.data?.success) setFeaturedProducts(res.data.data);
      } catch (err) {
        console.error('Failed to load featured products:', err);
        setFetchFailed(true);
      } finally {
        setLoadingFeatured(false);
      }
    };

    const fetchRecent = async () => {
      try {
        const res = await api.get('/products?sort=newest&limit=4&inStock=1');
        if (res.data?.success) setRecentlyAdded(res.data.data);
      } catch (err) {
        console.error('Failed to load recently added products:', err);
        setFetchFailed(true);
      } finally {
        setLoadingRecent(false);
      }
    };

    const fetchRecs = async () => {
      try {
        const res = await api.get('/product-recommendations');
        if (res.data?.success) setRecommendations(res.data.data.slice(0, 4));
      } catch (err) {
        // Recommendations section hides itself when empty — no error UI needed
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoadingRecs(false);
      }
    };

    fetchCats();
    fetchFeatured();
    fetchRecent();
    fetchRecs();
  }, [reloadKey]);

  // Add to Cart handler — updates the shared header badge count (guest + auth)
  const handleAddToCart = async (productId: string, variantSku: string) => {
    try {
      const status = await addItemToCart(productId, variantSku, 1);
      if (status === 'exists') {
        addToast('This product is already in your cart.', 'info');
      } else {
        addToast('Product added to cart.', 'success');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err?.message || 'Could not add item to cart.';
      addToast(msg, 'error');
    }
  };

  // Add to Wishlist handler — duplicate-aware (guest + auth)
  const handleAddToWishlist = async (productId: string) => {
    try {
      const result = await addItemToWishlist(productId);
      if (result === 'exists') {
        addToast('Item is already in your wishlist.', 'info');
      } else if (user) {
        addToast('Item added to your wishlist!', 'success');
      } else {
        addToast('Item saved to your local wishlist! Sign in to sync across devices.', 'success');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to update wishlist.';
      addToast(msg, 'error');
    }
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);

  // Shown in place of a section's grid when its fetch failed (e.g. offline)
  const renderLoadError = () => (
    <EmptyState
      icon={<WifiOff className="h-10 w-10 text-text-secondary" />}
      title="Couldn't load products"
      description="Check your internet connection and try again."
      actionLabel="Retry"
      onAction={retry}
    />
  );

  return (
    <StorefrontLayout>
      {/* 1. HERO SLIDER */}
      <section className="relative h-[420px] sm:h-[480px] bg-primary-dark overflow-hidden font-sans">
        <div className="absolute inset-0 flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
          {HERO_SLIDES.map((slide, idx) => (
            <div key={idx} className="min-w-full h-full flex items-center relative select-none">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-dark/95 via-primary-dark/80 to-transparent z-10" />
              <img src={slide.image} alt={slide.title} className="absolute right-0 top-0 h-full w-2/3 md:w-[50%] object-cover object-center" />

              {/* z-20 keeps the copy above the z-10 gradient overlay (z-25 is not a Tailwind class).
                  Extra x-padding below 1400px keeps the copy clear of the slider arrows. */}
              <div className="max-w-7xl mx-auto px-12 min-[1400px]:px-4 w-full z-20 relative text-left">
                <div className="max-w-xl flex flex-col items-start gap-4">
                  <span className="bg-accent text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    Featured Collection
                  </span>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
                    {slide.title}
                  </h2>
                  <p className="text-sm md:text-base text-white/80">
                    {slide.subtitle}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => navigate(slide.link)}
                    icon={<ArrowRight className="h-4.5 w-4.5" />}
                    className="mt-2 font-semibold"
                  >
                    {slide.cta}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <button onClick={prevSlide} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
        <button onClick={nextSlide} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </section>

      {/* 2. CATEGORIES GRID */}
      <section className="max-w-7xl mx-auto px-4 py-16 font-sans">
        <div className="text-center max-w-xl mx-auto mb-10">
          <h3 className="text-2xl font-bold text-text-primary">Featured Categories</h3>
          <p className="text-sm text-text-muted mt-2">Explore top grade home appliances organized by categories.</p>
        </div>

        {loadingCats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : categories.length === 0 && fetchFailed ? (
          renderLoadError()
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {categories.map((cat) => (
              <Link
                key={cat._id}
                to={`/products?category=${cat.slug}`}
                className="bg-surface border border-dashboard-section-bg p-6 rounded-card text-center hover:border-secondary shadow-level1 hover:shadow-level2 transition-all duration-300 group"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🧊</div>
                <span className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors block">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 3. PROMOTIONAL section */}
      <section className="bg-dashboard-section-bg/30 py-16 font-sans border-y border-dashboard-section-bg/50">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Promo Box 1 */}
          <div className="bg-surface border border-dashboard-section-bg rounded-card p-6 sm:p-8 flex flex-col justify-between items-start gap-4 min-h-60 relative overflow-hidden group shadow-level1">
            <div className="absolute right-4 bottom-4 text-7xl opacity-10 group-hover:scale-110 transition-transform">⚡</div>
            <div className="max-w-xs flex flex-col gap-2 text-left">
              <span className="text-accent text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Percent className="h-3 w-3" /> Special Promo
              </span>
              <h4 className="text-xl font-bold text-text-primary">Induction Cooking Package</h4>
              <p className="text-xs text-text-muted">Save up to 15% on induction range ranges combined with matching sanitizing range hoods.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/products')} className="text-xs">
              View Offers
            </Button>
          </div>

          {/* Promo Box 2 */}
          <div className="bg-primary-dark text-white rounded-card p-6 sm:p-8 flex flex-col justify-between items-start gap-4 min-h-60 relative overflow-hidden group shadow-level1">
            <div className="absolute right-4 bottom-4 text-7xl opacity-10 group-hover:scale-110 transition-transform">🛡️</div>
            <div className="max-w-xs flex flex-col gap-2 text-left">
              <span className="text-secondary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Extended Protection
              </span>
              <h4 className="text-xl font-bold text-white">5-Year Extended Warranty</h4>
              <p className="text-xs text-white/80">Get peace of mind protection covering parts, sensors, and compressor systems.</p>
            </div>
            <Button variant="primary" onClick={() => navigate('/products')} className="text-xs">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* 4. FEATURED PRODUCTS */}
      <section className="max-w-7xl mx-auto px-4 py-16 font-sans">
        <div className="flex justify-between items-end mb-8">
          <div className="text-left">
            <h3 className="text-2xl font-bold text-text-primary">Featured Appliances</h3>
            <p className="text-sm text-text-muted mt-1">Our highest-rated customer picks.</p>
          </div>
          <Link to="/products" className="text-sm font-semibold text-secondary hover:text-accent flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-72 w-full rounded-card" />
            ))}
          </div>
        ) : featuredProducts.length === 0 && fetchFailed ? (
          renderLoadError()
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {featuredProducts.map((prod) => (
              <ProductCard
                key={prod._id}
                product={prod}
                onAddToCart={handleAddToCart}
                onAddToWishlist={handleAddToWishlist}
                isInWishlist={isInWishlist(prod._id)}
                onQuickView={(p) => navigate(`/products/${p.slug}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. RECENTLY ADDED */}
      <section className="max-w-7xl mx-auto px-4 py-16 font-sans border-t border-dashboard-section-bg/50">
        <div className="flex justify-between items-end mb-8">
          <div className="text-left">
            <h3 className="text-2xl font-bold text-text-primary">Recently Added</h3>
            <p className="text-sm text-text-muted mt-1">Explore our latest catalog entries.</p>
          </div>
          <Link to="/products" className="text-sm font-semibold text-secondary hover:text-accent flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingRecent ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-72 w-full rounded-card" />
            ))}
          </div>
        ) : recentlyAdded.length === 0 && fetchFailed ? (
          renderLoadError()
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {recentlyAdded.map((prod) => (
              <ProductCard
                key={prod._id}
                product={prod}
                onAddToCart={handleAddToCart}
                onAddToWishlist={handleAddToWishlist}
                isInWishlist={isInWishlist(prod._id)}
                onQuickView={(p) => navigate(`/products/${p.slug}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 6. RECOMMENDED FOR YOU */}
      {recommendations.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16 font-sans border-t border-dashboard-section-bg/50">
          <div className="text-left mb-8">
            <h3 className="text-2xl font-bold text-text-primary">Recommended For You</h3>
            <p className="text-sm text-text-muted mt-1">Curated list based on top trends and catalog sales.</p>
          </div>

          {loadingRecs ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rect" className="h-72 w-full rounded-card" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {recommendations.map((prod) => (
                <ProductCard
                  key={prod._id}
                  product={prod}
                  onAddToCart={handleAddToCart}
                  onAddToWishlist={handleAddToWishlist}
                  onQuickView={(p) => navigate(`/products/${p.slug}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Trust banners */}
      <section className="max-w-7xl mx-auto px-4 py-12 border-t border-dashboard-section-bg/50 font-sans grid grid-cols-1 md:grid-cols-3 gap-6 text-center select-none">
        <div className="flex flex-col items-center gap-2 p-4">
          <Award className="h-10 w-10 text-secondary" />
          <h5 className="font-bold text-text-primary">A Grade University Certified</h5>
          <p className="text-xs text-text-muted max-w-xs">Built to meet the highest safety, database schema, and interface guidelines.</p>
        </div>
        <div className="flex flex-col items-center gap-2 p-4 border-y md:border-y-0 md:border-x border-dashboard-section-bg">
          <ShieldCheck className="h-10 w-10 text-secondary" />
          <h5 className="font-bold text-text-primary">Stripe Secure Payments</h5>
          <p className="text-xs text-text-muted max-w-xs">Transactions are fully encrypted using tokenization and secured Stripe servers.</p>
        </div>
        <div className="flex flex-col items-center gap-2 p-4">
          <Percent className="h-10 w-10 text-secondary" />
          <h5 className="font-bold text-text-primary">Transparent Pricing</h5>
          <p className="text-xs text-text-muted max-w-xs">Cart modifications automatically crosscheck live warehouse values to alert user changes.</p>
        </div>
      </section>
    </StorefrontLayout>
  );
};

export default Home;
