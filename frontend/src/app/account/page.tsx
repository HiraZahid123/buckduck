'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      setNameInput(user.name || '');
      setPhoneInput(user.phone || '');
      loadOrders();
    }
  }, [user, authLoading]);

  const loadOrders = async () => {
    const token = localStorage.getItem('bd_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/orders/my-orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  const activeOrders = orders.filter(
    (o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)
  );
  const pastOrders = orders.filter((o) =>
    ['delivered', 'cancelled', 'refunded'].includes(o.status)
  );

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
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
    const s = map[status] || { label: status, cls: 'b-gray' };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const formatMoney = (cents: number) => `$${((cents || 0) / 100).toFixed(2)}`;

  const renderOrderRow = (o: any) => {
    const storeEmoji = o.stores?.emoji || '🛒';
    const storeColor = o.stores?.color || '#0B1F4B';
    const storeName = o.stores?.name || 'Local Store';
    const winText = o.delivery_windows?.label || 'Saturday · 12 PM–4 PM';
    const itemCount = o.order_items?.length || 1;

    return (
      <Link
        key={o.id}
        href={`/order/${o.id}`}
        className="card flat row between"
        style={{
          color: 'inherit',
          textDecoration: 'none',
          marginBottom: 10,
          cursor: 'pointer',
        }}
      >
        <div className="row" style={{ gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: storeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {storeEmoji}
          </div>
          <div>
            <div className="strong">
              {storeName}{' '}
              <span className="muted tiny">
                {o.number || `BD-${10000 + o.id}`}
              </span>
            </div>
            <div className="small muted">
              {winText} · {itemCount} item{itemCount > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          {getStatusBadge(o.status)}
          <span className="strong num" style={{ fontSize: 16 }}>
            {formatMoney(o.total_cents)}
          </span>
        </div>
      </Link>
    );
  };

  if (!user && !authLoading) {
    return (
      <div className="container section center" style={{ padding: '80px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2>Sign In Required</h2>
        <p className="muted">Please sign in to view your orders and account settings.</p>
        <Link href="/login" className="btn btn-primary mt16">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="container section">
      {/* Top Profile Bar */}
      <div className="row between wrap mb24">
        <div>
          <h1 className="display mb0">
            Hi, {user?.name?.split(' ')[0] || 'Customer'}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {user?.email || 'customer@buckduck.com'}
          </p>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setIsEditProfileOpen(true)}
          >
            Edit profile
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Upcoming deliveries */}
      <h3 className="mt24 mb16">Upcoming deliveries</h3>
      {loading ? (
        <div className="card flat muted center" style={{ padding: 32 }}>
          <div className="spin" style={{ margin: '0 auto 8px' }} />
          Loading deliveries...
        </div>
      ) : activeOrders.length > 0 ? (
        activeOrders.map(renderOrderRow)
      ) : (
        <div className="card flat muted" style={{ padding: 24 }}>
          No upcoming deliveries.{' '}
          <Link href="/stores" style={{ color: 'var(--blue-700)' }}>
            Start shopping →
          </Link>
        </div>
      )}

      {/* Past orders */}
      <h3 className="mt32 mb16">Past orders</h3>
      {!loading && pastOrders.length > 0 ? (
        pastOrders.map(renderOrderRow)
      ) : (
        <div className="muted small">No past orders yet.</div>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-h">
              <h3>Edit profile</h3>
              <button
                className="icon-btn"
                onClick={() => setIsEditProfileOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-b stack">
              <label className="field">
                Name
                <input
                  className="input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                Phone
                <input
                  className="input"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="(301) 555-0101"
                />
              </label>
            </div>

            <div className="modal-f">
              <button
                className="btn btn-ghost"
                onClick={() => setIsEditProfileOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  alert('Profile updated');
                  setIsEditProfileOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
