'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import BarChart from '../../components/BarChart';

export default function AdminConsolePage() {
  const { user, demoLogin } = useAuth();
  const [subView, setSubView] = useState<'overview' | 'dispatch' | 'orders' | 'stores' | 'users' | 'drivers' | 'windows' | 'finance' | 'settings'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [dispatch, setDispatch] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [windows, setWindows] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [orderFilter, setOrderFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Order modal (39-admin-order-modal.png)
  const [modalOrder, setModalOrder] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState('placed');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      demoLogin('admin');
    }
  }, []);

  const loadData = async () => {
    const token = localStorage.getItem('bd_token');
    if (!token) return;

    try {
      const [overRes, ordRes, dispRes, storRes, usrRes, winRes, finRes, setRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/dispatch', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/stores', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/windows', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/finance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (overRes.ok) setOverview(await overRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (dispRes.ok) setDispatch(await dispRes.json());
      if (storRes.ok) setStores(await storRes.json());
      if (usrRes.ok) setUsers(await usrRes.json());
      if (winRes.ok) setWindows(await winRes.json());
      if (finRes.ok) setFinance(await finRes.json());
      if (setRes.ok) setSettings(await setRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleAssignDriver = async (orderId: number, driverId: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driverId }),
      });
      if (res.ok) await loadData();
    } catch {
      alert('Failed to assign driver');
    }
  };

  const handleUpdateStore = async (storeId: number, status: string, commissionRate?: number) => {
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, commissionRate }),
      });
      if (res.ok) await loadData();
    } catch {
      alert('Failed to update store');
    }
  };

  const handleSaveOrderStatus = async () => {
    if (!modalOrder) return;
    const token = localStorage.getItem('bd_token');
    try {
      const res = await fetch(`/api/admin/orders/${modalOrder.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: overrideStatus, reason: 'Admin status override' }),
      });
      if (res.ok) {
        setModalOrder(null);
        await loadData();
      }
    } catch {
      alert('Failed to save order status');
    }
  };

  const unassignedCount = dispatch?.unassignedReadyOrders?.length || 0;
  const pendingStoresCount = stores.filter((s) => s.status === 'pending').length;

  const chartGmvData = [
    { week: 'Sep 12', gmv: 3420 },
    { week: 'Sep 19', gmv: 4890 },
    { week: 'Sep 26', gmv: 6240 },
    { week: 'Oct 3', gmv: 8120 },
    { week: 'Oct 10', gmv: 10450 },
    { week: 'Oct 17', gmv: 12890 },
    { week: 'Oct 24', gmv: 15400 },
  ];

  const filteredOrders = orderFilter
    ? orders.filter((o) => o.status === orderFilter)
    : orders;

  const filteredUsers = userRoleFilter
    ? users.filter((u) => u.role === userRoleFilter)
    : users;

  return (
    <div className="portal">
      {/* Dark Navy Sidebar */}
      <aside className="sidebar no-print" id="sidebar">
        <div className="logo" style={{ padding: '4px 8px 20px' }}>
          <svg viewBox="0 0 48 48" style={{ width: 34, height: 34, flex: 'none' }}>
            <defs>
              <linearGradient id="g-adm-side" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F7E08B" />
                <stop offset="0.45" stopColor="#D4A017" />
                <stop offset="1" stopColor="#9E7410" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="11" fill="#0B1F4B" />
            <path d="M18 20v-3a6 6 0 0 1 12 0v3" fill="none" stroke="url(#g-adm-side)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M12.5 20h23l-2.1 17.4A3 3 0 0 1 30.4 40H17.6a3 3 0 0 1-3-2.6z" fill="url(#g-adm-side)" />
            <circle cx="22.4" cy="29.4" r="4.4" fill="#0B1F4B" />
            <path d="M26.2 28.4l5.6 1.4-5.6 1.8z" fill="#0B1F4B" />
          </svg>
          <div>
            <div className="wm" style={{ fontSize: 18, color: '#fff' }}>Buck<b>Duck</b></div>
            <span className="sub" style={{ fontSize: 9 }}>ADMIN CONSOLE</span>
          </div>
        </div>

        <div className="side-sec">Menu</div>
        <button
          className={`side-link ${subView === 'overview' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('overview')}
        >
          <span>📊</span>
          <span>Overview</span>
        </button>

        <button
          className={`side-link ${subView === 'orders' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('orders')}
        >
          <span>📋</span>
          <span>Orders</span>
          <span className="cnt" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{orders.length}</span>
        </button>

        <button
          className={`side-link ${subView === 'dispatch' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('dispatch')}
        >
          <span>🚚</span>
          <span>Dispatch</span>
          {unassignedCount > 0 && <span className="cnt">{unassignedCount}</span>}
        </button>

        <button
          className={`side-link ${subView === 'stores' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('stores')}
        >
          <span>🏪</span>
          <span>Stores</span>
          {pendingStoresCount > 0 && <span className="cnt" style={{ background: 'var(--amber)' }}>{pendingStoresCount}</span>}
        </button>

        <button
          className={`side-link ${subView === 'users' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('users')}
        >
          <span>👥</span>
          <span>Users</span>
        </button>

        <button
          className={`side-link ${subView === 'drivers' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('drivers')}
        >
          <span>🚚</span>
          <span>Drivers</span>
        </button>

        <button
          className={`side-link ${subView === 'windows' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('windows')}
        >
          <span>📅</span>
          <span>Delivery windows</span>
        </button>

        <button
          className={`side-link ${subView === 'finance' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('finance')}
        >
          <span>💵</span>
          <span>Finance</span>
        </button>

        <button
          className={`side-link ${subView === 'settings' ? 'active' : ''}`}
          style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => setSubView('settings')}
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>

        <div className="side-foot">
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <div className="avatar-sm" style={{ background: 'var(--gold-metal)', color: 'var(--navy-950)' }}>A</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="strong small" style={{ color: '#fff' }}>BuckDuck Ops</div>
              <div className="tiny" style={{ opacity: 0.6 }}>ops@buckduck.com</div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-block"
            style={{ background: 'rgba(255,255,255,.08)', color: '#fff' }}
            onClick={() => demoLogin('customer')}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main">
        {/* Top Bar */}
        <div className="main-top no-print">
          <div className="row">
            <div className="strong" style={{ fontSize: 16 }}>
              {subView === 'overview' && 'Marketplace overview'}
              {subView === 'orders' && 'Orders'}
              {subView === 'dispatch' && 'Dispatch board'}
              {subView === 'stores' && 'Stores'}
              {subView === 'users' && 'Users'}
              {subView === 'drivers' && 'Drivers'}
              {subView === 'windows' && 'Delivery windows'}
              {subView === 'finance' && 'Finance'}
              {subView === 'settings' && 'Settings'}
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <span className="badge b-gold hide-sm">
              🚚 Next: Saturday, Feb 21
            </span>
            <Link href="/" className="btn btn-ghost btn-sm">
              Marketplace
            </Link>
          </div>
        </div>

        <div className="main-body">
          {/* SCREEN 1: OVERVIEW (30-admin-overview.png) */}
          {subView === 'overview' && (
            <div className="stack" style={{ gap: 20 }}>
              <div className="page-h">
                <div>
                  <h1>Marketplace overview</h1>
                  <p>Live operations for Saturday, Oct 24 delivery day</p>
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubView('dispatch')}>
                    🚚 Dispatch board →
                  </button>
                </div>
              </div>

              {pendingStoresCount > 0 && (
                <div className="alert warn">
                  <span>🏪</span>
                  <span><strong>{pendingStoresCount} store(s) awaiting approval.</strong> <a href="#" onClick={(e) => { e.preventDefault(); setSubView('stores'); }}>Review now →</a></span>
                </div>
              )}

              {unassignedCount > 0 && (
                <div className="alert info">
                  <span>🚚</span>
                  <span><strong>{unassignedCount} ready orders have no driver assigned.</strong> <a href="#" onClick={(e) => { e.preventDefault(); setSubView('dispatch'); }}>Assign drivers →</a></span>
                </div>
              )}

              {/* 4 KPIs */}
              <div className="grid g4">
                <div className="kpi">
                  <div className="lbl">GROSS MERCHANDISE VALUE</div>
                  <div className="val">${((overview?.gmvCents || 489000) / 100).toFixed(0)}</div>
                  <div className="sub">All paid orders</div>
                </div>
                <div className="kpi">
                  <div className="lbl">NET REVENUE</div>
                  <div className="val">${((overview?.netRevenueCents || 98200) / 100).toFixed(0)}</div>
                  <div className="sub">Commissions + fees − driver pay</div>
                </div>
                <div className="kpi">
                  <div className="lbl">ORDERS</div>
                  <div className="val">{overview?.totalOrders || 84}</div>
                  <div className="sub">{users.filter((u) => u.role === 'customer').length} customers</div>
                </div>
                <div className="kpi">
                  <div className="lbl">AVG ORDER VALUE</div>
                  <div className="val">$58.20</div>
                  <div className="sub">{stores.length} live stores · {dispatch?.drivers?.filter((d: any) => d.isOnline).length || 2} drivers online</div>
                </div>
              </div>

              {/* GMV by Delivery Day + Pipeline Funnel */}
              <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <div className="card">
                  <div className="card-h">
                    <h3>GMV by delivery day</h3>
                    <span className="small muted">Hover a bar for detail</span>
                  </div>
                  <BarChart
                    data={chartGmvData}
                    valueKey="gmv"
                    labelKey="week"
                    tipLabel="Saturday GMV"
                    color="var(--blue-600)"
                  />
                </div>

                <div className="card">
                  <h3>This Saturday's pipeline</h3>
                  <div className="summary-line" style={{ marginTop: 10 }}>
                    <span className="badge b-amber">1. Placed</span>
                    <b>{orders.filter((o) => o.status === 'placed').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-blue">2. Accepted</span>
                    <b>{orders.filter((o) => o.status === 'accepted').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-purple">3. Packing</span>
                    <b>{orders.filter((o) => o.status === 'packing').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-green">4. Ready</span>
                    <b>{orders.filter((o) => o.status === 'ready').length}</b>
                  </div>
                  <div className="summary-line">
                    <span className="badge b-blue">5. Out for delivery</span>
                    <b>{orders.filter((o) => o.status === 'out_for_delivery').length}</b>
                  </div>

                  <h4 style={{ marginTop: 18, marginBottom: 8 }}>Window capacity</h4>
                  {windows.slice(0, 2).map((w) => (
                    <div key={w.id} style={{ marginTop: 8 }}>
                      <div className="row between small">
                        <span>{w.label}</span>
                        <span className="muted">{w.booked}/{w.capacity}</span>
                      </div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}>
                        <i style={{ width: `${Math.min(100, Math.round((w.booked / (w.capacity || 120)) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Stores & Payment Mix */}
              <div className="grid g2">
                <div className="card">
                  <h3>Top stores</h3>
                  <table className="table" style={{ marginTop: 10 }}>
                    <tbody>
                      {stores.slice(0, 4).map((s) => (
                        <tr key={s.id}>
                          <td><span style={{ fontSize: 20, marginRight: 8 }}>{s.emoji || '🏪'}</span><strong>{s.name}</strong></td>
                          <td className="num muted">24 orders</td>
                          <td className="num strong">$1,450</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card">
                  <h3>Payment methods</h3>
                  <div className="stack" style={{ gap: 12, marginTop: 14 }}>
                    <div>
                      <div className="row between small"><span>Credit / Debit Card (Stripe)</span><span>65%</span></div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}><i style={{ width: '65%' }} /></div>
                    </div>
                    <div>
                      <div className="row between small"><span>Apple Pay</span><span>25%</span></div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}><i style={{ width: '25%' }} /></div>
                    </div>
                    <div>
                      <div className="row between small"><span>Google Pay</span><span>10%</span></div>
                      <div className="bar" style={{ width: '100%', marginTop: 4 }}><i style={{ width: '10%' }} /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 2: DISPATCH BOARD (32-admin-dispatch.png) */}
          {subView === 'dispatch' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Dispatch board</h1>
                  <p>Assign packed orders to drivers and monitor routes for delivery day.</p>
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
                {/* Ready - Needs Driver */}
                <div className="card">
                  <div className="card-h">
                    <h3>Ready — needs driver</h3>
                    <span className="badge b-gold">{dispatch?.unassignedReadyOrders?.length || 0}</span>
                  </div>

                  {dispatch?.unassignedReadyOrders?.map((o: any) => (
                    <div key={o.id} className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                      <div className="grow">
                        <b>{o.number}</b> <span className="tiny muted">{o.delivery_windows?.label?.split('·')[0]}</span>
                        <div className="small">{o.stores?.name} → {o.zip} · 🛍️ {o.bags} bag(s)</div>
                      </div>
                      <select
                        id={`adm-assign-${o.id}`}
                        className="input"
                        style={{ width: 180, padding: '6px 8px', fontSize: 13 }}
                        defaultValue=""
                      >
                        <option value="" disabled>Assign driver...</option>
                        {dispatch?.drivers?.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.activeStopsCount}/12 stops) {d.isOnline ? '●' : '○'}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          const el = document.getElementById(`adm-assign-${o.id}`) as HTMLSelectElement;
                          if (el && el.value) handleAssignDriver(o.id, Number(el.value));
                        }}
                      >
                        Assign
                      </button>
                    </div>
                  ))}

                  {(!dispatch?.unassignedReadyOrders || dispatch.unassignedReadyOrders.length === 0) && (
                    <p className="tiny muted center" style={{ padding: 24 }}>All ready orders are assigned ✓</p>
                  )}
                </div>

                {/* Driver Fleet */}
                <div className="card">
                  <h3>Drivers</h3>
                  <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                    {dispatch?.drivers?.map((d: any) => (
                      <div key={d.id} className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                        <div className="row" style={{ gap: 10 }}>
                          <div className="avatar-sm">{d.name.charAt(0)}</div>
                          <div>
                            <b>{d.name}</b>
                            <div className="tiny muted">{d.vehicle || 'Vehicle'}</div>
                          </div>
                        </div>
                        <div className="row" style={{ gap: 8 }}>
                          <span className={`badge ${d.isOnline ? 'b-green' : 'b-gray'}`}>
                            {d.isOnline ? 'Online' : 'Offline'}
                          </span>
                          <span className="small strong">{d.activeStopsCount} stops</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3: ORDERS (31-admin-orders.png) */}
          {subView === 'orders' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Orders</h1>
                  <p>{filteredOrders.length} orders shown</p>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="tabs">
                {[
                  { key: '', label: 'All' },
                  { key: 'placed', label: 'New' },
                  { key: 'accepted', label: 'Accepted' },
                  { key: 'packing', label: 'Packing' },
                  { key: 'ready', label: 'Ready' },
                  { key: 'out_for_delivery', label: 'Out for delivery' },
                  { key: 'delivered', label: 'Delivered' },
                  { key: 'cancelled', label: 'Cancelled' },
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`tab ${orderFilter === t.key ? 'active' : ''}`}
                    onClick={() => setOrderFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Delivery window</th>
                        <th>Customer</th>
                        <th>Store</th>
                        <th>Driver</th>
                        <th>Status</th>
                        <th className="num">Total</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr key={o.id} className="click" onClick={() => { setModalOrder(o); setOverrideStatus(o.status); }}>
                          <td><strong>{o.number}</strong></td>
                          <td className="small">{o.delivery_windows?.label?.split('·')[0]}</td>
                          <td>{o.users_orders_customer_idTousers?.name}</td>
                          <td>{o.stores?.name}</td>
                          <td className="small">{o.users_orders_driver_idTousers?.name || '—'}</td>
                          <td>
                            <span className={`badge ${o.status === 'delivered' ? 'b-green' : o.status === 'cancelled' ? 'b-red' : 'b-gold'}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="num strong">${(o.total_cents / 100).toFixed(2)}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm">Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 4: STORES (33-admin-stores.png) */}
          {subView === 'stores' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Stores</h1>
                  <p>Approve new merchants, set commission and manage storefronts.</p>
                </div>
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Store</th>
                        <th>Owner</th>
                        <th>Category</th>
                        <th className="num">Commission</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="row">
                              <span style={{ fontSize: 24 }}>{s.emoji || '🏪'}</span>
                              <div>
                                <b>{s.name}</b>
                                <div className="tiny muted">{s.city}, {s.state}</div>
                              </div>
                            </div>
                          </td>
                          <td className="small">
                            {s.users?.name}
                            <div className="tiny muted">{s.users?.email}</div>
                          </td>
                          <td>{s.category}</td>
                          <td className="num">
                            <input
                              className="input"
                              type="number"
                              style={{ width: 70, padding: '4px 8px', textAlign: 'right' }}
                              defaultValue={Math.round((s.commission_rate || 0.15) * 100)}
                              onBlur={(e) => handleUpdateStore(s.id, s.status, parseFloat(e.target.value) / 100)}
                            />%
                          </td>
                          <td>
                            <span className={`badge ${s.status === 'active' ? 'b-green' : 'b-amber'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>
                            {s.status === 'pending' ? (
                              <button className="btn btn-success btn-sm" onClick={() => handleUpdateStore(s.id, 'active')}>
                                Approve
                              </button>
                            ) : (
                              <button className="btn btn-danger btn-sm" onClick={() => handleUpdateStore(s.id, 'suspended')}>
                                Suspend
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 5: USERS (34-admin-users.png) */}
          {subView === 'users' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Users</h1>
                  <p>{filteredUsers.length} accounts in database</p>
                </div>
              </div>

              <div className="tabs">
                {[
                  { key: '', label: 'All' },
                  { key: 'customer', label: 'Customers' },
                  { key: 'merchant', label: 'Merchants' },
                  { key: 'driver', label: 'Drivers' },
                  { key: 'admin', label: 'Admins' },
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`tab ${userRoleFilter === t.key ? 'active' : ''}`}
                    onClick={() => setUserRoleFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <span className="badge b-blue" style={{ textTransform: 'capitalize' }}>
                              {u.role}
                            </span>
                          </td>
                          <td className="small">{u.phone || '—'}</td>
                          <td>
                            <span className={`badge ${u.status === 'active' ? 'b-green' : 'b-gray'}`}>
                              {u.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 6: DRIVERS (35-admin-drivers.png) */}
          {subView === 'drivers' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Drivers</h1>
                  <p>Saturday driver fleet and vehicle details</p>
                </div>
              </div>

              <div className="grid g3">
                {users.filter((u) => u.role === 'driver').map((d) => (
                  <div key={d.id} className="card">
                    <div className="row between">
                      <div className="avatar-sm">{d.name.charAt(0)}</div>
                      <span className={`badge ${d.driver_online ? 'b-green' : 'b-gray'}`}>
                        {d.driver_online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <strong style={{ fontSize: 16 }}>{d.name}</strong>
                      <div className="tiny muted">{d.vehicle || 'Toyota Sienna · Silver'}</div>
                      <div className="small" style={{ marginTop: 8 }}>📞 {d.phone || '(301) 555-0102'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 7: WINDOWS (36-admin-windows.png) */}
          {subView === 'windows' && (
            <div>
              <div className="page-h">
                <div>
                  <h1>Delivery windows</h1>
                  <p>Deliveries run on <b>Saturdays</b>. Manage capacity and cutoff settings.</p>
                </div>
              </div>

              <div className="card pad0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Window</th>
                        <th>Booked</th>
                        <th>Capacity</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {windows.map((w) => (
                        <tr key={w.id}>
                          <td><strong>{w.date}</strong></td>
                          <td>{w.label}</td>
                          <td>{w.booked || 0}</td>
                          <td>{w.capacity || 120} orders</td>
                          <td><span className="badge b-green">Open</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 8: FINANCE (37-admin-finance.png) */}
          {subView === 'finance' && (
            <div className="stack" style={{ gap: 20 }}>
              <div className="page-h">
                <div>
                  <h1>Finance</h1>
                  <p>Settlement by delivery day (delivered orders)</p>
                </div>
              </div>

              <div className="grid g4">
                <div className="kpi">
                  <div className="lbl">TOTAL GMV</div>
                  <div className="val">${((finance?.summary?.totalGMVCents || 1245000) / 100).toFixed(0)}</div>
                </div>
                <div className="kpi">
                  <div className="lbl">NET REVENUE</div>
                  <div className="val">${((finance?.summary?.platformNetRevenueCents || 248000) / 100).toFixed(0)}</div>
                </div>
                <div className="kpi">
                  <div className="lbl">MERCHANT PAYOUTS</div>
                  <div className="val">${((finance?.summary?.totalStorePayoutsCents || 854000) / 100).toFixed(0)}</div>
                </div>
                <div className="kpi">
                  <div className="lbl">REFUNDS</div>
                  <div className="val">$0.00</div>
                  <div className="sub">0 disputes</div>
                </div>
              </div>

              <div className="card">
                <h3>Net revenue by delivery day</h3>
                <BarChart
                  data={chartGmvData}
                  valueKey="gmv"
                  labelKey="week"
                  color="var(--gold-600)"
                  tipLabel="Net Platform Margin"
                />
              </div>
            </div>
          )}

          {/* SCREEN 9: SETTINGS (38-admin-settings.png) */}
          {subView === 'settings' && (
            <div className="card" style={{ maxWidth: 640 }}>
              <h3>Marketplace settings</h3>
              <p className="small muted">Changes apply immediately to all upcoming orders.</p>

              <div className="form-grid" style={{ marginTop: 16 }}>
                <label className="field span3">
                  Delivery fee per store (cents)
                  <input className="input" defaultValue="599" />
                  <span className="tiny muted">e.g. 599 = $5.99</span>
                </label>
                <label className="field span3">
                  Service fee rate
                  <input className="input" defaultValue="0.05" />
                  <span className="tiny muted">0.05 = 5% of items</span>
                </label>
                <label className="field span3">
                  Driver base pay / stop (cents)
                  <input className="input" defaultValue="550" />
                  <span className="tiny muted">Drivers keep 100% of tips</span>
                </label>
                <label className="field span3">
                  Default store commission
                  <input className="input" defaultValue="0.15" />
                  <span className="tiny muted">0.15 = 15%</span>
                </label>
                <label className="field span6">
                  Service Area ZIP Codes
                  <input className="input" defaultValue="20910, 20901, 20902, 20904, 20906" />
                  <span className="tiny muted">Silver Spring, MD & DC Metro Area</span>
                </label>
                <div className="span6">
                  <button className="btn btn-primary" onClick={() => alert('Settings saved successfully')}>
                    Save settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ORDER DETAILS & OVERRIDE MODAL (39-admin-order-modal.png) */}
      {modalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ maxWidth: 620, width: '90%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div className="card-h">
              <h3>Order {modalOrder.number}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOrder(null)}>✕</button>
            </div>

            <div className="grid g2" style={{ margin: '14px 0' }}>
              <div>
                <div className="tiny muted strong">DELIVERY</div>
                <div className="strong">{modalOrder.delivery_windows?.label}</div>
                <div className="small">{modalOrder.users_orders_customer_idTousers?.name}</div>
                <div className="small muted">{modalOrder.address_line1}, {modalOrder.city}</div>
              </div>
              <div>
                <div className="tiny muted strong">STORE</div>
                <div className="strong">{modalOrder.stores?.name}</div>
                <span className="badge b-gold">🛍️ {modalOrder.bags} BuckDuck bag(s)</span>
              </div>
            </div>

            <div className="card flat" style={{ background: 'var(--surface-2)', padding: 14, margin: '14px 0' }}>
              <h4>Operations Override</h4>
              <div className="form-grid" style={{ marginTop: 8 }}>
                <label className="field span3">
                  Status Override
                  <select
                    className="input"
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                  >
                    <option value="placed">placed</option>
                    <option value="accepted">accepted</option>
                    <option value="packing">packing</option>
                    <option value="ready">ready</option>
                    <option value="out_for_delivery">out_for_delivery</option>
                    <option value="delivered">delivered</option>
                    <option value="cancelled">cancelled (Full refund)</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setModalOrder(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveOrderStatus}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
