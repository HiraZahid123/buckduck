'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const { user } = useAuth();
  const { clearCart } = useCart();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      try {
        const token = localStorage.getItem('bd_token');
        const res = await fetch(`/api/orders/${orderId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
          // Payment successful / order confirmed - clear cart now
          try { clearCart(); } catch {}
        }
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    }
    if (orderId) loadOrder();
  }, [orderId]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order? You will receive a full refund to your original payment method.')) return;
    setCancelling(true);
    try {
      const token = localStorage.getItem('bd_token');
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setOrder({ ...order, status: 'cancelled' });
      }
    } catch {
      alert('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const formatMoney = (cents: number) => `$${((cents || 0) / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="container section center" style={{ padding: '80px 20px' }}>
        <div className="spin" style={{ margin: '0 auto 12px' }} />
        <p className="muted">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container section center" style={{ padding: '80px 20px' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🦆</div>
        <h2>Order Not Found</h2>
        <p className="muted">Unable to retrieve order #{orderId}.</p>
        <Link href="/account" className="btn btn-primary mt16">
          View all orders
        </Link>
      </div>
    );
  }

  const flow = ['placed', 'accepted', 'packing', 'ready', 'picked_up', 'delivered'];
  const statusNormalized = order.status === 'out_for_delivery' ? 'picked_up' : order.status;
  const currentIdx = flow.indexOf(statusNormalized);

  const statusBadgeMap: Record<string, { label: string; cls: string }> = {
    placed: { label: 'Placed', cls: 'b-gold' },
    accepted: { label: 'Accepted', cls: 'b-blue' },
    packing: { label: 'Packing', cls: 'b-blue' },
    ready: { label: 'Ready for pickup', cls: 'b-gold' },
    picked_up: { label: 'Out for delivery', cls: 'b-blue' },
    out_for_delivery: { label: 'Out for delivery', cls: 'b-blue' },
    delivered: { label: 'Delivered', cls: 'b-green' },
    cancelled: { label: 'Cancelled', cls: 'b-red' },
    refunded: { label: 'Refunded', cls: 'b-gray' },
  };
  const badgeInfo = statusBadgeMap[order.status] || { label: order.status, cls: 'b-gray' };

  const storeName = order.stores?.name || 'Accra Market';
  const windowLabel = order.delivery_windows?.label || 'Saturday, Feb 21 · 12:00 PM – 4:00 PM';
  const orderNumber = order.number || `BD-${10000 + order.id}`;

  const customerDisplayName = (() => {
    const rawName = order.users_orders_customer_idTousers?.name || user?.name;
    if (!rawName) return 'Customer';
    const parts = rawName.trim().split(/\s+/);
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
  })();

  const renderInvoiceCard = (isPrint: boolean = false) => (
    <div
      className={isPrint ? 'print-invoice-sheet' : 'doordash-invoice-card'}
      style={
        isPrint
          ? {
              background: '#FFFFFF',
              color: '#0F172A',
              width: '100%',
              maxWidth: '100%',
              margin: '0 auto',
              padding: '0',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }
          : {
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 680,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              border: '1px solid #E2E8F0',
            }
      }
    >
      {/* Top Red & Navy DoorDash-style Brand Bar */}
      <div
        style={{
          background: 'linear-gradient(90deg, #EB1700 0%, #D4A017 50%, #0B1F4B 100%)',
          height: isPrint ? 4 : 6,
          borderTopLeftRadius: isPrint ? 0 : 16,
          borderTopRightRadius: isPrint ? 0 : 16,
        }}
      />

      <div style={{ padding: isPrint ? '16px 0 24px 0' : '28px 32px' }}>
        {/* Invoice Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 28 }}>🦆</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  BuckDuck <span style={{ color: '#D4A017' }}>StoreFront USA</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Official Grocery Delivery Invoice & Receipt
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                background: '#DCFCE7',
                color: '#15803D',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-block',
                marginBottom: 4,
              }}
            >
              ✓ PAID IN FULL
            </span>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
              Invoice #{orderNumber}
            </div>
            <div className="tiny muted" style={{ fontSize: 11, color: '#64748B' }}>
              {new Date(order.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* Store & Customer Dual Column (DoorDash precedence) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '16px 0', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Merchant Partner
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>
              {order.stores?.emoji || '🏪'} {storeName}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
              {order.stores?.address || '8401 Colesville Rd'}
            </div>
            <div style={{ fontSize: 13, color: '#475569' }}>
              {order.stores?.city || 'Silver Spring'}, {order.stores?.state || 'MD'} {order.stores?.zip || '20910'}
            </div>
            {order.stores?.phone && (
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                📞 {order.stores.phone}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Customer Deliver To
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>
              {customerDisplayName}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
              {order.address_line1} {order.address_line2 || ''}
            </div>
            <div style={{ fontSize: 13, color: '#475569' }}>
              {order.city}, {order.state} {order.zip}
            </div>
            <div style={{ fontSize: 12, color: '#0284C7', fontWeight: 600, marginTop: 4 }}>
              🗓️ {windowLabel}
            </div>
          </div>
        </div>

        {/* Itemized Products Table */}
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Itemized Grocery Summary ({order.order_items?.length || 0} items)
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 0' }}>Item</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Unit</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '6px 0', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items?.map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '8px 0', fontWeight: 600, color: '#0F172A' }}>
                    <span style={{ marginRight: 6 }}>{item.products?.emoji || item.emoji || '🛒'}</span>
                    {item.products?.name || item.name}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'center', color: '#64748B', fontSize: 12 }}>
                    {item.products?.unit || item.unit || '1 unit'}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>
                    {item.qty}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#64748B' }}>
                    {formatMoney(item.price_cents)}
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                    {formatMoney(item.price_cents * item.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Ledger (DoorDash Breakdown) */}
        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 18px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#475569' }}>
            <span>Merchandise Subtotal</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatMoney(order.subtotal_cents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#475569' }}>
            <span>Batched Saturday Delivery Fee</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatMoney(order.delivery_fee_cents || 599)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#475569' }}>
            <span>Packaging & Service Fee (5%)</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatMoney(order.service_fee_cents || 150)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#475569' }}>
            <span>Estimated Groceries Sales Tax</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatMoney(order.tax_cents || 0)} (Exempt)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10, color: '#475569' }}>
            <span>Driver Tip (100% to Driver)</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatMoney(order.tip_cents || 300)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: 10,
              borderTop: '2px solid #CBD5E1',
              fontSize: 15,
              fontWeight: 900,
              color: '#0B1F4B',
            }}
          >
            <span>Total Amount Paid</span>
            <span style={{ fontSize: 17, color: '#0B1F4B' }}>{formatMoney(order.total_cents)}</span>
          </div>
        </div>

        {/* Payment Processing Footnote */}
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFFFFF', borderRadius: 8, border: '1px dashed #CBD5E1', fontSize: 11, color: '#64748B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div>
            <strong>Payment Processed by Stripe:</strong> Credit / Debit Card · Direct Merchant Settlement (Zero Escrow)
          </div>
          <div style={{ fontWeight: 700, color: '#0B1F4B' }}>
            🔒 3D-Secure Authenticated
          </div>
        </div>

        {!isPrint && (
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowInvoiceModal(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.print()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0B1F4B', fontWeight: 700 }}
            >
              <span>🖨️</span>
              <span>Print / Save PDF</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="container section no-print">
      {/* Top Bar */}
      <div className="row between wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="row wrap" style={{ gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <Link href="/account" className="small" style={{ color: 'var(--blue-700)', fontWeight: 600 }}>
              ← All orders
            </Link>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <Link
              href={order.stores?.slug ? `/stores/${order.stores.slug}` : '/stores'}
              className="small"
              style={{ color: 'var(--navy-900)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              🏪 Back to {storeName}
            </Link>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <Link href="/stores" className="small" style={{ color: 'var(--muted)', fontWeight: 500 }}>
              Browse Stores
            </Link>
          </div>
          <h1 className="display mt8 mb0" style={{ fontSize: 'clamp(24px, 6vw, 36px)', wordBreak: 'break-word' }}>
            Order {orderNumber}
          </h1>
          <div className="muted small mt8">
            {storeName} · placed {new Date(order.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
        </div>

        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ border: '1px solid var(--line)', background: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowInvoiceModal(true)}
            title="View grocery tax invoice"
          >
            <span>🧾</span>
            <span>View Invoice</span>
          </button>
          <span className={`badge ${badgeInfo.cls}`} style={{ fontSize: 13, padding: '4px 12px', flexShrink: 0 }}>
            {badgeInfo.label}
          </span>
        </div>
      </div>

      <div className="layout-2 mt24">
        {/* Left column: Timeline & Items */}
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="row between">
              <div>
                <div className="tiny muted strong">DELIVERY WINDOW</div>
                <div className="display" style={{ fontSize: 22 }}>
                  {windowLabel}
                </div>
              </div>
              <div style={{ fontSize: 40 }}>
                {order.status === 'delivered' ? '✅' : order.status === 'picked_up' || order.status === 'out_for_delivery' ? '🚚' : '🛍️'}
              </div>
            </div>

            {/* Stepper progress bar */}
            {currentIdx >= 0 && (
              <div className="progress-steps" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                {flow.map((_, i) => (
                  <div key={i} className={i <= currentIdx ? 'on' : ''} />
                ))}
              </div>
            )}

            {/* Event Timeline */}
            <div className="timeline mt16">
              <div className="ev done">
                <div className="strong">Order placed</div>
                <div className="tiny muted">
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Payment authorized
                </div>
              </div>

              {(order.status === 'accepted' || currentIdx >= 1) && (
                <div className={`ev ${currentIdx > 1 ? 'done' : 'cur'}`}>
                  <div className="strong">Accepted by store</div>
                  <div className="tiny muted">{storeName} confirmed inventory</div>
                </div>
              )}

              {(order.status === 'packing' || currentIdx >= 2) && (
                <div className={`ev ${currentIdx > 2 ? 'done' : 'cur'}`}>
                  <div className="strong">Packing in BuckDuck bags</div>
                  <div className="tiny muted">Sealed in {order.bags || 1} BuckDuck bag(s)</div>
                </div>
              )}

              {(order.status === 'ready' || currentIdx >= 3) && (
                <div className={`ev ${currentIdx > 3 ? 'done' : 'cur'}`}>
                  <div className="strong">Ready for driver pickup</div>
                  <div className="tiny muted">Awaiting assigned route pickup</div>
                </div>
              )}

              {(order.status === 'picked_up' || order.status === 'out_for_delivery' || currentIdx >= 4) && (
                <div className={`ev ${currentIdx > 4 ? 'done' : 'cur'}`}>
                  <div className="strong">Out for delivery</div>
                  <div className="tiny muted">On the road to your address</div>
                </div>
              )}

              {order.status === 'delivered' && (
                <div className="ev done">
                  <div className="strong">Delivered</div>
                  <div className="tiny muted">
                    Left safely at front door · Drop-off photo confirmed
                  </div>
                </div>
              )}

              {order.status === 'cancelled' && (
                <div className="ev done" style={{ color: 'var(--red)' }}>
                  <div className="strong">Cancelled & Refunded</div>
                  <div className="tiny muted">Full refund credited to payment method</div>
                </div>
              )}
            </div>

            {/* Driver Assignment Alert */}
            {order.driver_id && ['ready', 'picked_up', 'out_for_delivery', 'delivered'].includes(order.status) && (
              <div className="alert info mt16">
                🚚 <span>Your driver is <b>{order.users_orders_driver_idTousers?.name || 'Kwame Asante'}</b> · {order.users_orders_driver_idTousers?.vehicle || 'Toyota Sienna · Silver'}</span>
              </div>
            )}

            {/* Cancel Button */}
            {order.status === 'placed' && (
              <button
                className="btn btn-danger btn-sm mt16"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? 'Cancelling...' : 'Cancel order'}
              </button>
            )}
          </div>

          {/* Items Card */}
          <div className="card">
            <h3>Items ({order.order_items?.length || 0})</h3>
            {(order.order_items || []).map((item: any) => (
              <div
                key={item.id}
                className="row"
                style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}
              >
                <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>
                  {item.products?.emoji || '🛒'}
                </span>
                <div className="grow">
                  <div className="strong">{item.products?.name || item.name}</div>
                  <div className="tiny muted">{item.products?.unit || '1 lb'}</div>
                </div>
                <span className="muted small">×{item.qty}</span>
                <span className="num strong" style={{ width: 80, textAlign: 'right' }}>
                  {formatMoney(item.price_cents * item.qty)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Sticky Receipt */}
        <div className="card sticky">
          <h3>Receipt</h3>
          <div className="summary-line">
            <span>Items</span>
            <span>{formatMoney(order.subtotal_cents)}</span>
          </div>
          <div className="summary-line">
            <span>Delivery</span>
            <span>{formatMoney(order.delivery_fee_cents || 599)}</span>
          </div>
          <div className="summary-line">
            <span>Service fee</span>
            <span>{formatMoney(order.service_fee_cents || 150)}</span>
          </div>
          {order.tax_cents > 0 && (
            <div className="summary-line">
              <span>Tax</span>
              <span>{formatMoney(order.tax_cents)}</span>
            </div>
          )}
          <div className="summary-line">
            <span>Driver tip</span>
            <span>{formatMoney(order.tip_cents || 300)}</span>
          </div>
          <div className="summary-line total">
            <span>Total</span>
            <span>{formatMoney(order.total_cents)}</span>
          </div>

          <div className="small muted mt8">
            Paid with {order.payment_method || 'Card (ending 4242)'}
          </div>

          <div className="mt16 small">
            <div className="strong" style={{ marginBottom: 4 }}>Deliver to</div>
            <div className="strong" style={{ color: 'var(--navy-950)', marginBottom: 2 }}>
              {(() => {
                const rawName = order.users_orders_customer_idTousers?.name || user?.name;
                if (!rawName) return 'Customer';
                const parts = rawName.trim().split(/\s+/);
                return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
              })()}
            </div>
            <div>{order.address_line1}</div>
            {order.address_line2 && <div>{order.address_line2}</div>}
            <div className="muted">{order.city}, {order.state} {order.zip}</div>
          </div>

          <div className="mt16">
            <span className="bag-tag">
              🛍️ {order.bags || 1} BuckDuck bag{(order.bags || 1) > 1 ? 's' : ''}
            </span>
          </div>

          <div className="mt16 stack" style={{ gap: 8 }}>
            <Link
              href={order.stores?.slug ? `/stores/${order.stores.slug}` : '/stores'}
              className="btn btn-secondary btn-block btn-sm"
              style={{ textAlign: 'center', textDecoration: 'none', fontWeight: 600 }}
            >
              🏪 Back to {storeName}
            </Link>
            <button
              type="button"
              className="btn btn-gold btn-block btn-sm"
              onClick={() => setShowInvoiceModal(true)}
              style={{ fontWeight: 700 }}
            >
              📄 Invoice
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block btn-sm"
              onClick={() => window.print()}
            >
              🖨️ Print Receipt
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* DOORDASH-STYLE INVOICE MODAL (ON-SCREEN) */}
      {showInvoiceModal && (
        <div
          className="modal-backdrop no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInvoiceModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          {renderInvoiceCard(false)}
        </div>
      )}

      {/* DEDICATED PRINTABLE RECEIPT: ALWAYS PRESENT IN DOM, CLEAN SINGLE-PAGE LAYOUT */}
      <div id="print-area">
        {renderInvoiceCard(true)}
      </div>

      {/* Print Stylesheet */}
      <style jsx global>{`
        #print-area {
          display: none;
        }

        @media print {
          @page {
            size: auto;
            margin: 10mm 15mm;
          }
          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          /* Hide all screen interactive elements, headers, footers, and modal backdrops */
          .no-print,
          .modal-backdrop,
          header,
          footer,
          nav,
          .site-header {
            display: none !important;
          }
          /* Display only the dedicated printable invoice starting at the very top of page 1 */
          #print-area {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: avoid;
            break-after: avoid;
          }
          #print-area * {
            visibility: visible !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </>
  );
}
