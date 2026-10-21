'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Client-side cache to eliminate repeated network fetches for previously typed queries
const searchCache = new Map<string, any[]>();

export default function Header() {
  const { user, logout } = useAuth();
  const { itemCount, addToCart } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const mobileWrapperRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Instant runtime search with 120ms debounce and client-side memory caching
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      setIsDropdownOpen(false);
      return;
    }

    // Check client cache first for sub-millisecond response
    if (searchCache.has(q.toLowerCase())) {
      setResults(searchCache.get(q.toLowerCase()) || []);
      setIsDropdownOpen(true);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          searchCache.set(q.toLowerCase(), data);
          setResults(data);
          setIsDropdownOpen(true);
        }
      } catch (err) {
        console.error('Live search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(event.target as Node) &&
        mobileWrapperRef.current &&
        !mobileWrapperRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsDropdownOpen(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSelectProduct = (product: any) => {
    setIsDropdownOpen(false);
    if (product.stores?.slug) {
      router.push(`/stores/${product.stores.slug}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(product.name)}`);
    }
  };

  const handleSignOut = () => {
    setIsAccountOpen(false);
    logout();
    router.push('/login');
  };

  const accountLink = user ? (
    <div className="account-dropdown-wrapper" ref={accountMenuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="nav-link"
        style={{
          background: 'none',
          border: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'inherit',
          font: 'inherit',
          padding: '6px 10px',
          borderRadius: 8,
        }}
        onClick={() => setIsAccountOpen(!isAccountOpen)}
        aria-label="Account menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="lbl">{user.name?.split(' ')[0] || 'Account'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.6 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isAccountOpen && (
        <div
          className="card shadow-lg"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 230,
            padding: '12px',
            background: 'var(--surface, #ffffff)',
            color: 'var(--ink, #0b1f4b)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.24)',
            borderRadius: 12,
            border: '1px solid var(--line, #e2e8f0)',
            zIndex: 1000,
          }}
        >
          <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--line, #e2e8f0)', marginBottom: 8 }}>
            <div className="strong" style={{ fontSize: 14, color: 'var(--ink)' }}>
              {user.name}
            </div>
            <div className="tiny muted" style={{ wordBreak: 'break-all' }}>
              {user.email}
            </div>
            <div style={{ marginTop: 6 }}>
              <span className="badge b-gold" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {user.role}
              </span>
            </div>
          </div>

          <div className="stack" style={{ gap: 4 }}>
            <Link
              href="/account"
              className="row"
              style={{
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--ink, #0b1f4b)',
                textDecoration: 'none',
              }}
              onClick={() => setIsAccountOpen(false)}
            >
              <span>📦</span>
              <span>My Orders & Account</span>
            </Link>

            {user.role === 'merchant' && (
              <Link
                href="/merchant"
                className="row"
                style={{
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  color: 'var(--ink, #0b1f4b)',
                  textDecoration: 'none',
                }}
                onClick={() => setIsAccountOpen(false)}
              >
                <span>🏪</span>
                <span>Merchant Dashboard</span>
              </Link>
            )}

            {user.role === 'driver' && (
              <Link
                href="/driver"
                className="row"
                style={{
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  color: 'var(--ink, #0b1f4b)',
                  textDecoration: 'none',
                }}
                onClick={() => setIsAccountOpen(false)}
              >
                <span>🚗</span>
                <span>Driver Portal</span>
              </Link>
            )}

            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="row"
                style={{
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  color: 'var(--ink, #0b1f4b)',
                  textDecoration: 'none',
                }}
                onClick={() => setIsAccountOpen(false)}
              >
                <span>⚙️</span>
                <span>Admin Console</span>
              </Link>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{
                width: '100%',
                marginTop: 6,
                padding: '6px 8px',
                justifyContent: 'flex-start',
                color: '#dc2626',
                borderTop: '1px solid var(--line, #e2e8f0)',
                borderRadius: '0 0 6px 6px',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
              onClick={handleSignOut}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <Link href="/login" className="nav-link">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <span className="lbl">Sign in</span>
    </Link>
  );

  return (
    <>
      {/* Top Banner Matching buckduck-demo.html */}
      <div className="topbar no-print">
        <div className="container">
          <span>
            🦆 <span className="gold">One delivery day. Every week.</span>{' '}
            <span className="hide-sm">Order from multiple local stores — It all arrives Saturday.</span>
          </span>
          <span className="hide-sm">
            Next delivery: <b>Saturday, Oct 24</b> · Order by Oct 23, 6:00 AM
          </span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className="nav no-print">
        <div className="container">
          {/* Logo */}
          <Link href="/" className="logo">
            <svg viewBox="0 0 48 48">
              <defs>
                <linearGradient id="g-logo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#F7E08B" />
                  <stop offset="0.45" stopColor="#D4A017" />
                  <stop offset="1" stopColor="#9E7410" />
                </linearGradient>
              </defs>
              <rect width="48" height="48" rx="11" fill="#0B1F4B" />
              <path
                d="M18 20v-3a6 6 0 0 1 12 0v3"
                fill="none"
                stroke="url(#g-logo)"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <path
                d="M12.5 20h23l-2.1 17.4A3 3 0 0 1 30.4 40H17.6a3 3 0 0 1-3-2.6z"
                fill="url(#g-logo)"
              />
              <circle cx="22.4" cy="29.4" r="4.4" fill="#0B1F4B" />
              <path d="M26.2 28.4l5.6 1.4-5.6 1.8z" fill="#0B1F4B" />
              <circle cx="23.3" cy="28.3" r="1" fill="#F7E08B" />
              <path
                d="M17 35.5c3 1.6 9 1.6 14 0"
                stroke="#0B1F4B"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <div className="wm">
                Buck<b>Duck</b>
              </div>
              <span className="sub">STOREFRONT USA</span>
            </div>
          </Link>

          {/* Search bar with live runtime dropdown (Desktop) */}
          <div className="search-wrapper" ref={searchWrapperRef}>
            <form className="search" onSubmit={handleSearchSubmit} role="search" style={{ width: '100%', margin: 0 }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                name="q"
                placeholder="Search plantains, palm oil, goat meat…"
                aria-label="Search products"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (results.length > 0) setIsDropdownOpen(true);
                }}
              />
            </form>

            {/* LIVE SEARCH DROPDOWN OVERLAY */}
            {isDropdownOpen && searchQuery.trim().length > 0 && (
              <div className="live-search-dropdown">
                <div className="live-search-header">
                  <span>{isSearching ? 'Searching...' : `Found ${results.length} item${results.length === 1 ? '' : 's'}`}</span>
                  <span className="tiny muted">Press Enter to view all</span>
                </div>

                {results.length > 0 ? (
                  <>
                    {results.map((product) => (
                      <div
                        key={product.id}
                        className="live-search-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSelectProduct(product)}
                      >
                        <div className="live-search-thumb">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} />
                          ) : (
                            <span>{product.emoji || '🛒'}</span>
                          )}
                        </div>

                        <div className="live-search-info">
                          <div className="title">{product.name}</div>
                          <div className="sub">
                            <span>{product.stores?.name || 'Local Store'}</span>
                            <span>·</span>
                            <span className="muted">{product.unit || '1 lb'}</span>
                          </div>
                        </div>

                        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                          <span className="live-search-price">
                            ${((product.price_cents || 0) / 100).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-gold"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart({
                                ...product,
                                stores: product.stores || {
                                  id: product.store_id,
                                  name: 'Local Store',
                                },
                              });
                            }}
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    ))}

                    <div
                      className="live-search-footer"
                      onClick={handleSearchSubmit}
                    >
                      View all results for &quot;{searchQuery}&quot; →
                    </div>
                  </>
                ) : (
                  !isSearching && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
                      <div style={{ fontSize: 28, marginBottom: 4 }}>🔎</div>
                      <div className="strong" style={{ fontSize: 14 }}>No products found</div>
                      <div className="tiny muted mt8">Try searching for plantain, yam, goat, gari, palm oil, or spices</div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Links */}
          <nav className="nav-links">
            <Link href="/stores" className="nav-link">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="lbl">Stores</span>
            </Link>

            {accountLink}

            <Link href="/cart" className="nav-link cart-btn" aria-label="Cart">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 4h2l2.4 11h10.2L20 7H6.2" />
                <circle cx="9" cy="20" r="1" />
                <circle cx="18" cy="20" r="1" />
              </svg>
              <span className="lbl">Cart</span>
              {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile-dedicated search bar */}
      <div className="mobile-search-bar no-print" ref={mobileWrapperRef}>
        <div style={{ position: 'relative' }}>
          <form className="search" onSubmit={handleSearchSubmit} role="search" style={{ display: 'block', width: '100%', margin: 0 }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              name="q-mobile"
              placeholder="Search plantains, palm oil, goat meat…"
              aria-label="Search products mobile"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setIsDropdownOpen(true);
              }}
            />
          </form>

          {/* Mobile Dropdown */}
          {isDropdownOpen && searchQuery.trim().length > 0 && (
            <div className="live-search-dropdown" style={{ top: '100%' }}>
              <div className="live-search-header">
                <span>{isSearching ? 'Searching...' : `Found ${results.length} item${results.length === 1 ? '' : 's'}`}</span>
                <button
                  type="button"
                  style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 13 }}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  ✕
                </button>
              </div>

              {results.length > 0 ? (
                <>
                  {results.map((product) => (
                    <div
                      key={product.id}
                      className="live-search-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelectProduct(product)}
                    >
                      <div className="live-search-thumb">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} />
                        ) : (
                          <span>{product.emoji || '🛒'}</span>
                        )}
                      </div>

                      <div className="live-search-info">
                        <div className="title">{product.name}</div>
                        <div className="sub">
                          <span>{product.stores?.name || 'Local Store'}</span>
                          <span>·</span>
                          <span className="muted">{product.unit || '1 lb'}</span>
                        </div>
                      </div>

                      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                        <span className="live-search-price">
                          ${((product.price_cents || 0) / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-gold"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              ...product,
                              stores: product.stores || {
                                id: product.store_id,
                                name: 'Local Store',
                              },
                            });
                          }}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}

                  <div
                    className="live-search-footer"
                    onClick={handleSearchSubmit}
                  >
                    View all results for &quot;{searchQuery}&quot; →
                  </div>
                </>
              ) : (
                !isSearching && (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🔎</div>
                    <div className="strong" style={{ fontSize: 13 }}>No products found</div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
