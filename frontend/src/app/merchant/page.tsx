'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import BarChart from '../../components/BarChart';
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Store,
  DollarSign,
  ExternalLink,
  Volume2,
  VolumeX,
  LogOut,
  ShoppingBag,
  Bell,
  Power,
  CheckCircle2,
  Camera,
  Upload,
  Tag,
  Radio,
} from 'lucide-react';
import { getSocket } from '../../lib/socket';

export default function MerchantPortalPage() {
  const router = useRouter();
  const { user, demoLogin, logout } = useAuth();
  const [subView, setSubView] = useState<'dash' | 'orders' | 'products' | 'store' | 'payouts'>('dash');
  const [dashboard, setDashboard] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStoreOnline, setIsStoreOnline] = useState(true);

  // Ready Dialog
  const [readyOrder, setReadyOrder] = useState<any>(null);
  const [bagInput, setBagInput] = useState<number>(1);

  // Order Details Modal
  const [detailOrder, setDetailOrder] = useState<any>(null);

  // Edit / Add Product Modal
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    category: 'Pantry',
    price_cents: 799,
    unit: '1 lb',
    stock: 25,
    emoji: '🛒',
    image_url: '',
    description: '',
    is_on_sale: false,
    sale_price_cents: 639,
    promo_badge: '20% OFF',
  });

  const [promotionsEnabled, setPromotionsEnabled] = useState(true);
  const [broadcastNotice, setBroadcastNotice] = useState<any>(null);

  // Store profile form
  const [storeForm, setStoreForm] = useState({
    name: 'Accra Market',
    category: 'African Groceries',
    tagline: 'Ghanaian staples, fresh every week',
    description: 'Family-owned since 2009. Gari, kenkey, palm oil, smoked fish and the flavors of home.',
    address: '9211 Harwin Dr',
    city: 'Silver Spring',
    state: 'MD',
    zip: '20910',
    phone: '(301) 555-0100',
    color: '#B7791F',
    emoji: '🌍',
  });

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [chimeFeedback, setChimeFeedback] = useState('');

  // 3-Stage Kitchen Order Audio Chime (C5 -> E5 -> G5)
  const playChime = () => {
    try {
      setChimeFeedback('Playing...');
      setTimeout(() => setChimeFeedback(''), 1200);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Note 1: C5 (523.25 Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: E5 (659.25 Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      gain2.gain.setValueAtTime(0.4, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.5);

      // Note 3: G5 (783.99 Hz)
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(783.99, now + 0.25);
      gain3.gain.setValueAtTime(0.5, now + 0.25);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.start(now + 0.25);
      osc3.stop(now + 0.85);
    } catch {
      // interaction blocked
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('bd_token');
    if (!token && (!user || user.role !== 'merchant')) {
      // Allow real user session
    }
  }, [user]);

  const loadData = async () => {
    const token = localStorage.getItem('bd_token');
    if (!token) return;

    try {
      const [dashRes, ordRes, prodRes, payRes] = await Promise.all([
        fetch('/api/merchant/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/merchant/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/merchant/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/merchant/payouts', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (payRes.ok) setPayouts(await payRes.json());

      // Fetch marketplace settings for promotions & broadcasts
      try {
        const setRes = await fetch('/api/settings');
        if (setRes.ok) {
          const setMap = await setRes.json();
          if (setMap.merchant_promotions_enabled !== undefined) {
            setPromotionsEnabled(setMap.merchant_promotions_enabled !== 'false');
          }
          if (setMap.latest_broadcast) {
            try {
              const parsed = JSON.parse(setMap.latest_broadcast);
              if (parsed && (parsed.target === 'merchants' || parsed.target === 'both')) {
                setBroadcastNotice(parsed);
              }
            } catch {}
          }
        }
      } catch {}
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Real-time broadcast announcements over WebSocket
  useEffect(() => {
    const socket = getSocket();
    const handleBroadcast = (ann: any) => {
      if (ann && (ann.target === 'merchants' || ann.target === 'both')) {
        setBroadcastNotice(ann);
      }
    };
    socket.on('broadcast:announcement', handleBroadcast);
    return () => {
      socket.off('broadcast:announcement', handleBroadcast);
    };
  }, []);

  const updateOrderStatus = async (orderId: number, status: string, bagCount?: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/merchant/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, bagCount }),
      });
      if (res.ok) {
        setReadyOrder(null);
        await loadData();
      }
    } catch {
      alert('Failed to update status');
    }
  };

  const parseProductPromo = (prod: any) => {
    if (!prod) return { isOnSale: false, salePriceCents: 0, badge: '' };
    const desc = prod.description || '';
    const match = desc.match(/\[ON_SALE:(\d+)\|?([^\]]*)\]/);
    if (match) {
      return {
        isOnSale: true,
        salePriceCents: Number(match[1]),
        badge: match[2] || 'SALE',
      };
    }
    return { isOnSale: false, salePriceCents: 0, badge: '' };
  };

  const openEditModal = (p?: any) => {
    if (p && p.id) {
      const promo = parseProductPromo(p);
      setEditingProduct(p);
      setProdForm({
        name: p.name || '',
        category: p.category || 'General',
        price_cents: p.price_cents || 799,
        unit: p.unit || 'each',
        stock: p.stock ?? 25,
        emoji: p.emoji || '🛒',
        image_url: p.image_url || '',
        description: (p.description || '').replace(/\[ON_SALE:[^\]]*\]/g, '').trim(),
        is_on_sale: promo.isOnSale,
        sale_price_cents: promo.salePriceCents || Math.round((p.price_cents || 799) * 0.8),
        promo_badge: promo.badge || '20% OFF',
      });
    } else {
      setEditingProduct({});
      setProdForm({
        name: '',
        category: 'Pantry',
        price_cents: 799,
        unit: '1 lb',
        stock: 25,
        emoji: '🛒',
        image_url: '',
        description: '',
        is_on_sale: false,
        sale_price_cents: 639,
        promo_badge: '20% OFF',
      });
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo file must be smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setProdForm((prev) => ({ ...prev, image_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('bd_token');
    const isEdit = editingProduct?.id;
    const url = isEdit ? `/api/merchant/products/${editingProduct.id}` : '/api/merchant/products';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      let cleanDescription = (prodForm.description || '').replace(/\[ON_SALE:[^\]]*\]/g, '').trim();
      if (prodForm.is_on_sale) {
        cleanDescription = `${cleanDescription} [ON_SALE:${prodForm.sale_price_cents || prodForm.price_cents}|${prodForm.promo_badge || 'SALE'}]`.trim();
      }

      const payload = {
        name: prodForm.name,
        category: prodForm.category,
        price_cents: Number(prodForm.price_cents),
        unit: prodForm.unit,
        stock: Number(prodForm.stock),
        emoji: prodForm.emoji,
        image_url: prodForm.image_url || null,
        description: cleanDescription,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingProduct(null);
        await loadData();
      }
    } catch {
      alert('Failed to save product');
    }
  };

  const newCount = orders.filter((o) => o.status === 'placed').length;
  const inProgressCount = orders.filter((o) => ['accepted', 'packing'].includes(o.status)).length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  // Mock weekly sales chart data
  const chartData = [
    { week: 'Sep 12', sales: 640 },
    { week: 'Sep 19', sales: 890 },
    { week: 'Sep 26', sales: 1120 },
    { week: 'Oct 3', sales: 1450 },
    { week: 'Oct 10', sales: 1820 },
    { week: 'Oct 17', sales: 2150 },
    { week: 'Oct 24', sales: 2680 },
  ];

  if (!loading && (!user || (user.role !== 'merchant' && user.role !== 'admin'))) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 20 }}>
        <div className="card" style={{ maxWidth: 460, width: '100%', padding: '36px 32px', borderRadius: 16, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', background: '#fff' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏪</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: '#0F172A' }}>Merchant Portal</h2>
          {user ? (
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              You are signed in as <strong>{user.name}</strong> (<span style={{ textTransform: 'capitalize' }}>{user.role}</span>). A Merchant account is required to manage store inventory and pack orders.
            </p>
          ) : (
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px' }}>
              Please sign in with your Merchant account to manage your store, inventory and payouts.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link
              href="/"
              className="btn btn-outline"
              style={{ padding: '11px 24px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' }}
            >
              Return to Marketplace →
            </Link>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{
                padding: '12px 24px',
                borderRadius: 999,
                fontWeight: 700,
                textDecoration: 'none',
                background: '#0B1527',
                color: '#fff',
                textAlign: 'center',
              }}
            >
              Sign In to Merchant Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal">
      {/* Mobile Drawer Overlay Backdrop */}
      {isSidebarOpen && (
        <div className="sidebar-overlay open" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Dark Left Sidebar */}
      <aside className={`sidebar no-print ${isSidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="logo" style={{ padding: '4px 8px 20px' }}>
          <svg viewBox="0 0 48 48" style={{ width: 34, height: 34, flex: 'none' }}>
            <defs>
              <linearGradient id="g-m-side" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F7E08B" />
                <stop offset="0.45" stopColor="#D4A017" />
                <stop offset="1" stopColor="#9E7410" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="11" fill="#0B1F4B" />
            <path d="M18 20v-3a6 6 0 0 1 12 0v3" fill="none" stroke="url(#g-m-side)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M12.5 20h23l-2.1 17.4A3 3 0 0 1 30.4 40H17.6a3 3 0 0 1-3-2.6z" fill="url(#g-m-side)" />
            <circle cx="22.4" cy="29.4" r="4.4" fill="#0B1F4B" />
            <path d="M26.2 28.4l5.6 1.4-5.6 1.8z" fill="#0B1F4B" />
          </svg>
          <div>
            <div className="wm" style={{ fontSize: 18, color: '#fff' }}>Buck<b>Duck</b></div>
            <span className="sub" style={{ fontSize: 9 }}>MERCHANT PORTAL</span>
          </div>
        </div>

        {/* Store badge card */}
        <div className="card" style={{ background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.1)', padding: 12, boxShadow: 'none', color: '#fff', marginBottom: 12 }}>
          <div className="row" style={{ gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, overflow: 'hidden', flex: 'none' }}>
              {user?.store?.emoji || '🌍'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="strong small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.store?.name || 'Accra Market'}
              </div>
              <div className="tiny" style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isStoreOnline ? '#22c55e' : '#ef4444',
                    boxShadow: isStoreOnline ? '0 0 6px #22c55e' : 'none',
                    display: 'inline-block',
                    flex: 'none',
                  }}
                />
                <span>{isStoreOnline ? '● Live on marketplace' : '✕ Store paused'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="side-sec">Menu</div>
        <button
          className={`side-link ${subView === 'dash' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => { setSubView('dash'); setIsSidebarOpen(false); }}
        >
          <LayoutDashboard size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'dash' ? 1 : 0.75 }} />
          <span>Dashboard</span>
        </button>

        <button
          className={`side-link ${subView === 'orders' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => { setSubView('orders'); setIsSidebarOpen(false); }}
        >
          <ClipboardList size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'orders' ? 1 : 0.75 }} />
          <span>Orders</span>
          {(newCount + inProgressCount) > 0 && (
            <span className="cnt">{newCount + inProgressCount}</span>
          )}
        </button>

        <button
          className={`side-link ${subView === 'products' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => { setSubView('products'); setIsSidebarOpen(false); }}
        >
          <Package size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'products' ? 1 : 0.75 }} />
          <span>Products</span>
          <span className="cnt" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            {products.length}
          </span>
        </button>

        <button
          className={`side-link ${subView === 'store' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => { setSubView('store'); setIsSidebarOpen(false); }}
        >
          <Store size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'store' ? 1 : 0.75 }} />
          <span>Storefront</span>
        </button>

        <button
          className={`side-link ${subView === 'payouts' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => { setSubView('payouts'); setIsSidebarOpen(false); }}
        >
          <DollarSign size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: subView === 'payouts' ? 1 : 0.75 }} />
          <span>Payouts</span>
        </button>

        <div className="side-sec">Public</div>
        <Link
          className="side-link"
          href={`/stores/${user?.store?.slug || 'accra-market'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <ExternalLink size={18} strokeWidth={2.2} style={{ flex: 'none', opacity: 0.75 }} />
          <span>View my storefront</span>
        </Link>

        <div className="side-foot">
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <div className="avatar-sm">{user?.name ? user.name.charAt(0) : 'E'}</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="strong small" style={{ color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user?.name || 'Efua Boateng'}
              </div>
              <div className="tiny" style={{ opacity: 0.6 }}>{user?.email || 'merchant@buckduck.com'}</div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-block"
            style={{ background: 'rgba(255,255,255,.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            <LogOut size={15} strokeWidth={2.2} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main">
        {/* Top Bar */}
        <div className="main-top no-print">
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="strong" style={{ fontSize: 16 }}>
              {subView === 'dash' && 'Dashboard'}
              {subView === 'orders' && 'Orders'}
              {subView === 'products' && 'Products'}
              {subView === 'store' && 'Storefront'}
              {subView === 'payouts' && 'Payouts'}
            </div>
          </div>

          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {/* Store Online / Offline Toggle Button */}
            <button
              type="button"
              onClick={() => setIsStoreOnline(!isStoreOnline)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: isStoreOnline ? '1.5px solid #86efac' : '1.5px solid #fca5a5',
                background: isStoreOnline ? '#f0fdf4' : '#fef2f2',
                color: isStoreOnline ? '#15803d' : '#b91c1c',
                transition: 'all 0.2s ease',
              }}
              title={isStoreOnline ? 'Store is online & accepting orders (Click to pause)' : 'Store is paused / offline (Click to go online)'}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isStoreOnline ? '#22c55e' : '#ef4444',
                  boxShadow: isStoreOnline ? '0 0 8px #22c55e' : 'none',
                  flex: 'none',
                }}
              />
              <span>{isStoreOnline ? 'Online' : 'Offline'}</span>
              <span className="hide-sm" style={{ fontWeight: 500, opacity: 0.85 }}>
                {isStoreOnline ? '· Accepting Orders' : '· Paused'}
              </span>
            </button>

            {/* Audio Alert Status & Test Chime */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--surface-2)',
                padding: '4px 8px',
                borderRadius: 20,
                border: '1px solid var(--line)',
              }}
            >
              <button
                type="button"
                onClick={() => setAudioEnabled(!audioEnabled)}
                style={{
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: 'var(--ink)',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title={audioEnabled ? 'Audio alerts active (Click to mute)' : 'Audio muted (Click to enable)'}
              >
                {audioEnabled ? (
                  <Volume2 size={15} style={{ color: '#16a34a', flex: 'none' }} />
                ) : (
                  <VolumeX size={15} style={{ color: '#64748b', flex: 'none' }} />
                )}
                <span className="hide-sm">
                  {audioEnabled ? 'Sound On' : 'Muted'}
                </span>
              </button>

              <button
                type="button"
                className="btn btn-sm btn-gold"
                style={{ padding: '3px 8px', fontSize: 11, borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={playChime}
                title="Test order notification chime"
              >
                <Bell size={12} />
                <span>{chimeFeedback || 'Chime'}</span>
              </button>
            </div>

            <span className="badge b-gold hide-sm">
              🚚 Next: Saturday, Oct 24
            </span>
            <Link href="/" className="btn btn-ghost btn-sm hide-sm">
              Marketplace
            </Link>
          </div>
        </div>

        {/* Targeted Admin Broadcast Announcement Banner */}
        {broadcastNotice && (
          <div
            style={{
              margin: '14px 24px 0',
              padding: '12px 18px',
              borderRadius: 10,
              background: '#0F172A',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              border: '1px solid var(--gold-metal, #D4A017)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📢</span>
              <div>
                <strong style={{ color: 'var(--gold-metal, #D4A017)', fontSize: 13, textTransform: 'uppercase' }}>
                  {broadcastNotice.title || 'Administrative Notice'}:
                </strong>{' '}
                <span style={{ fontSize: 13, color: '#f1f5f9' }}>{broadcastNotice.message}</span>
              </div>
            </div>
            <button
              onClick={() => setBroadcastNotice(null)}
              style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              aria-label="Dismiss announcement"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body View */}
        <div className="main-body">
          {/* SCREEN 1: KITCHEN ORDER QUEUE (KANBAN) */}
          {subView === 'orders' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Order queue</h1>
                  <p>Move each order across: accept → pack into BuckDuck bags → mark ready for driver pickup.</p>
                </div>
                <div className="row">
                  <span className="badge b-gold" style={{ fontSize: 14 }}>
                    🛍️ Est. {dashboard?.counts?.totalBags || 4} BuckDuck Bags Needed
                  </span>
                </div>
              </div>

              <div className="kanban">
                {/* 1. NEW / PLACED */}
                <div className="kanban-col">
                  <div className="kanban-header">
                    <span>1. NEW ({newCount})</span>
                  </div>
                  {orders.filter((o) => o.status === 'placed').map((o) => (
                    <div key={o.id} className="order-card" style={{ marginBottom: 12 }}>
                      <div className="row between">
                        <b>{o.number}</b>
                        <span className="tiny muted">{o.delivery_windows?.label?.split('·')[0]}</span>
                      </div>
                      <div className="small" style={{ margin: '4px 0' }}>
                        {o.users_orders_customer_idTousers?.name} · {o.order_items?.length} items
                      </div>
                      <div className="row between" style={{ marginBottom: 8 }}>
                        <span className="badge b-gold">🛍️ {o.bags} bag(s)</span>
                        <b>${(o.subtotal_cents / 100).toFixed(2)}</b>
                      </div>
                      <div className="row">
                        <button className="btn btn-ghost btn-sm grow" onClick={() => setDetailOrder(o)}>Details</button>
                        <button className="btn btn-primary btn-sm grow" onClick={() => updateOrderStatus(o.id, 'accepted')}>Accept</button>
                      </div>
                    </div>
                  ))}
                  {newCount === 0 && <div className="tiny muted center" style={{ padding: 24 }}>No new orders</div>}
                </div>

                {/* 2. ACCEPTED */}
                <div className="kanban-col">
                  <div className="kanban-header">
                    <span>2. ACCEPTED ({orders.filter((o) => o.status === 'accepted').length})</span>
                  </div>
                  {orders.filter((o) => o.status === 'accepted').map((o) => (
                    <div key={o.id} className="order-card" style={{ marginBottom: 12 }}>
                      <div className="row between">
                        <b>{o.number}</b>
                        <span className="tiny muted">{o.delivery_windows?.label?.split('·')[0]}</span>
                      </div>
                      <div className="small" style={{ margin: '4px 0' }}>
                        {o.users_orders_customer_idTousers?.name} · {o.order_items?.length} items
                      </div>
                      <div className="row between" style={{ marginBottom: 8 }}>
                        <span className="badge b-gold">🛍️ {o.bags} bag(s)</span>
                        <b>${(o.subtotal_cents / 100).toFixed(2)}</b>
                      </div>
                      <div className="row">
                        <button className="btn btn-ghost btn-sm grow" onClick={() => setDetailOrder(o)}>Details</button>
                        <button className="btn btn-blue btn-sm grow" onClick={() => updateOrderStatus(o.id, 'packing')}>Start packing</button>
                      </div>
                    </div>
                  ))}
                  {orders.filter((o) => o.status === 'accepted').length === 0 && <div className="tiny muted center" style={{ padding: 24 }}>No accepted orders</div>}
                </div>

                {/* 3. PACKING */}
                <div className="kanban-col">
                  <div className="kanban-header">
                    <span>3. PACKING ({orders.filter((o) => o.status === 'packing').length})</span>
                  </div>
                  {orders.filter((o) => o.status === 'packing').map((o) => (
                    <div key={o.id} className="order-card" style={{ marginBottom: 12 }}>
                      <div className="row between">
                        <b>{o.number}</b>
                        <span className="tiny muted">{o.delivery_windows?.label?.split('·')[0]}</span>
                      </div>
                      <div className="small" style={{ margin: '4px 0' }}>
                        {o.users_orders_customer_idTousers?.name} · Pack into sealed bags
                      </div>
                      <div className="row between" style={{ marginBottom: 8 }}>
                        <span className="badge b-gold">🛍️ Est. {o.bags} bag(s)</span>
                        <b>${(o.subtotal_cents / 100).toFixed(2)}</b>
                      </div>
                      <div className="row">
                        <button className="btn btn-ghost btn-sm grow" onClick={() => setDetailOrder(o)}>Details</button>
                        <button
                          className="btn btn-success btn-sm grow"
                          onClick={() => {
                            setReadyOrder(o);
                            setBagInput(o.bags || 1);
                          }}
                        >
                          Mark ready
                        </button>
                      </div>
                    </div>
                  ))}
                  {orders.filter((o) => o.status === 'packing').length === 0 && <div className="tiny muted center" style={{ padding: 24 }}>No packing orders</div>}
                </div>

                {/* 4. READY FOR PICKUP */}
                <div className="kanban-col">
                  <div className="kanban-header">
                    <span>4. READY FOR PICKUP ({readyCount})</span>
                  </div>
                  {orders.filter((o) => o.status === 'ready').map((o) => (
                    <div key={o.id} className="order-card" style={{ marginBottom: 12, background: 'var(--green-bg)' }}>
                      <div className="row between">
                        <b>{o.number}</b>
                        <span className="badge b-green">Ready</span>
                      </div>
                      <div className="small" style={{ margin: '4px 0' }}>
                        {o.users_orders_customer_idTousers?.name}
                      </div>
                      <div className="row between">
                        <span className="badge b-gold">🛍️ {o.bags} Bag(s) Sealed</span>
                        <b>${(o.subtotal_cents / 100).toFixed(2)}</b>
                      </div>
                      <div className="tiny muted" style={{ marginTop: 8 }}>
                        Awaiting Saturday driver pickup
                      </div>
                    </div>
                  ))}
                  {readyCount === 0 && <div className="tiny muted center" style={{ padding: 24 }}>No ready orders</div>}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 2: DASHBOARD */}
          {subView === 'dash' && (
            <div className="stack" style={{ gap: 24 }}>
              <div className="page-h">
                <div>
                  <h1>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name?.split(' ')[0] || 'Partner'}</h1>
                  <p>Next delivery day: <b>Saturday Morning (6 AM–12 PM)</b> — have all orders packed and marked ready before window start.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setSubView('orders')}>
                  Open order queue →
                </button>
              </div>

              {/* 4 KPI tiles */}
              <div className="grid g4">
                <div className="kpi">
                  <div className="lbl">New orders</div>
                  <div className="val">{newCount}</div>
                  <div className="sub">Need to be accepted</div>
                </div>
                <div className="kpi">
                  <div className="lbl">In progress</div>
                  <div className="val">{inProgressCount}</div>
                  <div className="sub">Accepted & packing</div>
                </div>
                <div className="kpi">
                  <div className="lbl">Ready for pickup</div>
                  <div className="val">{readyCount}</div>
                  <div className="sub">Awaiting driver</div>
                </div>
                <div className="kpi">
                  <div className="lbl">BuckDuck bags needed</div>
                  <div className="val">{dashboard?.counts?.totalBags || 4}</div>
                  <div className="sub">For this Saturday</div>
                </div>
              </div>

              {/* Weekly sales chart + Lifetime card */}
              <div className="dashboard-charts-grid">
                <div className="card">
                  <div className="card-h">
                    <h3>Weekly sales</h3>
                    <span className="small muted">Merchandise sales by delivery day</span>
                  </div>
                  <BarChart
                    data={chartData}
                    valueKey="sales"
                    labelKey="week"
                    tipLabel="Merchandise Sales"
                    color="var(--blue-600)"
                  />
                </div>

                <div className="card">
                  <h3>Lifetime</h3>
                  <div className="summary-line" style={{ marginTop: 12 }}>
                    <span>Delivered orders</span>
                    <b>{dashboard?.counts?.delivered || 12}</b>
                  </div>
                  <div className="summary-line">
                    <span>Gross sales</span>
                    <b>${((dashboard?.lifetimeSalesCents || 148000) / 100).toFixed(2)}</b>
                  </div>
                  <div className="summary-line">
                    <span>Commission (15%)</span>
                    <b>−${(((dashboard?.lifetimeSalesCents || 148000) * 0.15) / 100).toFixed(2)}</b>
                  </div>
                  <div className="summary-line total">
                    <span>Your earnings</span>
                    <span>${(((dashboard?.lifetimeSalesCents || 148000) * 0.85) / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Top Products & Low Stock */}
              <div className="grid g2">
                <div className="card">
                  <h3>Top products</h3>
                  <table className="table" style={{ marginTop: 10 }}>
                    <tbody>
                      {products.slice(0, 5).map((p) => (
                        <tr key={p.id}>
                          <td><span style={{ marginRight: 8, fontSize: 20 }}>{p.emoji || '🛒'}</span><b>{p.name}</b></td>
                          <td className="muted small">50 sold</td>
                          <td className="num strong">${(p.price_cents / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card">
                  <div className="card-h">
                    <h3>Low stock</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSubView('products')}>Manage →</button>
                  </div>
                  <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                    {products.slice(0, 3).map((p) => (
                      <div key={p.id} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span>{p.emoji || '🛒'}</span>
                          <span>{p.name}</span>
                        </div>
                        <span className="badge b-amber">{p.stock || 8} left</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3: PRODUCTS */}
          {subView === 'products' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Products</h1>
                  <p>{products.length} listings on your storefront</p>
                </div>
                <button
                  className="btn btn-gold"
                  onClick={() => openEditModal()}
                >
                  + Add product
                </button>
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th className="num">Price</th>
                        <th>Unit</th>
                        <th className="num">Stock</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const promo = parseProductPromo(p);
                        return (
                          <tr key={p.id}>
                            <td>
                              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                                {p.image_url ? (
                                  <img
                                    src={p.image_url}
                                    alt={p.name}
                                    style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flex: 'none' }}
                                  />
                                ) : (
                                  <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>{p.emoji || '🛒'}</span>
                                )}
                                <div>
                                  <b>{p.name}</b>
                                  {promo.isOnSale && (
                                    <span className="badge b-gold" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px' }}>
                                      {promo.badge || 'SALE'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>{p.category}</td>
                            <td className="num">
                              {promo.isOnSale ? (
                                <div>
                                  <span style={{ textDecoration: 'line-through', color: 'var(--muted)', fontSize: 12, marginRight: 6 }}>
                                    ${(p.price_cents / 100).toFixed(2)}
                                  </span>
                                  <strong style={{ color: '#b91c1c' }}>
                                    ${(promo.salePriceCents / 100).toFixed(2)}
                                  </strong>
                                </div>
                              ) : (
                                `$${(p.price_cents / 100).toFixed(2)}`
                              )}
                            </td>
                            <td className="muted">{p.unit}</td>
                            <td className="num">
                              <span className={`badge ${p.stock < 10 ? 'b-amber' : 'b-green'}`}>
                                {p.stock}
                              </span>
                            </td>
                            <td>
                              <span className="badge b-green">Live</span>
                            </td>
                            <td className="right">
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEditModal(p)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 4: STOREFRONT PROFILE & PREVIEW */}
          {subView === 'store' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Storefront</h1>
                  <p>How your store appears to shoppers on StoreFront USA.</p>
                </div>
              </div>

              <div className="storefront-grid">
                <form className="card form-grid" onSubmit={(e) => { e.preventDefault(); alert('Storefront settings updated'); }}>
                  <label className="field span4">
                    Store name
                    <input className="input" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} />
                  </label>
                  <label className="field span2">
                    Category
                    <input className="input" value={storeForm.category} onChange={(e) => setStoreForm({ ...storeForm, category: e.target.value })} />
                  </label>
                  <label className="field span6">
                    Tagline
                    <input className="input" value={storeForm.tagline} onChange={(e) => setStoreForm({ ...storeForm, tagline: e.target.value })} />
                  </label>
                  <label className="field span6">
                    About your store
                    <textarea className="input" value={storeForm.description} onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })} />
                  </label>
                  <label className="field span6">
                    Street address
                    <input className="input" value={storeForm.address} onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })} />
                  </label>
                  <label className="field span3">
                    City
                    <input className="input" value={storeForm.city} onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })} />
                  </label>
                  <label className="field span1">
                    State
                    <input className="input" value={storeForm.state} onChange={(e) => setStoreForm({ ...storeForm, state: e.target.value })} />
                  </label>
                  <label className="field span2">
                    ZIP
                    <input className="input" value={storeForm.zip} onChange={(e) => setStoreForm({ ...storeForm, zip: e.target.value })} />
                  </label>
                  <label className="field span2">
                    Brand Color
                    <input className="input" type="color" value={storeForm.color} onChange={(e) => setStoreForm({ ...storeForm, color: e.target.value })} style={{ height: 44, padding: 4 }} />
                  </label>
                  <label className="field span2">
                    Emoji Icon
                    <input className="input" value={storeForm.emoji} onChange={(e) => setStoreForm({ ...storeForm, emoji: e.target.value })} />
                  </label>
                  <label className="field span2">
                    Phone
                    <input className="input" value={storeForm.phone} onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })} />
                  </label>

                  <div className="span6">
                    <button type="submit" className="btn btn-primary">Save storefront</button>
                  </div>
                </form>

                {/* Right Column: PREVIEW */}
                <div>
                  <div className="small strong muted mb16">LIVE MARKETPLACE PREVIEW</div>
                  <div className="store-card" style={{ pointerEvents: 'none' }}>
                    <div className="cover" style={{ background: storeForm.color }}>
                      <div className="avatar">{storeForm.emoji}</div>
                    </div>
                    <div className="body">
                      <h3 className="mb0">{storeForm.name}</h3>
                      <div className="muted small">{storeForm.tagline}</div>
                      <div className="meta">
                        <span>★ 4.9</span>
                        <span>· {storeForm.category}</span>
                        <span>· {products.length} items</span>
                      </div>
                    </div>
                  </div>

                  <div className="card mt16">
                    <h4>Status</h4>
                    <span className="badge b-green">Live on marketplace</span>
                    <div className="summary-line mt16">
                      <span>Commission rate</span>
                      <b>15%</b>
                    </div>
                    <div className="summary-line">
                      <span>Packaging</span>
                      <span>Sealed BuckDuck Bags</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: PAYOUTS */}
          {subView === 'payouts' && (
            <div className="stack" style={{ gap: 20 }}>
              <div className="page-h">
                <div>
                  <h1>Payouts</h1>
                  <p>Earnings are transferred to your bank through Stripe after each order is delivered.</p>
                </div>
              </div>

              <div className="grid g3">
                <div className="kpi">
                  <div className="lbl">PENDING EARNINGS</div>
                  <div className="val">${((payouts?.pendingPayoutCents || 4800) / 100).toFixed(2)}</div>
                  <div className="sub">Orders not yet delivered</div>
                </div>
                <div className="kpi">
                  <div className="lbl">PAID OUT (LAST 26 WKS)</div>
                  <div className="val">${((payouts?.totalTransferredCents || 128000) / 100).toFixed(2)}</div>
                  <div className="sub">After 15% platform commission</div>
                </div>
                <div className="card">
                  <h4>Bank account</h4>
                  <span className="badge b-green" style={{ marginBottom: 8 }}>Stripe connected</span>
                  <div className="tiny muted">Bank account ending in •••• 4242</div>
                  <button className="btn btn-ghost btn-sm mt16" onClick={() => alert('Opening Stripe Connect Express portal...')}>
                    Open Stripe dashboard
                  </button>
                </div>
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Delivery day</th>
                        <th className="num">Orders</th>
                        <th className="num">Gross sales</th>
                        <th className="num">Commission</th>
                        <th className="num">Net payout</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Sat, Oct 17, 2026</strong></td>
                        <td className="num">8</td>
                        <td className="num">$480.00</td>
                        <td className="num">−$72.00</td>
                        <td className="num strong">$408.00</td>
                        <td><span className="badge b-green">Transferred</span></td>
                      </tr>
                      <tr>
                        <td><strong>Sat, Oct 10, 2026</strong></td>
                        <td className="num">6</td>
                        <td className="num">$340.00</td>
                        <td className="num">−$51.00</td>
                        <td className="num strong">$289.00</td>
                        <td><span className="badge b-green">Transferred</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRM BAG COUNT DIALOG (12a-ready-dialog.png) */}
      {readyOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24 }}>
            <h3>Confirm Bag Count</h3>
            <p className="small muted">
              How many sealed BuckDuck bags was order #{readyOrder.number} packed into? Drivers will verify this count upon collection.
            </p>
            <div style={{ margin: '18px 0' }}>
              <label className="field">
                Number of sealed bags
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="input"
                  value={bagInput}
                  onChange={(e) => setBagInput(parseInt(e.target.value) || 1)}
                />
              </label>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setReadyOrder(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => updateOrderStatus(readyOrder.id, 'ready', bagInput)}>
                Confirm & Mark Ready
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAILS & PACKING SLIP MODAL (12-merchant-order-modal.png) */}
      {detailOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div className="card-h">
              <h3>Order {detailOrder.number}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailOrder(null)}>✕</button>
            </div>

            <div className="grid g2" style={{ margin: '14px 0' }}>
              <div>
                <div className="tiny muted strong">DELIVERY</div>
                <div className="strong">{detailOrder.delivery_windows?.label}</div>
                <div className="small">
                  {(() => {
                    const rawName = detailOrder.users_orders_customer_idTousers?.name;
                    if (!rawName) return 'Customer';
                    const parts = rawName.trim().split(/\s+/);
                    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
                  })()}
                </div>
              </div>
              <div>
                <div className="tiny muted strong">PACKAGING</div>
                <span className="badge b-gold">🛍️ {detailOrder.bags} BuckDuck bag(s)</span>
              </div>
            </div>

            <table className="table" style={{ margin: '16px 0' }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                </tr>
              </thead>
              <tbody>
                {detailOrder.order_items?.map((it: any) => (
                  <tr key={it.id}>
                    <td>{it.emoji} {it.name}</td>
                    <td className="num strong">{it.qty}</td>
                    <td className="num">${((it.price_cents * it.qty) / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="summary-line">
              <span>Merchandise subtotal</span>
              <b>${(detailOrder.subtotal_cents / 100).toFixed(2)}</b>
            </div>
            <div className="summary-line">
              <span>Commission (15%)</span>
              <span>−${(detailOrder.commission_cents / 100).toFixed(2)}</span>
            </div>
            <div className="summary-line total">
              <span>Your net payout</span>
              <span>${((detailOrder.subtotal_cents - detailOrder.commission_cents) / 100).toFixed(2)}</span>
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={() => setDetailOrder(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <form className="card form-grid" onSubmit={handleSaveProduct} style={{ maxWidth: 580, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, borderRadius: 16 }}>
            <div className="span6 row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>{editingProduct.id ? 'Edit product' : 'Add new product'}</h3>
              <span className="badge b-gold" style={{ fontSize: 11 }}>Accra Market Catalog</span>
            </div>

            {/* PRODUCT PHOTO CAPTURE & UPLOAD */}
            <div className="span6" style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Camera size={16} style={{ color: 'var(--gold-metal, #D4A017)' }} />
                Product Photo Capture & Upload
              </div>
              <div className="row" style={{ alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {prodForm.image_url ? (
                  <div style={{ position: 'relative', width: 72, height: 72, flex: 'none' }}>
                    <img
                      src={prodForm.image_url}
                      alt="Product preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '2px solid var(--gold-metal, #D4A017)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setProdForm({ ...prodForm, image_url: '' })}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      background: '#e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#64748b',
                      flex: 'none',
                      border: '1.5px dashed #cbd5e1',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{prodForm.emoji || '📷'}</span>
                    <span>No photo</span>
                  </div>
                )}

                <div className="stack" style={{ gap: 6, flex: 1, minWidth: 200 }}>
                  <label
                    htmlFor="merchant-prod-photo"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 14px',
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0f172a',
                      cursor: 'pointer',
                      width: 'fit-content',
                    }}
                  >
                    <Camera size={15} />
                    <span>{prodForm.image_url ? 'Retake / Change Photo' : 'Take Photo or Choose File'}</span>
                  </label>
                  <input
                    id="merchant-prod-photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                  <span className="tiny muted">
                    JPG, PNG, or mobile camera capture (max 5 MB).
                  </span>
                </div>
              </div>
            </div>

            <label className="field span4">
              Product name
              <input className="input" required value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} />
            </label>
            <label className="field span2">
              Emoji icon
              <input className="input" value={prodForm.emoji} onChange={(e) => setProdForm({ ...prodForm, emoji: e.target.value })} />
            </label>
            <label className="field span2">
              Regular Price ($)
              <input
                className="input"
                type="number"
                step="0.01"
                required
                value={(prodForm.price_cents / 100).toFixed(2)}
                onChange={(e) => setProdForm({ ...prodForm, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
              />
            </label>
            <label className="field span2">
              Unit (e.g. 1 lb, bunch, 16 oz)
              <input className="input" value={prodForm.unit} onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })} />
            </label>
            <label className="field span2">
              Stock available
              <input className="input" type="number" value={prodForm.stock} onChange={(e) => setProdForm({ ...prodForm, stock: parseInt(e.target.value) || 0 })} />
            </label>
            <label className="field span6">
              Category
              <input className="input" value={prodForm.category} onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })} />
            </label>

            {/* ON SALE & PROMOTIONAL DISCOUNT FEATURE */}
            {promotionsEnabled && (
              <div className="span6" style={{ background: prodForm.is_on_sale ? '#fffbeb' : '#f8fafc', padding: 14, borderRadius: 10, border: `1px solid ${prodForm.is_on_sale ? '#fde68a' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: prodForm.is_on_sale ? 12 : 0 }}>
                  <input
                    type="checkbox"
                    checked={prodForm.is_on_sale}
                    onChange={(e) => setProdForm({
                      ...prodForm,
                      is_on_sale: e.target.checked,
                      sale_price_cents: prodForm.sale_price_cents || Math.round(prodForm.price_cents * 0.8),
                    })}
                    style={{ width: 18, height: 18, accentColor: 'var(--gold-metal, #D4A017)' }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag size={15} /> Put on Sale / Promotional Discount
                    </span>
                    <span className="tiny muted" style={{ display: 'block' }}>
                      Feature this product with a discounted sale price and promo tag in customer search.
                    </span>
                  </div>
                </label>

                {prodForm.is_on_sale && (
                  <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>Sale Price ($)</span>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        required={prodForm.is_on_sale}
                        value={(prodForm.sale_price_cents / 100).toFixed(2)}
                        onChange={(e) => setProdForm({ ...prodForm, sale_price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                        style={{ borderColor: '#fde68a', fontWeight: 700, color: '#b91c1c' }}
                      />
                    </label>

                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>Promo Tag / Badge</span>
                      <input
                        className="input"
                        placeholder="e.g. 20% OFF, SALE, SPECIAL"
                        value={prodForm.promo_badge}
                        onChange={(e) => setProdForm({ ...prodForm, promo_badge: e.target.value })}
                        style={{ borderColor: '#fde68a' }}
                      />
                    </label>

                    <div style={{ width: '100%', fontSize: 12, color: '#78350f', background: 'rgba(217, 119, 6, 0.1)', padding: '6px 10px', borderRadius: 6 }}>
                      Customers will see: <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>${(prodForm.price_cents / 100).toFixed(2)}</span>{' '}
                      <strong style={{ color: '#b91c1c' }}>${(prodForm.sale_price_cents / 100).toFixed(2)}</strong>{' '}
                      <span className="badge b-gold" style={{ fontSize: 10 }}>{prodForm.promo_badge || 'SALE'}</span>{' '}
                      ({Math.round(((prodForm.price_cents - prodForm.sale_price_cents) / Math.max(1, prodForm.price_cents)) * 100)}% savings)
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="span6 row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingProduct(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save product</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
