'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

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

  return (
    <div className="container section">
      {/* Top Bar */}
      <div className="row between wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div>
          <Link href="/account" className="small" style={{ color: 'var(--blue-700)' }}>
            ← All orders
          </Link>
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

        <span className={`badge ${badgeInfo.cls}`} style={{ fontSize: 13, padding: '4px 12px', flexShrink: 0 }}>
          {badgeInfo.label}
        </span>
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
        </div>
      </div>
    </div>
  );
}
