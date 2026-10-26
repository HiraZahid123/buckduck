'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

export default function CartCheckoutPage() {
  const router = useRouter();
  const { user, demoLogin } = useAuth();
  const {
    items,
    updateQty,
    removeFromCart,
    clearCart,
    subtotalCents,
    deliveryFeeCents,
    serviceFeeCents,
    storeCount,
    storesGrouped,
  } = useCart();

  const [windows, setWindows] = useState<any[]>([]);
  const [selectedWindowId, setSelectedWindowId] = useState<number | null>(null);
  const [tipCents, setTipCents] = useState<number>(500); // default $5.00 tip
  const [addressLine1, setAddressLine1] = useState('123 Georgia Ave');
  const [city, setCity] = useState('Silver Spring');
  const [state, setState] = useState('MD');
  const [zip, setZip] = useState('20910');
  const [phone, setPhone] = useState('(301) 555-0199');
  const [notes, setNotes] = useState('Leave on the front porch');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [minSubtotalCents, setMinSubtotalCents] = useState(1500);
  const [differentAddress, setDifferentAddress] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [saveInfo, setSaveInfo] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [res, setRes] = await Promise.all([
          fetch('/api/windows'),
          fetch('/api/settings').catch(() => null),
        ]);
        if (res.ok) {
          const data = await res.json();
          setWindows(data);
          if (data.length > 0) setSelectedWindowId(data[0].id);
        }
        if (setRes && setRes.ok) {
          const st = await setRes.json();
          if (st.minimum_delivery_subtotal_cents) {
            setMinSubtotalCents(Number(st.minimum_delivery_subtotal_cents) || 1500);
          }
        }
      } catch (err) {
        console.error('Failed to load windows/settings', err);
      }

      try {
        const saved = localStorage.getItem('bd_saved_profile');
        if (saved) {
          const p = JSON.parse(saved);
          if (p.addressLine1) setAddressLine1(p.addressLine1);
          if (p.city) setCity(p.city);
          if (p.state) setState(p.state);
          if (p.zip) setZip(p.zip);
          if (p.phone) setPhone(p.phone);
        }
      } catch {}
    }
    loadData();
  }, []);

  const totalCents = subtotalCents + deliveryFeeCents + serviceFeeCents + tipCents;

  const handleCheckout = async (paymentMethod: string = 'stripe_checkout') => {
    setErrorMsg('');

    if (items.length === 0) {
      setErrorMsg('Your cart is empty');
      return;
    }

    if (subtotalCents < minSubtotalCents) {
      setErrorMsg(`Minimum merchandise subtotal is $${(minSubtotalCents / 100).toFixed(2)} before checkout`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!selectedWindowId) {
      setErrorMsg('Please select a Saturday delivery window');
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    if (!addressLine1 || !zip || !phone) {
      setErrorMsg('Please enter your delivery street address, ZIP code, and phone number');
      window.scrollTo({ top: 280, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      // Auto-login as demo customer if not logged in
      let authToken = localStorage.getItem('bd_token');
      if (!authToken || !user) {
        try {
          await demoLogin('customer');
          authToken = localStorage.getItem('bd_token');
        } catch {
          // proceed
        }
      }

      const finalNotes = differentAddress && recipientName
        ? `Deliver to: ${recipientName}${recipientPhone ? ` (${recipientPhone})` : ''}. Notes: ${notes}`
        : notes;

      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.product.id, qty: i.qty })),
          windowId: selectedWindowId,
          tipCents,
          addressLine1,
          city,
          state,
          zip,
          phone,
          notes: finalNotes,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Checkout failed');
      }

      if (saveInfo) {
        try {
          localStorage.setItem(
            'bd_saved_profile',
            JSON.stringify({ addressLine1, city, state, zip, phone })
          );
        } catch {}
      }

      const result = await res.json();
      clearCart();

      // If backend generated an official Stripe Hosted Checkout URL (checkout.stripe.com)
      if (result.url && result.url.startsWith('http')) {
        window.location.href = result.url;
      } else {
        const firstOrderId = result.orderId || result.orders?.[0]?.id || 1;
        router.push(result.url || `/order/${firstOrderId}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment processing failed');
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
        <h2>Your Cart is Empty</h2>
        <p className="muted">Discover authentic foods from African, Caribbean and halal grocers.</p>
        <Link href="/stores" className="btn btn-primary" style={{ marginTop: 16 }}>
          Shop Partner Stores
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '36px 20px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Single-Cart Multi-Store Checkout</h1>

      {errorMsg && (
        <div className="card" style={{ background: 'var(--red-bg)', color: 'var(--red)', marginBottom: 20 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="layout-2">
        {/* Left Column: Stores & Cart Items, Window selection, Address */}
        <div className="stack" style={{ gap: 24 }}>
          {/* Grouped by Store */}
          <div>
            <h3 style={{ marginBottom: 12 }}>Items in Your Order ({storeCount} Stores)</h3>
            <div className="stack" style={{ gap: 16 }}>
              {Object.values(storesGrouped).map((group: any) => (
                <div key={group.store.id} className="card">
                  <div className="row between wrap" style={{ marginBottom: 12, borderBottom: '1px solid var(--line)', paddingBottom: 10, gap: 10 }}>
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 24, flexShrink: 0 }}>{group.store.emoji || '🏪'}</span>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 16 }}>{group.store.name}</strong>
                        <div className="tiny muted">
                          Sealed BuckDuck Packaging · Est. {group.bags} Bag(s)
                        </div>
                      </div>
                    </div>
                    <span className="badge b-gold" style={{ flexShrink: 0, alignSelf: 'center' }}>
                      ${(group.subtotal / 100).toFixed(2)} Subtotal
                    </span>
                  </div>

                  {/* Items for this store */}
                  <div className="stack" style={{ gap: 10 }}>
                    {group.items.map((it: any) => (
                      <div key={it.product.id} className="row between cart-item-row">
                        <div className="row cart-item-info" style={{ gap: 10, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 24, flexShrink: 0 }}>{it.product.emoji || '🛒'}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{it.product.name}</div>
                            <div className="tiny muted">
                              ${(it.product.price_cents / 100).toFixed(2)} / {it.product.unit || 'unit'}
                            </div>
                          </div>
                        </div>

                        <div className="row cart-item-actions" style={{ gap: 12 }}>
                          <div className="stepper" style={{ height: 32 }}>
                            <button onClick={() => updateQty(it.product.id, it.qty - 1)}>-</button>
                            <span>{it.qty}</span>
                            <button onClick={() => updateQty(it.product.id, it.qty + 1)}>+</button>
                          </div>
                          <span style={{ fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                            ${((it.product.price_cents * it.qty) / 100).toFixed(2)}
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--red)', padding: '2px 8px' }}
                            onClick={() => removeFromCart(it.product.id)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saturday Delivery Window Selection */}
          <div className="card">
            <h3>Choose Saturday Delivery Window</h3>
            <p className="tiny muted" style={{ marginBottom: 14 }}>
              Deliveries happen every Saturday. Ordering closes 24h prior.
            </p>

            <div className="grid g2">
              {windows.map((w) => {
                const isSelected = selectedWindowId === w.id;
                return (
                  <div
                    key={w.id}
                    className={`window-opt ${isSelected ? 'sel' : ''}`}
                    onClick={() => setSelectedWindowId(w.id)}
                  >
                    <div className="day">
                      <small>SAT</small>
                      <b>{w.date ? w.date.split('-')[2] : '24'}</b>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{w.label}</div>
                      <div className="tiny muted">
                        {w.remaining} spots remaining ({w.booked}/{w.capacity} booked)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Address & Contact */}
          <div className="card">
            <h3>Delivery Address & Contact</h3>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="span4">
                <label className="field">
                  Street Address
                  <input
                    className="input"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                </label>
              </div>
              <div className="span2">
                <label className="field">
                  ZIP Code
                  <input
                    className="input"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                  />
                </label>
              </div>
              <div className="span3">
                <label className="field">
                  City
                  <input
                    className="input"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </label>
              </div>
              <div className="span3">
                <label className="field">
                  Phone Number
                  <input
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              </div>
              <div className="span6">
                <label className="field">
                  Driver Drop-off Notes (Gate code, porch, etc.)
                  <input
                    className="input"
                    placeholder="e.g. Leave on the front porch, gate code #1234"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                
                {/* 1-Tap Quick Delivery Instruction Chips */}
                <div style={{ marginTop: 8 }}>
                  <div className="tiny muted strong" style={{ marginBottom: 6 }}>Quick instructions (select one):</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { emoji: '🚪', text: 'Leave at front door' },
                      { emoji: '📦', text: 'Leave on the front porch' },
                      { emoji: '🔔', text: 'Ring doorbell upon arrival' },
                      { emoji: '🏢', text: 'Leave with concierge' },
                      { emoji: '📞', text: 'Call me upon arrival' },
                    ].map((chip) => {
                      const isActive = notes === chip.text;
                      return (
                        <button
                          key={chip.text}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              setNotes('');
                            } else {
                              setNotes(chip.text);
                            }
                          }}
                          style={{
                            background: isActive ? 'var(--navy-950, #0B1F4B)' : '#F1F5F9',
                            color: isActive ? '#FFFFFF' : 'var(--ink, #0B1F4B)',
                            border: `1.5px solid ${isActive ? 'var(--navy-950, #0B1F4B)' : '#E2E8F0'}`,
                            borderRadius: 16,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{chip.emoji}</span>
                          <span>{chip.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save info checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={saveInfo}
                    onChange={(e) => setSaveInfo(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--navy-900)' }}
                  />
                  <span>Save my contact and address details for future orders</span>
                </label>

                {/* Different address toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={differentAddress}
                    onChange={(e) => setDifferentAddress(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--navy-900)' }}
                  />
                  <span><strong>Deliver to a different person or gift recipient</strong></span>
                </label>

                {differentAddress && (
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                    <div className="small strong" style={{ marginBottom: 8, color: 'var(--navy-950)' }}>
                      🎁 Recipient Contact Details
                    </div>
                    <div className="form-grid" style={{ gap: 8 }}>
                      <div className="span3">
                        <label className="field" style={{ fontSize: 12 }}>
                          Recipient Full Name
                          <input
                            className="input"
                            placeholder="e.g. Ama Mensah"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="span3">
                        <label className="field" style={{ fontSize: 12 }}>
                          Recipient Phone Number
                          <input
                            className="input"
                            placeholder="e.g. (240) 555-0188"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Driver Tip Selection */}
          <div className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3>Driver Tip</h3>
              <span className="tiny muted">100% of tip goes directly to your driver</span>
            </div>
            <div className="tip-chips">
              {[
                { label: 'None', val: 0 },
                { label: '$3.00', val: 300 },
                { label: '$5.00', val: 500 },
                { label: '$8.00', val: 800 },
                { label: '$10.00', val: 1000 },
                { label: '$20.00', val: 2000 },
              ].map((t) => (
                <button
                  key={t.val}
                  className={`chip ${tipCents === t.val ? 'active' : ''}`}
                  onClick={() => setTipCents(t.val)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Order Summary & Payment */}
        <div className="sticky">
          <div className="card">
            <h3>Order Summary</h3>

            <div className="summary-line">
              <span>Groceries Subtotal ({storeCount} Stores)</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>

            <div className="summary-line">
              <span>
                Delivery Fee ({storeCount} × $5.99)
                <span className="tiny muted" style={{ display: 'block' }}>
                  Batched Saturday Route
                </span>
              </span>
              <span>${(deliveryFeeCents / 100).toFixed(2)}</span>
            </div>

            <div className="summary-line">
              <span>Service Fee (5%, min $1.99)</span>
              <span>${(serviceFeeCents / 100).toFixed(2)}</span>
            </div>

            <div className="summary-line">
              <span>Estimated Tax (Groceries)</span>
              <span>$0.00</span>
            </div>

            <div className="summary-line">
              <span>Driver Tip</span>
              <span>${(tipCents / 100).toFixed(2)}</span>
            </div>

            <div className="summary-line total">
              <span>Total Charge</span>
              <span style={{ color: 'var(--navy-900)' }}>${(totalCents / 100).toFixed(2)}</span>
            </div>

            {/* Stripe Payment Checkout */}
            <div style={{ marginTop: 20 }}>
              {/* Express Wallets */}
              <div className="pay-wallets">
                <button
                  type="button"
                  className="wallet apple"
                  disabled={submitting}
                  onClick={() => handleCheckout('apple_pay')}
                  title="Pay with Apple Pay via Stripe"
                >
                   Pay
                </button>
                <button
                  type="button"
                  className="wallet google"
                  disabled={submitting}
                  onClick={() => handleCheckout('google_pay')}
                  title="Pay with Google Pay via Stripe"
                >
                  G Pay
                </button>
              </div>

              <div className="divider">or proceed to stripe checkout</div>

              {/* Stripe Hosted Checkout Primary Button */}
              <button
                type="button"
                className="btn btn-gold btn-block btn-lg"
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  fontWeight: 700,
                  fontSize: 16,
                  minHeight: 48,
                  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.25)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
                disabled={submitting}
                onClick={() => handleCheckout('stripe_checkout')}
              >
                {submitting ? (
                  <>
                    <span className="spin" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span>Connecting to Stripe...</span>
                  </>
                ) : (
                  <>
                    <span>Pay with Stripe Checkout</span>
                    <span style={{ opacity: 0.8 }}>·</span>
                    <span>${(totalCents / 100).toFixed(2)}</span>
                  </>
                )}
              </button>

              {/* Supported payment methods badges */}
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy-950)', marginBottom: 8 }}>
                  Guaranteed Safe & Secure Checkout via Stripe
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: '#FFFFFF', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#1E293B' }}>
                     Apple Pay
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: '#FFFFFF', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#1E293B' }}>
                    G Google Pay
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: '#FFFFFF', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#1A1F71' }}>
                    VISA
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: '#FFFFFF', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#EB001B' }}>
                    Mastercard
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: '#FFFFFF', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#006FCF' }}>
                    AMEX
                  </span>
                </div>
                <div className="tiny muted" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.4 }}>
                  🔒 256-bit encrypted · 3D-Secure enabled · Direct bank payout (No escrow)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
