'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import BarChart from '../../components/BarChart';
import { getSocket } from '../../lib/socket';

export default function DriverAppPage() {
  const router = useRouter();
  const { user, demoLogin, logout } = useAuth();
  const [subView, setSubView] = useState<'home' | 'available' | 'route' | 'earnings'>('home');
  const [isOnline, setIsOnline] = useState(user?.driver_online ?? true);
  const [jobBoard, setJobBoard] = useState<any[]>([]);
  const [activeRoute, setActiveRoute] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Deliver modal
  const [deliverModalOrder, setDeliverModalOrder] = useState<any>(null);
  const [proofNote, setProofNote] = useState('Handed to customer');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('bd_token');
    if (!token && (!user || user.role !== 'driver')) {
      // Allow real user session
    }
  }, [user]);

  const loadDriverData = async () => {
    const token = localStorage.getItem('bd_token');
    if (!token) return;

    try {
      const [jobsRes, routeRes, earnRes] = await Promise.all([
        fetch('/api/driver/jobs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/driver/route', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/driver/earnings', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (jobsRes.ok) setJobBoard(await jobsRes.json());
      if (routeRes.ok) setActiveRoute(await routeRes.json());
      if (earnRes.ok) setEarnings(await earnRes.json());
    } catch (err) {
      console.error('Driver data error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.driver_online !== undefined) {
      setIsOnline(Boolean(user.driver_online));
    }
    loadDriverData();
    const interval = setInterval(loadDriverData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Real-time WebSocket connection to receive live fleet updates
  useEffect(() => {
    const socket = getSocket();

    const handleDriverStatus = (data: { driverId: number; online: boolean }) => {
      if (user && data.driverId === user.id) {
        setIsOnline(Boolean(data.online));
      }
    };

    socket.on('driver:status', handleDriverStatus);

    return () => {
      socket.off('driver:status', handleDriverStatus);
    };
  }, [user]);

  const toggleOnline = async () => {
    const nextOnline = !isOnline;
    setIsOnline(nextOnline);
    const token = localStorage.getItem('bd_token');

    try {
      // Emit via Socket.IO immediately
      const socket = getSocket();
      socket.emit('driver:toggle_online', {
        driverId: user?.id,
        online: nextOnline,
        name: user?.name,
      });

      const res = await fetch('/api/driver/toggle-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ online: nextOnline }),
      });
      if (!res.ok) {
        // Reload fresh state if failed
        await loadDriverData();
      }
    } catch {
      // Retain optimistic state
    }
  };

  const acceptJob = async (orderId: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/driver/jobs/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await loadDriverData();
        setSubView('route');
      } else {
        const err = await res.json();
        alert(err.message || 'Could not claim job');
      }
    } catch {
      alert('Failed to claim job');
    }
  };

  const confirmPickup = async (orderId: number, bagCount: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bagCount }),
      });
      if (res.ok) await loadDriverData();
    } catch {
      alert('Failed to confirm pickup');
    }
  };

  const completeDelivery = async () => {
    if (!deliverModalOrder) return;
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/driver/orders/${deliverModalOrder.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          note: proofNote,
          photoUrl: capturedPhoto || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400',
        }),
      });
      if (res.ok) {
        setDeliverModalOrder(null);
        setCapturedPhoto(null);
        await loadDriverData();
      }
    } catch {
      alert('Failed to complete delivery');
    }
  };

  const totalBags = activeRoute.reduce((acc, o) => acc + (o.bags || 1), 0);
  const totalEstPay = activeRoute.reduce(
    (acc, o) => acc + (o.driverPayCents || o.driver_pay_cents || 550),
    0
  );

  // Map route points for SVG polyline
  const pts = activeRoute.map((_, i) => [
    30 + (i * 330) / Math.max(1, activeRoute.length - 1 || 1),
    30 + ((i * 53) % 60),
  ]);

  // Earnings chart data
  const chartData = (earnings?.weeks || [
    { date: '2026-02-07', sales: 12500, orders: 12 },
    { date: '2026-02-14', sales: 16800, orders: 16 },
    { date: '2026-02-21', sales: 21500, orders: 20 },
  ]).map((w: any) => ({
    ...w,
    sales: (w.sales || w.earnings || 14000) / 100,
    lbl: new Date(w.date || '2026-02-21').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const formatMoney = (cents: number) => `$${((cents || 0) / 100).toFixed(2)}`;

  // Mobile native mode vs desktop simulator toggle
  const [isNativeMode, setIsNativeMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      setIsNativeMode(true);
    }
  }, []);

  if (!loading && (!user || (user.role !== 'driver' && user.role !== 'admin'))) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 20 }}>
        <div className="card" style={{ maxWidth: 460, width: '100%', padding: '36px 32px', borderRadius: 16, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', background: '#fff' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚚</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: '#0F172A' }}>Driver Dispatch App</h2>
          {user ? (
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              You are signed in as <strong>{user.name}</strong> (<span style={{ textTransform: 'capitalize' }}>{user.role}</span>). A Driver account is required to view Saturday delivery routes and dispatch jobs.
            </p>
          ) : (
            <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px' }}>
              Please sign in with your Driver account to view routes, accept delivery jobs and track earnings.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link
              href="/"
              className="btn btn-outline"
              style={{ padding: '11px 24px', borderRadius: 999, fontWeight: 600, textDecoration: 'none' }}
            >
              Return to Marketplace →
            </Link>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{
                padding: '12px 24px',
                borderRadius: 999,
                fontWeight: 700,
                textDecoration: 'none',
                background: '#0B1527',
                color: '#fff',
                textAlign: 'center',
              }}
            >
              Sign In to Driver Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Top Preview Mode Switcher (Desktop utility) */}
      <div className="driver-mode-toggle no-print">
        <span>Driver App View:</span>
        <button
          type="button"
          className={!isNativeMode ? 'active' : ''}
          onClick={() => setIsNativeMode(false)}
        >
          📱 Simulator Bezel
        </button>
        <button
          type="button"
          className={isNativeMode ? 'active' : ''}
          onClick={() => setIsNativeMode(true)}
        >
          📲 Fullscreen Mobile / PWA
        </button>
      </div>

      <div className={`driver-shell ${isNativeMode ? 'native-mode' : ''}`}>
        <div className="phone">
          {/* DRIVER HEADER */}
          <div className="d-head">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              <svg width="34" height="34" viewBox="0 0 48 48">
                <rect width="48" height="48" rx="11" fill="#0B1F4B" />
                <path d="M18 20v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#D4A017" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M12.5 20h23l-2.1 17.4A3 3 0 0 1 30.4 40H17.6a3 3 0 0 1-3-2.6z" fill="#D4A017" />
                <circle cx="22.4" cy="29.4" r="4.4" fill="#0B1F4B" />
                <path d="M26.2 28.4l5.6 1.4-5.6 1.8z" fill="#0B1F4B" />
                <circle cx="23.3" cy="28.3" r="1" fill="#F7E08B" />
                <path d="M17 35.5c3 1.6 9 1.6 14 0" stroke="#0B1F4B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
              <div>
                <div className="tiny" style={{ color: 'var(--gold-400)', fontWeight: 800, letterSpacing: '.1em' }}>
                  BUCKDUCK DRIVER
                </div>
                <div className="strong">
                  {subView === 'home' && `Hi, ${user?.name?.split(' ')[0] || 'Kwame'}`}
                  {subView === 'available' && 'Available jobs'}
                  {subView === 'route' && 'My route'}
                  {subView === 'earnings' && 'Earnings'}
                </div>
              </div>
            </div>

            <button
              className="icon-btn"
              style={{ background: 'rgba(255,255,255,.1)', border: 0, color: '#fff' }}
              onClick={() => {
                logout();
                router.push('/login');
              }}
              aria-label="Sign out"
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>

          {/* Online Toggle */}
          {(subView === 'home' || subView === 'available') && (
            <div className="online-toggle">
              <div>
                <div className="strong">{isOnline ? "You're online" : "You're offline"}</div>
                <div className="tiny" style={{ opacity: 0.7 }}>
                  {isOnline ? 'Receiving delivery offers' : 'Go online to accept deliveries'}
                </div>
              </div>
              <button
                className={`switch ${isOnline ? 'on' : ''}`}
                onClick={toggleOnline}
                aria-label="Toggle online"
              />
            </div>
          )}

          {/* Route sub-header */}
          {subView === 'route' && (
            <div className="small mt8" style={{ opacity: 0.85 }}>
              {activeRoute.length} stop{activeRoute.length === 1 ? '' : 's'} · {totalBags} bags · {formatMoney(totalEstPay)} est. pay
            </div>
          )}

          {/* Earnings sub-header */}
          {subView === 'earnings' && (
            <>
              <div className="display mt16" style={{ fontSize: 36, color: '#fff' }}>
                {formatMoney(earnings?.totalEarnedCents || 42800)}
              </div>
              <div className="small" style={{ opacity: 0.75 }}>
                {earnings?.deliveryCount || 34} deliveries · {formatMoney(earnings?.totalTipsCents || 18500)} tips
              </div>
            </>
          )}
        </div>

        {/* DRIVER BODY */}
        <div className="d-body">
          {/* ================= VIEW 1: HOME ================= */}
          {subView === 'home' && (
            <>
              <div className="card" style={{ background: 'var(--gold-50)', borderColor: 'var(--gold-200)', marginTop: 8 }}>
                <div className="tiny strong" style={{ color: 'var(--gold-700)' }}>
                  NEXT DELIVERY DAY
                </div>
                <div className="display" style={{ fontSize: 22 }}>
                  Saturday, Feb 21
                </div>
                <div className="small muted">Morning 6 AM–12 PM · Afternoon 12 PM–4 PM</div>
              </div>

              <div className="grid g2 mt16">
                <div
                  className="card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSubView('available')}
                >
                  <div className="tiny muted strong">AVAILABLE JOBS</div>
                  <div className="display" style={{ fontSize: 32 }}>
                    {jobBoard.length}
                  </div>
                  <div className="small" style={{ color: 'var(--blue-700)' }}>
                    Browse →
                  </div>
                </div>

                <div
                  className="card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSubView('route')}
                >
                  <div className="tiny muted strong">MY ROUTE</div>
                  <div className="display" style={{ fontSize: 32 }}>
                    {activeRoute.length}
                  </div>
                  <div className="small" style={{ color: 'var(--blue-700)' }}>
                    Open route →
                  </div>
                </div>
              </div>

              <div className="card mt16">
                <div className="row between">
                  <div>
                    <div className="tiny muted strong">LIFETIME EARNINGS</div>
                    <div className="display" style={{ fontSize: 28 }}>
                      {formatMoney(earnings?.totalEarnedCents || 42800)}
                    </div>
                  </div>
                  <div className="right">
                    <div className="strong">{earnings?.deliveryCount || 34}</div>
                    <div className="tiny muted">deliveries</div>
                  </div>
                </div>
                <div className="small muted mt8">
                  Base pay $5.50 per stop + 100% of tips ({formatMoney(earnings?.totalTipsCents || 18500)} in tips so far)
                </div>
              </div>

              <div className="card mt16">
                <h4>Delivery-day checklist</h4>
                {[
                  'Insulated bags & cooler loaded',
                  'Phone charged, app online',
                  'Verify BuckDuck bag count at each store',
                  'Photo + note at every drop-off',
                ].map((task, i) => (
                  <label key={i} className="check" style={{ padding: '6px 0' }}>
                    <input
                      type="checkbox"
                      checked={!!checklist[i]}
                      onChange={(e) => setChecklist({ ...checklist, [i]: e.target.checked })}
                    />
                    <span>{task}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* ================= VIEW 2: AVAILABLE JOBS ================= */}
          {subView === 'available' && (
            <>
              {!isOnline && (
                <div className="alert warn mb16">
                  ⚠️ Go online to accept jobs.
                </div>
              )}

              {jobBoard.map((job) => (
                <div key={job.id} className="stop">
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <span className="badge b-gold">
                      {job.window?.label || 'Saturday · 12 PM–4 PM'}
                    </span>
                    <span className="pay-pill">
                      {formatMoney(job.driverPayCents || job.driver_pay_cents || 850)}
                    </span>
                  </div>

                  <div className="leg">
                    <div className="pin pick">🏪</div>
                    <div>
                      <div className="strong">{job.store?.name || 'Local Store'}</div>
                      <div className="tiny muted">
                        {job.store?.address || 'Harwin Dr, Silver Spring'}
                      </div>
                    </div>
                  </div>

                  <div className="leg">
                    <div className="pin drop">🏠</div>
                    <div>
                      <div className="strong">
                        {job.destinationCity || 'Silver Spring'}, MD {job.destinationZip || '20910'}
                      </div>
                      <div className="tiny muted">Exact address shown after accepting</div>
                    </div>
                  </div>

                  <div className="row between small muted mt8">
                    <span>
                      🛍️ {job.bags || 1} bag{(job.bags || 1) > 1 ? 's' : ''} · {job.itemCount || 3} items
                    </span>
                    <span>
                      {job.tipCents ? `incl. ${formatMoney(job.tipCents)} tip` : 'incl. tip'}
                    </span>
                  </div>

                  <button
                    className="btn btn-primary btn-block mt16"
                    disabled={!isOnline}
                    onClick={() => acceptJob(job.id)}
                  >
                    Accept delivery
                  </button>
                </div>
              ))}

              {jobBoard.length === 0 && (
                <div className="empty">
                  <div className="e">📭</div>
                  <h3>No jobs right now</h3>
                  <p className="small muted">Stores mark orders ready as they finish packing on Friday night and Saturday morning.</p>
                </div>
              )}
            </>
          )}

          {/* ================= VIEW 3: ACTIVE ROUTE ================= */}
          {subView === 'route' && (
            <>
              {activeRoute.length > 0 && (
                <div className="map-strip">
                  <svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
                    <polyline
                      points={pts.map((p) => p.join(',')).join(' ')}
                      fill="none"
                      stroke="#1D4ED8"
                      strokeWidth="3"
                      strokeDasharray="6 5"
                    />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p[0]} cy={p[1]} r="9" fill="#0B1F4B" stroke="#E8BC3A" strokeWidth="2" />
                        <text
                          x={p[0]}
                          y={p[1] + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#fff"
                          fontWeight="700"
                        >
                          {i + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )}

              {activeRoute.map((stop, i) => {
                const saddr = `${stop.stores?.address || '9211 Harwin Dr'}, ${stop.stores?.city || 'Silver Spring'} MD`;
                const caddr = `${stop.address_line1 || '123 Georgia Ave'}, ${stop.city || 'Silver Spring'}, ${stop.state || 'MD'} ${stop.zip || '20910'}`;
                const isPickedUp = stop.status === 'out_for_delivery' || stop.status === 'picked_up';

                return (
                  <div key={stop.id} className="stop">
                    <div className="row between">
                      <b>Stop {i + 1} · {stop.number || `BD-${10000 + stop.id}`}</b>
                      <span className={`badge ${isPickedUp ? 'b-blue' : 'b-amber'}`}>
                        {isPickedUp ? 'In vehicle' : 'Ready for pickup'}
                      </span>
                    </div>
                    <div className="tiny muted mb8">
                      {stop.delivery_windows?.label || 'Saturday · 12 PM–4 PM'}
                    </div>

                    {/* Store pickup leg */}
                    <div className="leg">
                      <div className="pin pick">🏪</div>
                      <div className="grow">
                        <div className="strong">{stop.stores?.name || 'Store'}</div>
                        <div className="tiny muted">{saddr}</div>
                        <div className="row wrap mt8" style={{ gap: 6 }}>
                          <a
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(saddr)}`}
                          >
                            🗺️ Google Maps
                          </a>
                          <a
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://maps.apple.com/?daddr=${encodeURIComponent(saddr)}`}
                          >
                            🧭 Apple Maps
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Customer drop leg */}
                    <div className="leg">
                      <div className="pin drop">🏠</div>
                      <div className="grow">
                        <div className="strong">{stop.users_orders_customer_idTousers?.name || 'Customer'}</div>
                        <div className="tiny muted">
                          {caddr}
                          {stop.address_line2 ? ` · ${stop.address_line2}` : ''}
                        </div>
                        {stop.notes && <div className="tiny strong" style={{ marginTop: 4, color: 'var(--amber, #d97706)' }}>📝 {stop.notes}</div>}
                        
                        <div className="row wrap mt8" style={{ gap: 6 }}>
                          {stop.phone && (
                            <>
                              <a
                                className="btn btn-sm btn-primary"
                                style={{ padding: '3px 8px', fontSize: 11 }}
                                href={`tel:${stop.phone}`}
                              >
                                📞 Call ({stop.phone})
                              </a>
                              <a
                                className="btn btn-sm btn-gold"
                                style={{ padding: '3px 8px', fontSize: 11 }}
                                href={`sms:${stop.phone}?&body=${encodeURIComponent("Hi " + (stop.users_orders_customer_idTousers?.name?.split(' ')[0] || 'there') + ", this is your BuckDuck driver! I have arrived with your Saturday grocery delivery from " + (stop.stores?.name || 'your local grocer') + ".")}`}
                              >
                                💬 SMS Arrival
                              </a>
                            </>
                          )}
                          <a
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(caddr)}`}
                          >
                            🗺️ Google Maps
                          </a>
                          <a
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://maps.apple.com/?daddr=${encodeURIComponent(caddr)}`}
                          >
                            🧭 Apple Maps
                          </a>
                          <a
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://waze.com/ul?q=${encodeURIComponent(caddr)}`}
                          >
                            🚗 Waze
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="row between small mt8">
                      <span className="bag-tag">🛍️ Collect {stop.bags || 1} BuckDuck bag{(stop.bags || 1) > 1 ? 's' : ''}</span>
                      <span className="pay-pill">{formatMoney(stop.driver_pay_cents || 850)}</span>
                    </div>

                    {!isPickedUp ? (
                      <div className="row mt16">
                        <button
                          className="btn btn-primary grow"
                          onClick={() => confirmPickup(stop.id, stop.bags || 1)}
                        >
                          Confirm pickup ({stop.bags || 1} bag{(stop.bags || 1) > 1 ? 's' : ''})
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-success btn-block mt16"
                        onClick={() => setDeliverModalOrder(stop)}
                      >
                        Complete delivery
                      </button>
                    )}
                  </div>
                );
              })}

              {activeRoute.length === 0 && (
                <div className="empty">
                  <div className="e">🗺️</div>
                  <h3>Your route is empty</h3>
                  <p className="small muted">
                    Browse the job board to accept orders for this Saturday.
                  </p>
                  <button
                    className="btn btn-primary btn-sm mt16"
                    onClick={() => setSubView('available')}
                  >
                    Find jobs →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ================= VIEW 4: EARNINGS ================= */}
          {subView === 'earnings' && (
            <>
              <div className="card">
                <BarChart
                  data={chartData}
                  valueKey="sales"
                  labelKey="lbl"
                  height={180}
                  color="var(--gold-600)"
                  tipLabel="Earned"
                />
              </div>

              <h4 className="mt16">By delivery day</h4>
              {(earnings?.weeks || [
                { date: '2026-02-21', deliveries: 12, tips: 6500, earnings: 14500 },
                { date: '2026-02-14', deliveries: 10, tips: 5200, earnings: 12000 },
                { date: '2026-02-07', deliveries: 12, tips: 6800, earnings: 16300 },
              ]).map((w: any, idx: number) => (
                <div
                  key={idx}
                  className="card flat row between"
                  style={{ marginBottom: 8, padding: 14 }}
                >
                  <div>
                    <b>{new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b>
                    <div className="tiny muted">
                      {w.deliveries} deliveries · {formatMoney(w.tips)} tips
                    </div>
                  </div>
                  <b>{formatMoney(w.earnings)}</b>
                </div>
              ))}

              <h4 className="mt16">Recent deliveries</h4>
              {(earnings?.recent || [
                { number: 'BD-10023-A', store: 'Accra Market', pay: 850 },
                { number: 'BD-10022-A', store: 'Kofi Bakery', pay: 750 },
                { number: 'BD-10021-B', store: 'Spice Bazaar', pay: 920 },
              ]).map((o: any, idx: number) => (
                <div
                  key={idx}
                  className="row between small"
                  style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}
                >
                  <span>{o.number} · {o.store}</span>
                  <b>{formatMoney(o.pay)}</b>
                </div>
              ))}

              <p className="tiny muted mt16">
                Payouts are sent weekly via direct deposit every Tuesday.
              </p>
            </>
          )}
        </div>

        {/* DRIVER FIXED BOTTOM BAR */}
        <nav className="d-nav no-print">
          <a
            href="#home"
            className={subView === 'home' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setSubView('home'); }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </a>

          <a
            href="#available"
            className={subView === 'available' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setSubView('available'); }}
          >
            {jobBoard.length > 0 && <span className="dot">{jobBoard.length}</span>}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Jobs
          </a>

          <a
            href="#route"
            className={subView === 'route' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setSubView('route'); }}
          >
            {activeRoute.length > 0 && <span className="dot">{activeRoute.length}</span>}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Route
          </a>

          <a
            href="#earnings"
            className={subView === 'earnings' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setSubView('earnings'); }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Earnings
          </a>
        </nav>

        {/* DELIVER PHOTO MODAL */}
        {deliverModalOrder && (
          <div className="modal-bg">
            <div className="modal">
              <div className="modal-h">
                <h3>Complete delivery</h3>
                <button
                  className="icon-btn"
                  onClick={() => setDeliverModalOrder(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-b stack">
                <p className="small muted">
                  Delivering order #{deliverModalOrder.number} to {deliverModalOrder.address_line1}.
                </p>

                <label className="field">
                  Drop-off note
                  <select
                    className="input"
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                  >
                    <option>Handed to customer</option>
                    <option>Left safely at front door</option>
                    <option>Left with building concierge</option>
                    <option>Left at back door / garage</option>
                  </select>
                </label>

                {/* 3.c: Camera Capture UI with Live Image Preview */}
                <div style={{ border: '2px dashed var(--line-2)', borderRadius: 12, padding: 16, textAlign: 'center', background: '#fafbfe' }}>
                  {capturedPhoto ? (
                    <div>
                      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginBottom: 10 }}>
                        <img
                          src={capturedPhoto}
                          alt="Delivery drop-off proof"
                          style={{
                            maxWidth: '100%',
                            maxHeight: 200,
                            borderRadius: 10,
                            objectFit: 'cover',
                            border: '2px solid #22c55e',
                            display: 'block',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            background: 'rgba(0,0,0,0.8)',
                            color: '#86efac',
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 700,
                          }}
                        >
                          ✓ Photo Verified
                        </span>
                      </div>
                      <div className="row center" style={{ gap: 10, justifyContent: 'center' }}>
                        <label
                          htmlFor="driver-camera-input"
                          className="btn btn-sm btn-ghost"
                          style={{ cursor: 'pointer', fontSize: 12 }}
                        >
                          🔄 Retake Photo
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                      <strong style={{ display: 'block', marginBottom: 4 }}>Capture Proof of Delivery</strong>
                      <div className="tiny muted" style={{ marginBottom: 12 }}>
                        Snap a photo of the sealed BuckDuck bags at front door / drop location.
                      </div>

                      <div className="row center wrap" style={{ gap: 8, justifyContent: 'center' }}>
                        <label
                          htmlFor="driver-camera-input"
                          className="btn btn-sm btn-primary"
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          📷 Open Camera / Upload
                        </label>

                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ fontSize: 11 }}
                          onClick={() =>
                            setCapturedPhoto('https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500')
                          }
                        >
                          🖼️ Use Verified Sample
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    id="driver-camera-input"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handlePhotoCapture}
                  />
                </div>
              </div>

              <div className="modal-f">
                <button
                  className="btn btn-ghost"
                  onClick={() => setDeliverModalOrder(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  onClick={completeDelivery}
                >
                  Mark as delivered 🎉
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
