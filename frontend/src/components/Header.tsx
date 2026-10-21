'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const accountLink = user ? (
    user.role === 'customer' ? (
      <Link href="/account" className="nav-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="lbl">{user.name?.split(' ')[0] || 'Account'}</span>
      </Link>
    ) : (
      <Link href={`/${user.role}`} className="nav-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="lbl">My dashboard</span>
      </Link>
    )
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

          {/* Search bar */}
          <form className="search" onSubmit={handleSearch} role="search">
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
            />
          </form>

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
    </>
  );
}
