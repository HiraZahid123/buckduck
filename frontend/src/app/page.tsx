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

interface ServiceZipItem {
  zip: string;
  city: string;
  state: string;
  zone: string;
  active: boolean;
}

export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipInput, setZipInput] = useState('');
  const [zipStatus, setZipStatus] = useState<{ checked: boolean; valid: boolean; message: string } | null>(null);
  const [serviceZips, setServiceZips] = useState<ServiceZipItem[]>([]);
  const [adminBanner, setAdminBanner] = useState<{ enabled: boolean; message: string; showToMerchants?: boolean } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const defaultSupportedZips: Record<string, { city: string; state: string; zone: string }> = {
    // Laurel, Maryland (20707–20726)
    '20707': { city: 'Laurel', state: 'MD', zone: 'Laurel / Prince George\'s' },
    '20708': { city: 'Laurel', state: 'MD', zone: 'South Laurel' },
    '20709': { city: 'Laurel', state: 'MD', zone: 'Laurel Central' },
    '20723': { city: 'Laurel', state: 'MD', zone: 'North Laurel / Scaggsville' },
    '20724': { city: 'Laurel', state: 'MD', zone: 'Maryland City / Laurel' },
    '20725': { city: 'Laurel', state: 'MD', zone: 'Laurel PO' },
    '20726': { city: 'Laurel', state: 'MD', zone: 'Laurel Metro' },

    // Silver Spring, Maryland (20901–20997)
    '20901': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring / Four Corners' },
    '20902': { city: 'Silver Spring', state: 'MD', zone: 'Wheaton / Glenmont' },
    '20903': { city: 'Silver Spring', state: 'MD', zone: 'Hillandale' },
    '20904': { city: 'Silver Spring', state: 'MD', zone: 'White Oak / Colesville' },
    '20905': { city: 'Silver Spring', state: 'MD', zone: 'Cloverly' },
    '20906': { city: 'Silver Spring', state: 'MD', zone: 'Aspen Hill / Layhill' },
    '20907': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring East' },
    '20908': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring North' },
    '20910': { city: 'Silver Spring', state: 'MD', zone: 'Downtown Silver Spring' },
    '20911': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring Center' },
    '20912': { city: 'Takoma Park', state: 'MD', zone: 'Takoma Park Old Town' },
    '20913': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring Metro' },
    '20914': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring Park' },
    '20915': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring West' },
    '20916': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring Station' },
    '20918': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring Highlands' },
    '20993': { city: 'Silver Spring', state: 'MD', zone: 'FDA White Oak Campus' },
    '20997': { city: 'Silver Spring', state: 'MD', zone: 'Silver Spring Hub' },

    // Surrounding Service Areas
    '20850': { city: 'Rockville', state: 'MD', zone: 'Rockville Town Center' },
    '20852': { city: 'North Bethesda', state: 'MD', zone: 'Pike & Rose / White Flint' },
    '20011': { city: 'Washington', state: 'DC', zone: 'Petworth / Brightwood' },
    '20012': { city: 'Washington', state: 'DC', zone: 'Takoma DC' },
  };

  const knownRegions: Record<string, { label: string; city: string; zip: string }> = {
    'montgomery': { label: 'Montgomery County, MD (Silver Spring, Takoma Park, Bethesda, Rockville)', city: 'Silver Spring', zip: '20910' },
    'montgomery county': { label: 'Montgomery County, MD (Silver Spring, Takoma Park, Bethesda, Rockville)', city: 'Silver Spring', zip: '20910' },
    'prince george': { label: "Prince George's County, MD (Laurel, Bowie, Greenbelt, Hyattsville)", city: 'Laurel', zip: '20707' },
    "prince george's": { label: "Prince George's County, MD (Laurel, Bowie, Greenbelt, Hyattsville)", city: 'Laurel', zip: '20707' },
    "prince george's county": { label: "Prince George's County, MD (Laurel, Bowie, Greenbelt, Hyattsville)", city: 'Laurel', zip: '20707' },
    'pg county': { label: "Prince George's County, MD (Laurel, Bowie, Greenbelt, Hyattsville)", city: 'Laurel', zip: '20707' },
    'dmv': { label: 'DMV Saturday Metro Zone (MD & DC Grocers)', city: 'Silver Spring', zip: '20910' },
    'dmv metro': { label: 'DMV Saturday Metro Zone (MD & DC Grocers)', city: 'Silver Spring', zip: '20910' },
    'bowie': { label: "Bowie / Prince George's County, MD", city: 'Bowie', zip: '20715' },
    'greenbelt': { label: "Greenbelt / Prince George's County, MD", city: 'Greenbelt', zip: '20770' },
    'hyattsville': { label: "Hyattsville / Prince George's County, MD", city: 'Hyattsville', zip: '20782' },
    'college park': { label: "College Park / Prince George's County, MD", city: 'College Park', zip: '20740' },
    'beltsville': { label: "Beltsville / Prince George's County, MD", city: 'Beltsville', zip: '20705' },
    'wheaton': { label: 'Wheaton / Montgomery County, MD', city: 'Silver Spring', zip: '20902' },
  };

  const validateLocation = (inputLocation: string) => {
    const query = inputLocation.trim();
    if (!query) return;

    const lowerQuery = query.toLowerCase();
    const isZipCode = /^\d{5}$/.test(query);

    let matchedArea = '';
    let matchedLocation = '';

    if (isZipCode) {
      if (serviceZips.length > 0) {
        const match = serviceZips.find((z) => z.zip === query && z.active);
        if (match) {
          matchedArea = `${match.zone || match.city}, ${match.state}`;
          matchedLocation = `${query}`;
        }
      }
      if (!matchedArea && defaultSupportedZips[query]) {
        const item = defaultSupportedZips[query];
        matchedArea = `${item.zone || item.city}, ${item.state}`;
        matchedLocation = `${query}`;
      } else if (!matchedArea && (query.startsWith('209') || query.startsWith('207') || query.startsWith('208'))) {
        matchedArea = 'Maryland & DC Metro Saturday Zone';
        matchedLocation = `${query}`;
      }
    } else {
      // 1. Region or county search
      for (const [rKey, rVal] of Object.entries(knownRegions)) {
        if (lowerQuery.includes(rKey) || rKey.includes(lowerQuery)) {
          matchedArea = rVal.label;
          matchedLocation = rVal.city;
          break;
        }
      }

      // 2. City search
      if (!matchedArea && serviceZips.length > 0) {
        const matchCity = serviceZips.find(
          (z) => z.active && (z.city.toLowerCase() === lowerQuery || lowerQuery.includes(z.city.toLowerCase()) || z.city.toLowerCase().includes(lowerQuery))
        );
        if (matchCity) {
          matchedArea = `${matchCity.city}, ${matchCity.state}`;
          matchedLocation = matchCity.city;
        }
      }
      if (!matchedArea) {
        const defaultList = Object.values(defaultSupportedZips);
        const matchDefault = defaultList.find(
          (z) => z.city.toLowerCase() === lowerQuery || lowerQuery.includes(z.city.toLowerCase()) || z.city.toLowerCase().includes(lowerQuery)
        );
        if (matchDefault) {
          matchedArea = `${matchDefault.city}, ${matchDefault.state}`;
          matchedLocation = matchDefault.city;
        }
      }
    }

    if (matchedArea) {
      setZipStatus({
        checked: true,
        valid: true,
        message: `🎉 Great news! We deliver to ${matchedArea} (${matchedLocation}) every Saturday!`,
      });
      try {
        localStorage.setItem('bd_zip', isZipCode ? query : '20910');
        localStorage.setItem('bd_city', matchedLocation);
      } catch {}
    } else {
      setZipStatus({
        checked: true,
        valid: false,
        message: `📍 "${query}" is outside our current Saturday delivery zones. We are expanding soon!`,
      });
    }
  };

  const handleCheckZip = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    validateLocation(zipInput);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [storesRes, catsRes, winsRes, setRes] = await Promise.all([
          fetch('/api/stores'),
          fetch('/api/stores/categories'),
          fetch('/api/windows'),
          fetch('/api/settings').catch(() => null),
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
        if (setRes && setRes.ok) {
          const st = await setRes.json();
          if (st.service_zip_codes) {
            try {
              const parsed = JSON.parse(st.service_zip_codes);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setServiceZips(parsed);
              }
            } catch {}
          }
          if (st.admin_landing_banner) {
            try {
              const b = typeof st.admin_landing_banner === 'string' ? JSON.parse(st.admin_landing_banner) : st.admin_landing_banner;
              setAdminBanner(b);
            } catch {}
          }
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
      {/* Admin Scrolling Announcement Banner */}
      {adminBanner?.enabled && adminBanner?.message && (
        <div
          style={{
            background: 'linear-gradient(90deg, #1E3A8A, #0F172A, #1E3A8A)',
            color: '#FFFFFF',
            borderBottom: '2px solid #F59E0B',
            padding: '9px 16px',
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                background: '#F59E0B',
                color: '#0B1F4B',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              Notice
            </span>
            <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div className="marquee-text" style={{ fontSize: 13, fontWeight: 600 }}>
                {adminBanner.message}
              </div>
            </div>
          </div>
        </div>
      )}

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

            {/* Interactive City, Town, Region & ZIP Validator */}
            <div
              style={{
                marginTop: 20,
                padding: '12px 14px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                maxWidth: 520,
                width: '100%',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              <form onSubmit={handleCheckZip} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search by City, Town, Region or ZIP (e.g. Laurel, Silver Spring, Montgomery County)"
                    value={zipInput}
                    onChange={(e) => {
                      setZipInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    maxLength={40}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.95)',
                      color: '#0B1F4B',
                      border: 0,
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  />
                  {showSuggestions && zipInput.trim().length >= 2 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: '#FFFFFF',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        zIndex: 999,
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      {[
                        { title: 'Silver Spring, MD', desc: 'Montgomery County (20901–20997)' },
                        { title: 'Laurel, MD', desc: "Prince George's County (20707–20726)" },
                        { title: 'Takoma Park, MD', desc: 'Montgomery County (20912)' },
                        { title: 'Rockville, MD', desc: 'Montgomery County (20850)' },
                        { title: "Prince George's County, MD", desc: 'Full Saturday Zone (Laurel, Bowie, Greenbelt)' },
                        { title: 'Montgomery County, MD', desc: 'Full Saturday Zone (Silver Spring, Bethesda)' },
                        { title: 'DMV Saturday Metro', desc: 'MD & DC Metro Service Area' },
                      ]
                        .filter(
                          (item) =>
                            item.title.toLowerCase().includes(zipInput.toLowerCase()) ||
                            item.desc.toLowerCase().includes(zipInput.toLowerCase())
                        )
                        .map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setZipInput(item.title);
                              setShowSuggestions(false);
                              validateLocation(item.title);
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #F1F5F9',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ fontWeight: 600, color: '#0B1F4B', fontSize: 13 }}>{item.title}</span>
                            <span style={{ color: '#64748B', fontSize: 11 }}>{item.desc}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn btn-sm btn-gold"
                  style={{ padding: '9px 14px', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Check Area
                </button>
              </form>

              {/* Quick Search Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>
                  Popular:
                </span>
                {[
                  { label: '🏙️ Silver Spring', q: 'Silver Spring' },
                  { label: '🏙️ Laurel', q: 'Laurel' },
                  { label: "🏛️ Prince George's", q: "Prince George's County" },
                  { label: '🌳 Montgomery County', q: 'Montgomery County' },
                  { label: '📍 Takoma Park', q: 'Takoma Park' },
                ].map((chip) => (
                  <button
                    key={chip.q}
                    type="button"
                    onClick={() => {
                      setZipInput(chip.q);
                      setShowSuggestions(false);
                      validateLocation(chip.q);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.18)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: 20,
                      color: '#FFFFFF',
                      padding: '3px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

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
            <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
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
                <div className="display" style={{ fontSize: 'clamp(20px, 5.5vw, 28px)', marginTop: 2, lineHeight: 1.15 }}>
                  Saturday, October 24
                </div>
              </div>
              <div style={{ fontSize: 34, flexShrink: 0, lineHeight: 1 }}>🚚</div>
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
            {['All', ...Array.from(new Set(categories.filter((c) => c && c.toLowerCase() !== 'all')))].map((c) => (
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
