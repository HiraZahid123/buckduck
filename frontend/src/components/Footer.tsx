import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer no-print">
      <div className="container">
        <div className="grid g4">
          <div>
            <Link href="/" className="logo">
              <svg viewBox="0 0 48 48" style={{ width: 38, height: 38 }}>
                <defs>
                  <linearGradient id="g-foot" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#F7E08B" />
                    <stop offset="0.45" stopColor="#D4A017" />
                    <stop offset="1" stopColor="#9E7410" />
                  </linearGradient>
                </defs>
                <rect width="48" height="48" rx="11" fill="#0B1F4B" />
                <path
                  d="M18 20v-3a6 6 0 0 1 12 0v3"
                  fill="none"
                  stroke="url(#g-foot)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M12.5 20h23l-2.1 17.4A3 3 0 0 1 30.4 40H17.6a3 3 0 0 1-3-2.6z"
                  fill="url(#g-foot)"
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
                <div className="wm" style={{ color: '#fff' }}>
                  Buck<b>Duck</b>
                </div>
                <span className="sub" style={{ color: 'rgba(255,255,255,.7)' }}>
                  STOREFRONT USA
                </span>
              </div>
            </Link>
            <p className="mt16 small" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 280 }}>
              BuckDuck connects neighborhood grocers with families through one dependable weekly delivery day.
            </p>
          </div>

          <div>
            <h4>Shop</h4>
            <div className="stack small" style={{ gap: 6 }}>
              <Link href="/stores">All stores</Link>
              <Link href="/account">Your orders</Link>
              <Link href="/cart">Cart</Link>
            </div>
          </div>

          <div>
            <h4>Partner</h4>
            <div className="stack small" style={{ gap: 6 }}>
              <Link href="/login">Sell on StoreFront USA</Link>
              <Link href="/login">Drive with BuckDuck</Link>
              <Link href="/login">Partner sign in</Link>
            </div>
          </div>

          <div>
            <h4>Secure checkout</h4>
            <p className="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Payments by Stripe. Card, Apple Pay and Google Pay accepted.
            </p>
          </div>
        </div>

        <div
          className="mt32 tiny"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 20,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          © 2026 BuckDuck Inc. · StoreFront USA marketplace
        </div>
      </div>
    </footer>
  );
}
