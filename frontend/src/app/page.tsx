'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Store {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  address: string;
  city: string;
  state: string;
  color: string;
  emoji: string;
  rating: number;
  products?: any[];
  product_count?: number;
}

interface DeliveryWindow {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  label: string;
  capacity: number;
  booked: number;
  remaining: number;
  open?: boolean;
}

export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipInput, setZipInput] = useState('');
  const [zipStatus, setZipStatus] = useState<{ checked: boolean; valid: boolean; message: string } | null>(null);

  const handleCheckZip = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanZip = zipInput.trim();
    if (!cleanZip) return;

    const supportedZips: Record<string, string> = {
      '20910': 'Downtown Silver Spring, MD',
      '20901': 'Silver Spring / Four Corners, MD',
      '20902': 'Wheaton / Silver Spring, MD',
      '20903': 'Hillandale, MD',
      '20904': 'White Oak / Colesville, MD',
      '20905': 'Cloverly, MD',
      '20906': 'Aspen Hill / Glenmont, MD',
      '20912': 'Takoma Park, MD',
      '20850': 'Rockville, MD',
      '20852': 'North Bethesda, MD',
      '20011': 'Petworth / Brightwood, DC',
      '20012': 'Takoma, DC',
    };

    if (supportedZips[cleanZip] || cleanZip.startsWith('209') || cleanZip.startsWith('208')) {
      const area = supportedZips[cleanZip] || 'Silver Spring & Montgomery County, MD';
      setZipStatus({
        checked: true,
        valid: true,
        message: `🎉 Great news! We deliver to ${area} (${cleanZip}) every Saturday!`,
      });
      try {
        localStorage.setItem('bd_zip', cleanZip);
      } catch {}
    } else {
      setZipStatus({
        checked: true,
        valid: false,
        message: `📍 ${cleanZip} is outside our current Saturday pilot zone (Silver Spring & Montgomery County, MD). Expanding soon!`,
      });
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [storesRes, catsRes, winsRes] = await Promise.all([
          fetch('/api/stores'),
          fetch('/api/stores/categories'),
          fetch('/api/windows'),
        ]);

        if (storesRes.ok) {
          const s = await storesRes.json();
          setStores(s);
        }
        if (catsRes.ok) {
          const c = await catsRes.json();
          setCategories(c);
        }
        if (winsRes.ok) {
          const w = await winsRes.json();
          setWindows(w);
        }
      } catch (err) {
        console.error('Failed to load home data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredStores =
    selectedCategory === 'All'
      ? stores
      : stores.filter((s) => s.category?.toLowerCase() === selectedCategory.toLowerCase());

  // Delivery windows calculation matching demo:
  const nextWindows = windows.length > 0 ? windows.slice(0, 2) : [
    {
      id: 1,
      date: '2026-10-24',
      start_time: '06:00',
      end_time: '12:00',
      label: 'Morning · 6 AM – 12 PM',
      capacity: 120,
      booked: 13,
      remaining: 107,
      open: true,
    },
    {
      id: 2,
      date: '2026-10-24',
      start_time: '12:00',
      end_time: '16:00',
      label: 'Afternoon · 12 PM – 4 PM',
      capacity: 120,
      booked: 17,
      remaining: 103,
      open: true,
    },
  ];

  return (
    <div>
      {/* ================= HERO SECTION ================= */}
      <section className="hero">
        <div className="container">
          <div>
            <span className="eyebrow">★ Saturday Grocery Delivery</span>
            <h1>
              Your neighborhood grocers. <em>Delivered every Saturday.</em>
            </h1>
            <p className="lead">
              Shop African, Caribbean and local markets in one cart. Each store packs your order in sealed BuckDuck bags, and our drivers bring it all to your door in the window you choose.
            </p>

            {/* Interactive ZIP Code Validator */}
            <div
              style={{
                marginTop: 20,
                padding: '14px 18px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                maxWidth: 480,
              }}
            >
              <form onSubmit={handleCheckZip} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>📍</span>
                <input
                  type="text"
                  placeholder="Enter delivery ZIP (e.g. 20910)"
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  maxLength={5}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.95)',
                    color: '#0B1F4B',
                    border: 0,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-sm btn-gold"
                  style={{ padding: '8px 16px', fontWeight: 700 }}
                >
                  Check ZIP
                </button>
              </form>

              {zipStatus && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: zipStatus.valid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: zipStatus.valid ? '#86efac' : '#fca5a5',
                    border: `1px solid ${zipStatus.valid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  }}
                >
                  {zipStatus.message}
                </div>
              )}
            </div>
            <div className="row wrap mt24">
              <Link className="btn btn-gold btn-lg" href="/stores">
                Start shopping
              </Link>
              <a
                className="btn btn-lg"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}
                href="#how"
              >
                How it works
              </a>
            </div>
            <div
              className="row wrap mt24 small"
              style={{ color: 'rgba(255,255,255,.75)', gap: 22 }}
            >
              <span>✓ {stores.length || 6} local stores</span>
              <span>✓ One delivery fee per store</span>
              <span>✓ Apple Pay & Google Pay</span>
            </div>
          </div>

          {/* Right Hero Card: Next Delivery Day */}
          <div className="hero-card">
            <div className="row between">
              <div>
                <div
                  className="tiny"
                  style={{
                    color: 'var(--gold-400)',
                    fontWeight: 800,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  NEXT DELIVERY DAY
                </div>
                <div className="display" style={{ fontSize: 28, marginTop: 2 }}>
                  Saturday, October 24
                </div>
              </div>
              <div style={{ fontSize: 42 }}>🚚</div>
            </div>

            {nextWindows.map((w, idx) => (
              <div key={w.id || idx} className="slot">
                <div>
                  <div className="t">{w.label}</div>
                  <div className="tiny" style={{ opacity: 0.7 }}>
                    {w.remaining || 107} spots left · order by Oct 23, {idx === 0 ? '6:00 AM' : '12:00 PM'}
                  </div>
                </div>
                <div className="bar">
                  <i
                    style={{
                      width: `${Math.round(((w.booked || 15) / (w.capacity || 120)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <Link className="btn btn-gold btn-block mt16" href="/stores">
              Reserve my window
            </Link>
          </div>
        </div>
      </section>

      {/* ================= HOW BUCKDUCK WORKS ================= */}
      <section className="section" id="how">
        <div className="container">
          <div className="section-h">
            <div>
              <h2>How BuckDuck works</h2>
              <p className="muted mb0">Built around one predictable weekly delivery day.</p>
            </div>
          </div>
          <div className="steps">
            <div className="step">
              <div className="n">1</div>
              <h3>Shop many stores</h3>
              <p className="muted small mb0">
                Fill one cart from any of our partner grocers — produce, meats, pantry staples and bakery.
              </p>
            </div>
            <div className="step">
              <div className="n">2</div>
              <h3>Pick your Saturday window</h3>
              <p className="muted small mb0">
                Choose Morning (6 AM – 12 PM) or Afternoon (12 PM – 4 PM). Pay securely with card, Apple Pay or Google Pay.
              </p>
            </div>
            <div className="step">
              <div className="n">3</div>
              <h3>Stores pack in BuckDuck bags</h3>
              <p className="muted small mb0">
                Each store prepares your items in sealed, labeled BuckDuck packaging ready for pickup.
              </p>
            </div>
            <div className="step">
              <div className="n">4</div>
              <h3>Delivered to your door</h3>
              <p className="muted small mb0">
                A vetted BuckDuck driver collects and delivers within your window, with live status updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SHOP LOCAL STORES ================= */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-h">
            <h2>Shop local stores</h2>
            <Link href="/stores" className="strong" style={{ color: 'var(--blue-700)' }}>
              View all →
            </Link>
          </div>

          {/* Category Chips */}
          <div className="chips mb16">
            <button
              className={`chip ${selectedCategory === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('All')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`chip ${selectedCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                onClick={() => setSelectedCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Store Grid */}
          <div className="store-grid">
            {filteredStores.slice(0, 8).map((store) => (
              <Link
                key={store.id}
                href={`/stores/${store.slug}`}
                className="store-card"
              >
                <div
                  className="cover"
                  style={{
                    background: `linear-gradient(135deg, ${store.color || '#1E3A8A'}, ${store.color || '#1E3A8A'}cc), var(--navy-900)`,
                  }}
                >
                  <div className="avatar">{store.emoji || '🛒'}</div>
                </div>
                <div className="body">
                  <h3 className="mb0">{store.name}</h3>
                  <div className="muted small">
                    {store.tagline || store.category}
                  </div>
                  <div className="meta">
                    <span>★ {Number(store.rating || 4.8).toFixed(1)}</span>
                    <span>· {store.category}</span>
                    <span>· {store.products?.length || store.product_count || 12} items</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA BAND ================= */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container cta-band">
          <div className="cta merchant">
            <h3>Own a grocery store?</h3>
            <p style={{ opacity: 0.85 }}>
              Open your StoreFront in minutes. We handle payments, packaging, drivers and delivery — you focus on great products.
            </p>
            <Link className="btn btn-gold mt16" href="/login">
              Open your storefront
            </Link>
          </div>

          <div className="cta driver">
            <h3>Drive Saturdays. Earn more.</h3>
            <p style={{ opacity: 0.85 }}>
              One concentrated day of batched routes, base pay per stop, and you keep 100% of tips.
            </p>
            <Link className="btn btn-gold mt16" href="/login">
              Apply to drive
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
