'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';

export default function CartDrawer() {
  const router = useRouter();
  const {
    items,
    itemCount,
    subtotalCents,
    deliveryFeeCents,
    serviceFeeCents,
    storeCount,
    storesGrouped,
    updateQty,
    removeFromCart,
    isDrawerOpen,
    closeDrawer,
  } = useCart();

  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeDrawer();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  const totalCents = subtotalCents + deliveryFeeCents + serviceFeeCents;

  const handleCheckoutClick = () => {
    closeDrawer();
    router.push('/cart');
  };

  return (
    <div
      className="cart-drawer-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 31, 75, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDrawer();
      }}
    >
      <div
        ref={drawerRef}
        className="cart-drawer-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          color: 'var(--ink, #0B1F4B)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--navy-950, #06112a)',
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🛒</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, fontFamily: 'var(--font-fraunces, serif)' }}>
                Your Saturday Cart
              </div>
              <div className="tiny" style={{ opacity: 0.8, color: 'var(--gold-400, #F7E08B)' }}>
                {itemCount} item{itemCount === 1 ? '' : 's'} · {storeCount} store{storeCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 0,
              color: '#FFFFFF',
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
              transition: 'background 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Saturday Delivery Banner */}
        <div
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(90deg, #FDF8E2, #FFF)',
            borderBottom: '1px solid #F1E5B9',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: '#744210',
          }}
        >
          <span>🚚</span>
          <div>
            <b>Next Delivery: Saturday, Oct 24</b> · Multi-store orders arrive together
          </div>
        </div>

        {/* Drawer Body - Scrollable Items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 52 }}>🧺</div>
              <h3 style={{ margin: 0, fontSize: 20 }}>Your cart is empty</h3>
              <p className="muted small" style={{ margin: 0, maxWidth: 260 }}>
                Explore plantains, palm oil, fresh goat meat, and authentic staples from local markets.
              </p>
              <button
                type="button"
                className="btn btn-gold btn-sm"
                style={{ marginTop: 12 }}
                onClick={closeDrawer}
              >
                Start Shopping
              </button>
            </div>
          ) : (
            Object.values(storesGrouped).map((group: any) => (
              <div
                key={group.store.id}
                style={{
                  border: '1px solid var(--line, #e2e8f0)',
                  borderRadius: 12,
                  padding: '14px',
                  background: '#fafbfe',
                }}
              >
                {/* Store Header in Drawer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 10,
                    marginBottom: 10,
                    borderBottom: '1px solid var(--line, #e2e8f0)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{group.store.emoji || '🏪'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{group.store.name}</div>
                      <div className="tiny muted">
                        Sealed BuckDuck Packaging · {group.bags} Bag{group.bags > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <span className="badge b-gold" style={{ fontSize: 11 }}>
                    ${(group.subtotal / 100).toFixed(2)}
                  </span>
                </div>

                {/* Items in this Store */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {group.items.map((it: any) => (
                    <div
                      key={it.product.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {it.product.emoji || '🛒'}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {it.product.name}
                          </div>
                          <div className="tiny muted">
                            ${(it.product.price_cents / 100).toFixed(2)} / {it.product.unit || 'unit'}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div className="stepper" style={{ transform: 'scale(0.88)', transformOrigin: 'right' }}>
                          <button
                            type="button"
                            onClick={() => updateQty(it.product.id, it.qty - 1)}
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span>{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(it.product.id, it.qty + 1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(it.product.id)}
                          style={{
                            background: 'none',
                            border: 0,
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          aria-label="Remove item"
                          title="Remove item"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer - Price breakdown & Checkout */}
        {items.length > 0 && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--line, #e2e8f0)',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Subtotal</span>
                <strong>${(subtotalCents / 100).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">
                  Saturday Delivery ({storeCount} store{storeCount > 1 ? 's' : ''})
                </span>
                <span>${(deliveryFeeCents / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Service Fee</span>
                <span>${(serviceFeeCents / 100).toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px solid var(--line, #e2e8f0)',
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--navy-950, #0B1F4B)',
                }}
              >
                <span>Estimated Total</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-gold btn-block btn-lg"
              style={{ fontWeight: 800 }}
              onClick={handleCheckoutClick}
            >
              Proceed to Checkout →
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              onClick={closeDrawer}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
