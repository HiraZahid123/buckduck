<script>/* BuckDuck · StoreFront USA — single-page app for shoppers, merchants, drivers and admins */
(() => {
  'use strict';

  /* ================= state & storage ================= */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return mem[k] ?? d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch { /* ignore */ } }
  };
  const mem = {};
  const S = { config: null, user: null, myStore: null, token: store.get('bd_token', null), cart: store.get('bd_cart', []), pending: null, filters: {} };
  const $app = document.getElementById('app');

  /* ================= API ================= */
  const transport = window.BUCK_TRANSPORT || (async ({ method, path, body, token }) => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined });
    let data = {}; try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: data };
  });
  async function api(method, path, body) {
    let p = path, query = {};
    if (method === 'GET' && body) { query = body; const qs = new URLSearchParams(Object.entries(body).filter(([, v]) => v !== '' && v != null)).toString(); if (qs) p += '?' + qs; }
    const r = await transport({ method, path: p, pathOnly: path, query, body, token: S.token });
    if (r.status === 401 && S.token) { logout(true); }
    if (r.status >= 400) throw new Error(r.body.error || 'Request failed');
    return r.body;
  }

  /* ================= utils ================= */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => '$' + ((Number(c) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = (c) => '$' + Math.round((Number(c) || 0) / 100).toLocaleString('en-US');
  const dObj = (d) => new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
  const fmtDate = (d, o = { weekday: 'short', month: 'short', day: 'numeric' }) => dObj(d).toLocaleDateString('en-US', o);
  const fmtDT = (d) => dObj(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtT = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
  const winText = (o) => `${fmtDate(o.window_date || o.date)} · ${fmtT(o.window_start || o.start_time)}–${fmtT(o.window_end || o.end_time)}`;
  const initials = (n) => String(n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const STATUS = {
    pending_payment: ['Awaiting payment', 'b-gray'], placed: ['New order', 'b-blue'], accepted: ['Accepted', 'b-purple'], packing: ['Packing', 'b-amber'],
    ready: ['Ready for pickup', 'b-gold'], picked_up: ['Out for delivery', 'b-blue'], delivered: ['Delivered', 'b-green'], cancelled: ['Cancelled', 'b-red'], refunded: ['Refunded', 'b-gray']
  };
  const badge = (s) => `<span class="badge ${(STATUS[s] || ['', 'b-gray'])[1]}">${esc((STATUS[s] || [s])[0])}</span>`;
  const PAY = { card: '💳 Card', apple_pay: ' Apple Pay', google_pay: 'G Google Pay', link: 'Link' };
  const go = (h) => { if (location.hash === h) render(); else location.hash = h; };

  function toast(msg, err) {
    let box = document.querySelector('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    while (box.children.length >= 2) box.firstChild.remove();
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 3800);
  }
  const fail = (e) => toast(e.message || String(e), true);

  function modal(title, body, foot = '', wide = false) {
    closeModal();
    const el = document.createElement('div'); el.className = 'modal-bg'; el.id = 'modal';
    el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h3>${title}</h3><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic('x')}</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
    el.addEventListener('mousedown', (e) => { if (e.target === el) closeModal(); });
    document.body.appendChild(el);
    return el;
  }
  function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
  // In-page confirm / input dialog (native confirm/prompt are unreliable in embedded views)
  function ask(title, message, { ok = 'Confirm', danger = false, fields = [] } = {}) {
    return new Promise((resolve) => {
      const el = modal(title, `<p class="mt0">${message}</p>${fields.map((f) => `<label class="field mt16">${esc(f.label)}<input class="input" id="ask-${f.id}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.attrs || ''}></label>`).join('')}`,
        `<button class="btn btn-ghost" id="ask-no">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="ask-yes">${esc(ok)}</button>`);
      const done = (v) => { closeModal(); resolve(v); };
      el.querySelector('#ask-no').onclick = () => done(null);
      el.querySelector('[data-act=closeModal]').onclick = (e) => { e.stopPropagation(); done(null); };
      el.querySelector('#ask-yes').onclick = () => done(Object.fromEntries(fields.map((f) => [f.id, el.querySelector('#ask-' + f.id).value])));
      const first = el.querySelector('input'); if (first) first.focus();
    });
  }
  const CAN_PRINT = !window.BUCK_TRANSPORT;

  function readImage(file, max = 900) {
    return new Promise((res, rej) => {
      if (!file) return res(null);
      if (!/^image\//.test(file.type)) return rej(new Error('Please choose an image file'));
      const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85)); }; img.onerror = () => rej(new Error('Could not read image')); img.src = fr.result; };
      fr.onerror = () => rej(new Error('Could not read file')); fr.readAsDataURL(file);
    });
  }
  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  /* ================= icons & logo ================= */
  const ICONS = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', bag: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2', box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    truck: 'M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18a2 2 0 1 0 0-.01M17 18a2 2 0 1 0 0-.01', chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', store: 'M4 9l1-5h14l1 5M4 9h16v11H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a5 5 0 0 0-5-5', cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
    cal: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4', dollar: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2', check: 'M5 12l5 5L20 7', x: 'M6 6l12 12M18 6L6 18',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3', cart: 'M3 4h2l2.4 11h10.2L20 7H6.2M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01', logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
    menu: 'M4 6h16M4 12h16M4 18h16', plus: 'M12 5v14M5 12h14', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
    nav: 'M3 11l18-8-8 18-2-8z', print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z', lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3', phone: 'M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2'
  };
  const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>`;
  const LOGO_MARK = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="bdg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7E08B"/><stop offset=".45" stop-color="#D4A017"/><stop offset="1" stop-color="#9E7410"/></linearGradient></defs>
    <rect x="2" y="2" width="44" height="44" rx="13" fill="#0B1F4B" stroke="url(#bdg)" stroke-width="2"/>
    <path d="M18 20v-3a6 6 0 0 1 12 0v3" fill="none" stroke="url(#bdg)" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M12.5 20h23l-2.1 17.4A3 3 0 0 1 30.4 40H17.6a3 3 0 0 1-3-2.6z" fill="url(#bdg)"/>
    <circle cx="22.4" cy="29.4" r="4.4" fill="#0B1F4B"/><path d="M26.2 28.4l5.6 1.4-5.6 1.8z" fill="#0B1F4B"/><circle cx="23.3" cy="28.3" r="1" fill="#F7E08B"/>
    <path d="M17 35.5c3 1.6 9 1.6 14 0" stroke="#0B1F4B" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
  const logo = (sub = 'StoreFront USA', href = '#/') => `<a class="logo" href="${href}">${LOGO_MARK}<span><span class="wm">Buck<b>Duck</b></span><span class="sub">${esc(sub)}</span></span></a>`;
  const productImg = (p) => p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : `<span aria-hidden="true">${esc(p.emoji || '🛒')}</span>`;
  const storeAvatar = (s) => s.logo_url ? `<img src="${esc(s.logo_url)}" alt="" style="width:100%;height:100%;object-fit:cover">` : esc(s.emoji || '🛒');

  /* ================= chart (single series bar) ================= */
  function barChart(data, { valueKey, labelKey, fmt = money0, height = 220, color = 'var(--blue-600)', tipLabel = '' }) {
    if (!data.length) return '<div class="empty small">No data yet</div>';
    const W = 640, H = height, pl = 52, pb = 28, pt = 10, pr = 8;
    const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; })();
    const iw = W - pl - pr, ih = H - pt - pb, bw = Math.min(46, (iw / data.length) * 0.62), step = iw / data.length;
    const grid = [0, 0.5, 1].map((g) => { const y = pt + ih - g * ih; return `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${esc(fmt(nice * g))}</text>`; }).join('');
    const bars = data.map((d, i) => {
      const v = Number(d[valueKey]) || 0, h = Math.max(2, (v / nice) * ih), x = pl + i * step + (step - bw) / 2, y = pt + ih - h, r = Math.min(4, bw / 2);
      const path = `M${x},${pt + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${pt + ih} Z`;
      return `<g><rect class="bar-hit" x="${pl + i * step}" y="${pt}" width="${step}" height="${ih}" fill="transparent" data-tip="${esc(d[labelKey])}${tipLabel ? ' · ' + tipLabel : ''}: ${esc(fmt(v))}"/><path class="bar-mark" d="${path}" fill="${color}" pointer-events="none"/>
        <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${esc(d[labelKey])}</text></g>`;
    }).join('');
    return `<div class="chart" data-chart><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${grid}${bars}</svg><div class="tip"></div></div>`;
  }
  document.addEventListener('mousemove', (e) => {
    const hit = e.target.closest && e.target.closest('.bar-hit'); const charts = document.querySelectorAll('[data-chart]');
    charts.forEach((c) => { const tip = c.querySelector('.tip'); if (!hit || !c.contains(hit)) { tip.style.opacity = 0; c.querySelectorAll('.bar-mark.hl').forEach((b) => b.classList.remove('hl')); } });
    if (!hit) return;
    const c = hit.closest('[data-chart]'); const tip = c.querySelector('.tip'); const r = c.getBoundingClientRect();
    tip.textContent = hit.dataset.tip; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.style.opacity = 1;
    c.querySelectorAll('.bar-mark.hl').forEach((b) => b.classList.remove('hl')); hit.nextElementSibling.classList.add('hl');
  });

  /* ================= cart ================= */
  const saveCart = () => { store.set('bd_cart', S.cart); updateCartBadge(); refreshCartControls(); };
  const cartQty = (pid) => (S.cart.find((i) => i.product_id === pid) || {}).qty || 0;
  const cartCount = () => S.cart.reduce((a, i) => a + i.qty, 0);
  function setQty(p, qty) {
    const i = S.cart.findIndex((x) => x.product_id === p.id || x.product_id === p.product_id);
    const max = p.stock ?? 99;
    if (qty > max) { toast(`Only ${max} available`, true); qty = max; }
    if (qty <= 0) { if (i >= 0) S.cart.splice(i, 1); }
    else if (i >= 0) S.cart[i].qty = qty;
    else S.cart.push({ product_id: p.id, qty, name: p.name, price_cents: p.price_cents, emoji: p.emoji, image_url: p.image_url, unit: p.unit, stock: p.stock, store_id: p.store_id, store_name: p.store_name, store_slug: p.store_slug });
    saveCart();
  }
  const PRODUCT_CACHE = new Map();
  const cartCtl = (p) => { const q = cartQty(p.id); return q ? `<div class="stepper"><button data-act="dec" data-pid="${p.id}" aria-label="Remove one">−</button><span>${q}</span><button data-act="inc" data-pid="${p.id}" aria-label="Add one">+</button></div>`
    : `<button class="btn btn-primary btn-sm add-btn btn-block" data-act="inc" data-pid="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'Sold out' : ic('plus', 16) + ' Add'}</button>`; };
  function refreshCartControls() { document.querySelectorAll('[data-cart-ctl]').forEach((el) => { const p = PRODUCT_CACHE.get(Number(el.dataset.cartCtl)); if (p) el.innerHTML = cartCtl(p); }); }
  function updateCartBadge() { document.querySelectorAll('[data-cart-count]').forEach((el) => { const n = cartCount(); el.textContent = n; el.classList.toggle('hidden', !n); }); }

  /* ================= auth ================= */
  async function loadMe() {
    if (!S.token) { S.user = null; S.myStore = null; return; }
    try { const r = await api('GET', '/api/me'); S.user = r.user; S.myStore = r.store || null; } catch { S.user = null; }
  }
  function setSession(r) { S.token = r.token; S.user = r.user; store.set('bd_token', r.token); }
  function logout(silent) { S.token = null; S.user = null; S.myStore = null; store.del('bd_token'); if (!silent) { toast('Signed out'); go('#/'); } }
  const homeFor = (u) => ({ merchant: '#/merchant', driver: '#/driver', admin: '#/admin' }[u?.role] || '#/');

  /* ================= router ================= */
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [p, qs] = h.split('?');
    return { parts: p.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  let seq = 0;
  async function render() {
    const my = ++seq; closeModal();
    const { parts, query } = parseHash();
    const area = parts[0] || '';
    const roleAreas = { merchant: 'merchant', driver: 'driver', admin: 'admin' };
    try {
      if (roleAreas[area]) {
        if (!S.user) return go(`#/login?next=${encodeURIComponent(location.hash)}`);
        if (S.user.role !== roleAreas[area]) return go(homeFor(S.user));
        const fn = { merchant: merchantPage, driver: driverPage, admin: adminPage }[area];
        const shellFn = area === 'driver' ? driverShell : portalShell;
        $app.innerHTML = shellFn(parts, '<div class="loader"><div class="spin"></div></div>');
        const html = await fn(parts, query);
        if (my !== seq || html === undefined) return;
        $app.innerHTML = shellFn(parts, html);
      } else {
        $app.innerHTML = customerShell('<div class="container"><div class="loader"><div class="spin"></div></div></div>');
        const html = await customerPage(parts, query);
        if (my !== seq || html === undefined) return;
        $app.innerHTML = customerShell(html, parts);
        updateCartBadge();
      }
      window.scrollTo(0, 0);
      afterRender.forEach((f) => f()); afterRender.length = 0;
      renderDemoBar();
    } catch (e) {
      if (my !== seq) return;
      console.error(e);
      $app.innerHTML = customerShell(`<div class="container section"><div class="empty"><div class="e">🦆</div><h2>We hit a snag</h2><p>${esc(e.message)}</p><a class="btn btn-primary" href="#/">Back home</a></div></div>`);
    }
  }
  const afterRender = [];

  /* ================= demo bar ================= */
  const DEMO = { customer: 'customer@buckduck.com', merchant: 'merchant@buckduck.com', driver: 'driver@buckduck.com', admin: 'admin@buckduck.com' };
  function renderDemoBar() {
    let el = document.querySelector('.demo-bar');
    if (!S.config?.demo) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'demo-bar no-print'; document.body.appendChild(el); }
    el.classList.toggle('in-driver', parseHash().parts[0] === 'driver');
    const cur = S.user?.role;
    el.innerHTML = `<b>DEMO · View as</b>${[['customer', '🛒 Shopper'], ['merchant', '🏪 Merchant'], ['driver', '🚚 Driver'], ['admin', '🛡️ Admin']]
      .map(([r, l]) => `<button data-act="demoAs" data-role="${r}" class="${cur === r ? 'on' : ''}">${l}</button>`).join('')}`;
  }
  async function demoAs(role) {
    try { const r = await api('POST', '/api/auth/login', { email: DEMO[role], password: 'demo1234' }); setSession(r); await loadMe(); toast(`Viewing as ${r.user.name}`); go(homeFor(r.user)); } catch (e) { fail(e); }
  }

  /* =====================================================================
     CUSTOMER — StoreFront USA
     ===================================================================== */
  function customerShell(content, parts = []) {
    const w = S.config?.next_window; const u = S.user;
    const dayName = DAYS[S.config?.delivery_weekday ?? 6];
    const acct = u ? (u.role === 'customer'
      ? `<a class="nav-link" href="#/account">${ic('user')}<span class="lbl">${esc(u.name.split(' ')[0])}</span></a>`
      : `<a class="nav-link" href="${homeFor(u)}">${ic('chart')}<span class="lbl">My dashboard</span></a>`)
      : `<a class="nav-link" href="#/login">${ic('user')}<span class="lbl">Sign in</span></a>`;
    return `<div class="topbar no-print"><div class="container"><span>🦆 <span class="gold">One delivery day. Every week.</span> <span class="hide-sm">Order from multiple local stores — it all arrives ${dayName}.</span></span>
      <span class="hide-sm">${w ? `Next delivery: <b>${fmtDate(w.date, { weekday: 'long', month: 'short', day: 'numeric' })}</b> · Order by ${fmtDT(w.cutoff)}` : ''}</span></div></div>
    <header class="nav no-print"><div class="container">${logo()}
      <form class="search" data-form="search" role="search">${ic('search')}<input name="q" placeholder="Search plantains, palm oil, goat meat…" aria-label="Search products" value="${esc(parseHash().query.q || '')}"></form>
      <nav class="nav-links"><a class="nav-link" href="#/stores">${ic('store')}<span class="lbl">Stores</span></a>${acct}
        <a class="nav-link cart-btn" href="#/cart" aria-label="Cart">${ic('cart', 20)}<span class="lbl">Cart</span><span class="cart-count hidden" data-cart-count>0</span></a></nav></div></header>
    <main>${content}</main>
    <footer class="footer no-print"><div class="container"><div class="grid g4">
      <div>${logo()}<p class="mt16 small">BuckDuck connects neighborhood grocers with families through one dependable weekly delivery day.</p></div>
      <div><h4>Shop</h4><div class="stack small" style="gap:6px"><a href="#/stores">All stores</a><a href="#/account">Your orders</a><a href="#/cart">Cart</a></div></div>
      <div><h4>Partner</h4><div class="stack small" style="gap:6px"><a href="#/register?role=merchant">Sell on StoreFront USA</a><a href="#/register?role=driver">Drive with BuckDuck</a><a href="#/login">Partner sign in</a></div></div>
      <div><h4>Secure checkout</h4><p class="small">Payments by Stripe. Card, Apple Pay and Google Pay accepted.</p></div>
    </div><div class="mt32 tiny">© ${new Date().getFullYear()} BuckDuck Inc. · StoreFront USA marketplace</div></div></footer>`;
  }

  async function customerPage(parts, q) {
    const [p0, p1] = parts;
    if (!p0) return homePage();
    if (p0 === 'stores') return storesPage(q);
    if (p0 === 'store') return storePage(p1);
    if (p0 === 'search') return searchPage(q.q || '');
    if (p0 === 'cart') return cartPage();
    if (p0 === 'checkout') return checkoutPage();
    if (p0 === 'order') return orderPage(p1, q);
    if (p0 === 'account' || p0 === 'orders') return accountPage(q);
    if (p0 === 'login') return loginPage(q);
    if (p0 === 'register') return registerPage(q);
    throw new Error('Page not found');
  }

  async function homePage() {
    const [{ stores, categories }, { windows }] = await Promise.all([api('GET', '/api/stores'), api('GET', '/api/windows')]);
    const next = windows.filter((w) => w.date === (windows.find((x) => x.open) || windows[0] || {}).date);
    return `<section class="hero"><div class="container"><div>
      <span class="eyebrow">★ Saturday Grocery Delivery</span>
      <h1>Your neighborhood grocers. <em>Delivered every Saturday.</em></h1>
      <p class="lead">Shop African, Caribbean and local markets in one cart. Each store packs your order in sealed BuckDuck bags, and our drivers bring it all to your door in the window you choose.</p>
      <div class="row wrap mt24"><a class="btn btn-gold btn-lg" href="#/stores">Start shopping</a><a class="btn btn-lg" style="color:#fff;border:1px solid rgba(255,255,255,.3)" href="#how">How it works</a></div>
      <div class="row wrap mt24 small" style="color:rgba(255,255,255,.75);gap:22px"><span>✓ ${stores.length} local stores</span><span>✓ One delivery fee per store</span><span>✓ Apple Pay & Google Pay</span></div>
    </div>
    <div class="hero-card"><div class="row between"><div><div class="tiny" style="color:var(--gold-400);font-weight:800;letter-spacing:.1em">NEXT DELIVERY DAY</div>
      <div class="display" style="font-size:28px">${next[0] ? fmtDate(next[0].date, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Coming soon'}</div></div><div style="font-size:42px">🚚</div></div>
      ${next.map((w) => `<div class="slot"><div><div class="t">${esc(w.label)}</div><div class="tiny" style="opacity:.7">${w.open ? `${w.remaining} spots left · order by ${fmtDT(w.cutoff)}` : 'Closed'}</div></div><div class="bar"><i style="width:${Math.round((w.booked / w.capacity) * 100)}%"></i></div></div>`).join('')}
      <a class="btn btn-gold btn-block mt16" href="#/stores">Reserve my window</a></div></div></section>

    <section class="section" id="how"><div class="container"><div class="section-h"><div><h2>How BuckDuck works</h2><p class="muted mb0">Built around one predictable weekly delivery day.</p></div></div>
      <div class="steps">${[['Shop many stores', 'Fill one cart from any of our partner grocers — produce, meats, pantry staples and bakery.'],
        ['Pick your Saturday window', 'Choose Morning (6 AM – 12 PM) or Afternoon (12 PM – 4 PM). Pay securely with card, Apple Pay or Google Pay.'],
        ['Stores pack in BuckDuck bags', 'Each store prepares your items in sealed, labeled BuckDuck packaging ready for pickup.'],
        ['Delivered to your door', 'A vetted BuckDuck driver collects and delivers within your window, with live status updates.']]
        .map(([t, d], i) => `<div class="step"><div class="n">${i + 1}</div><h3>${t}</h3><p class="muted small mb0">${d}</p></div>`).join('')}</div></div></section>

    <section class="section" style="padding-top:0"><div class="container"><div class="section-h"><h2>Shop local stores</h2><a href="#/stores" class="strong">View all →</a></div>
      <div class="chips mb16">${categories.map((c) => `<a class="chip" href="#/stores?category=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
      <div class="store-grid">${stores.slice(0, 8).map(storeCard).join('')}</div></div></section>

    <section class="section" style="padding-top:0"><div class="container cta-band">
      <div class="cta merchant"><h3>Own a grocery store?</h3><p style="opacity:.85">Open your StoreFront in minutes. We handle payments, packaging, drivers and delivery — you focus on great products.</p><a class="btn btn-gold mt16" href="#/register?role=merchant">Open your storefront</a></div>
      <div class="cta driver"><h3>Drive Saturdays. Earn more.</h3><p style="opacity:.85">One concentrated day of batched routes, base pay per stop, and you keep 100% of tips.</p><a class="btn btn-gold mt16" href="#/register?role=driver">Apply to drive</a></div></div></section>`;
  }
  const storeCard = (s) => `<a class="store-card" href="#/store/${esc(s.slug)}"><div class="cover" style="background:linear-gradient(135deg,${esc(s.color)},${esc(s.color)}cc),var(--navy-900)"><div class="avatar">${storeAvatar(s)}</div></div>
    <div class="body"><h3 class="mb0">${esc(s.name)}</h3><div class="muted small">${esc(s.tagline || s.category)}</div>
    <div class="meta"><span>★ ${Number(s.rating).toFixed(1)}</span><span>· ${esc(s.category)}</span><span>· ${s.product_count} items</span></div></div></a>`;

  async function storesPage(q) {
    const { stores, categories } = await api('GET', '/api/stores', { q: q.q || '', category: q.category || '' });
    return `<div class="container section"><div class="section-h"><div><h2>All stores</h2><p class="muted mb0">Every store delivers on ${DAYS[S.config.delivery_weekday]}.</p></div></div>
      <div class="chips mb16"><a class="chip ${!q.category ? 'active' : ''}" href="#/stores">All</a>${categories.map((c) => `<a class="chip ${q.category === c ? 'active' : ''}" href="#/stores?category=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
      ${stores.length ? `<div class="store-grid">${stores.map(storeCard).join('')}</div>` : '<div class="empty"><div class="e">🏪</div>No stores match.</div>'}</div>`;
  }

  async function storePage(slug) {
    const { store: s, products } = await api('GET', `/api/stores/${encodeURIComponent(slug)}`);
    products.forEach((p) => { p.store_id = s.id; p.store_name = s.name; p.store_slug = s.slug; PRODUCT_CACHE.set(p.id, p); });
    const cats = [...new Set(products.map((p) => p.category))];
    S.filters.storeCat = 'All';
    return `<section class="store-hero" style="background:linear-gradient(120deg,var(--navy-900) 0%,${esc(s.color)} 140%)"><div class="container">
      <div class="avatar">${storeAvatar(s)}</div><div><div class="tiny" style="color:var(--gold-400);font-weight:800;letter-spacing:.1em;text-transform:uppercase">${esc(s.category)}</div>
      <h1 class="display mb0">${esc(s.name)}</h1><div style="opacity:.85">${esc(s.tagline || '')}</div>
      <div class="row wrap small mt8" style="opacity:.85;gap:16px"><span>★ ${Number(s.rating).toFixed(1)}</span><span>📍 ${esc(s.city)}, ${esc(s.state)}</span><span>🚚 Delivers ${DAYS[S.config.delivery_weekday]}s</span><span>🛍️ Packed in BuckDuck bags</span></div></div></div></section>
      <div class="container section" style="padding-top:28px"><p class="muted" style="max-width:760px">${esc(s.description || '')}</p>
      <div class="chips mb16" id="cat-chips">${['All', ...cats].map((c) => `<button class="chip ${c === 'All' ? 'active' : ''}" data-act="storeCat" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="product-grid" id="products">${products.map(productCard).join('')}</div></div>`;
  }
  const productCard = (p) => `<div class="product" data-cat="${esc(p.category)}"><div class="img">${productImg(p)}</div><div class="price">${money(p.price_cents)}</div>
    <div class="name">${esc(p.name)}</div><div class="unit">${esc(p.unit || '')}${p.store_name && p.showStore ? ` · <a href="#/store/${esc(p.store_slug)}">${esc(p.store_name)}</a>` : ''}${p.stock < 10 && p.stock > 0 ? ` · <span style="color:var(--amber)">Only ${p.stock} left</span>` : ''}</div>
    <div class="mt8" style="margin-top:auto" data-cart-ctl="${p.id}">${cartCtl(p)}</div></div>`;

  async function searchPage(q) {
    const { products } = await api('GET', '/api/search', { q });
    products.forEach((p) => { p.showStore = true; PRODUCT_CACHE.set(p.id, p); });
    return `<div class="container section"><h2>Results for “${esc(q)}”</h2><p class="muted">${products.length} items across our stores</p>
      ${products.length ? `<div class="product-grid">${products.map(productCard).join('')}</div>` : '<div class="empty"><div class="e">🔎</div>No products found. Try another search.</div>'}</div>`;
  }

  async function cartPage() {
    if (!S.cart.length) return `<div class="container section"><div class="empty"><div class="e">🛒</div><h2>Your cart is empty</h2><p>Browse our local stores and add items for Saturday delivery.</p><a class="btn btn-primary" href="#/stores">Browse stores</a></div></div>`;
    let quote = null, qerr = '';
    try { quote = await api('POST', '/api/checkout/quote', { items: S.cart.map(({ product_id, qty }) => ({ product_id, qty })), tip_cents: 0 }); } catch (e) { qerr = e.message; }
    const groups = {};
    S.cart.forEach((i) => { (groups[i.store_id] ||= { name: i.store_name, slug: i.store_slug, items: [] }).items.push(i); PRODUCT_CACHE.set(i.product_id, { ...i, id: i.product_id }); });
    return `<div class="container section"><h1 class="display">Your cart</h1><div class="layout-2 mt16"><div class="stack">
      ${qerr ? `<div class="alert warn">${esc(qerr)}</div>` : ''}
      ${Object.entries(groups).map(([sid, g]) => { const sq = quote?.stores.find((x) => String(x.store_id) === sid); return `<div class="card"><div class="card-h"><div><h3><a href="#/store/${esc(g.slug)}">${esc(g.name)}</a></h3><span class="bag-tag">🛍️ ${sq ? sq.bags : 1} BuckDuck bag${sq && sq.bags > 1 ? 's' : ''}</span></div><div class="strong">${sq ? money(sq.subtotal_cents) : ''}</div></div>
        ${g.items.map((i) => `<div class="row" style="padding:10px 0;border-top:1px solid var(--line)"><div style="width:52px;height:52px;border-radius:12px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden;flex:none">${productImg(i)}</div>
          <div class="grow"><div class="strong">${esc(i.name)}</div><div class="tiny muted">${esc(i.unit || '')} · ${money(i.price_cents)}</div></div>
          <div data-cart-ctl="${i.product_id}" style="width:120px">${cartCtl({ ...i, id: i.product_id })}</div><div class="num strong" style="width:80px">${money(i.price_cents * i.qty)}</div></div>`).join('')}</div>`; }).join('')}
      </div><div class="card sticky"><h3>Order summary</h3>
        ${quote ? `<div class="summary-line"><span>Items</span><span>${money(quote.subtotal_cents)}</span></div><div class="summary-line"><span>Delivery (${quote.stores.length} store${quote.stores.length > 1 ? 's' : ''})</span><span>${money(quote.delivery_fee_cents)}</span></div>
        <div class="summary-line"><span>Service fee</span><span>${money(quote.service_fee_cents)}</span></div>${quote.tax_cents ? `<div class="summary-line"><span>Tax</span><span>${money(quote.tax_cents)}</span></div>` : ''}
        <div class="summary-line total"><span>Estimated total</span><span>${money(quote.total_cents)}</span></div>
        ${quote.subtotal_cents < quote.min_order_cents ? `<div class="alert warn mt16">Add ${money(quote.min_order_cents - quote.subtotal_cents)} more to reach the ${money(quote.min_order_cents)} minimum.</div>` : ''}
        <a class="btn btn-gold btn-block btn-lg mt16 ${quote.subtotal_cents < quote.min_order_cents ? 'hidden' : ''}" href="#/checkout">Choose delivery window →</a>` : ''}
        <p class="tiny muted mt16 mb0">All stores deliver together in your chosen ${DAYS[S.config.delivery_weekday]} window. Tip is added at checkout — 100% goes to your driver.</p></div></div></div>`;
  }

  async function checkoutPage() {
    if (!S.user) return go('#/login?next=' + encodeURIComponent('#/checkout'));
    if (S.user.role !== 'customer') return `<div class="container section"><div class="alert warn">You're signed in as a ${esc(S.user.role)}. Sign in with a shopper account to check out.</div></div>`;
    if (!S.cart.length) return go('#/cart');
    const { windows } = await api('GET', '/api/windows');
    const firstOpen = windows.find((w) => w.open);
    const last = store.get('bd_addr', {});
    S.co = { window_id: firstOpen?.id, tip: 500 };
    const byDate = {}; windows.forEach((w) => (byDate[w.date] ||= []).push(w));
    afterRender.push(() => updateCheckoutTotals());
    return `<div class="container section"><h1 class="display">Checkout</h1><div class="layout-2 mt16"><div class="stack" id="co-left">
      <form class="card" data-form="checkout" id="co-form"><h3>1 · Delivery address</h3><div class="form-grid mt16">
        <label class="field span4">Street address<input class="input" name="line1" required value="${esc(last.line1 || '')}" autocomplete="address-line1" placeholder="1234 Bellaire Blvd"></label>
        <label class="field span2">Apt / Suite<input class="input" name="line2" value="${esc(last.line2 || '')}" autocomplete="address-line2"></label>
        <label class="field span3">City<input class="input" name="city" required value="${esc(last.city || 'Houston')}" autocomplete="address-level2"></label>
        <label class="field span1">State<input class="input" name="state" required maxlength="2" value="${esc(last.state || 'TX')}" autocomplete="address-level1"></label>
        <label class="field span2">ZIP<input class="input" name="zip" required inputmode="numeric" value="${esc(last.zip || '')}" autocomplete="postal-code" placeholder="77036"></label>
        <label class="field span3">Mobile phone<input class="input" name="phone" required value="${esc(S.user.phone || '')}" autocomplete="tel"></label>
        <label class="field span3">Delivery notes<input class="input" name="notes" placeholder="Gate code, leave at door…"></label></div>
      <h3 class="mt32">2 · ${DAYS[S.config.delivery_weekday]} delivery window</h3>
      ${Object.entries(byDate).map(([d, ws]) => `<div class="mt16"><div class="small strong muted mb16" style="margin-bottom:8px">${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}</div><div class="grid g2">
        ${ws.map((w) => `<div class="window-opt ${w.open ? '' : 'dis'} ${w.id === S.co.window_id ? 'sel' : ''}" ${w.open ? `data-act="pickWindow" data-id="${w.id}"` : ''} role="radio" aria-checked="${w.id === S.co.window_id}" tabindex="0">
          <div class="day"><small>${fmtDate(w.date, { weekday: 'short' })}</small><b>${dObj(w.date).getDate()}</b></div>
          <div class="grow"><div class="strong">${esc(w.label)}</div><div class="tiny muted">${w.open ? `${w.remaining} of ${w.capacity} spots left · order by ${fmtDT(w.cutoff)}` : (w.remaining ? 'Ordering closed' : 'Full')}</div></div></div>`).join('')}</div></div>`).join('')}
      <h3 class="mt32">3 · Driver tip</h3><p class="small muted">100% of your tip goes to the driver who delivers your order.</p>
      <div class="tip-chips">${[0, 300, 500, 800, 1000].map((t) => `<button type="button" class="chip ${t === S.co.tip ? 'active' : ''}" data-act="pickTip" data-tip="${t}">${t ? money0(t) : 'No tip'}</button>`).join('')}</div>
      <button class="btn btn-gold btn-lg btn-block mt32" type="submit" id="co-submit">Continue to payment</button></form>
      <div id="pay-panel"></div></div>
      <div class="card sticky" id="co-summary"><div class="loader"><div class="spin"></div></div></div></div></div>`;
  }
  async function updateCheckoutTotals() {
    const el = document.getElementById('co-summary'); if (!el) return;
    try {
      const q = await api('POST', '/api/checkout/quote', { items: S.cart.map(({ product_id, qty }) => ({ product_id, qty })), tip_cents: S.co.tip });
      el.innerHTML = `<h3>Order summary</h3>${q.stores.map((s) => `<div class="summary-line"><span>${esc(s.store_name)} <span class="tiny muted">· ${s.bags} bag${s.bags > 1 ? 's' : ''}</span></span><span>${money(s.subtotal_cents)}</span></div>`).join('')}
        <div style="border-top:1px solid var(--line);margin:8px 0"></div><div class="summary-line"><span>Delivery</span><span>${money(q.delivery_fee_cents)}</span></div>
        <div class="summary-line"><span>Service fee</span><span>${money(q.service_fee_cents)}</span></div>${q.tax_cents ? `<div class="summary-line"><span>Tax</span><span>${money(q.tax_cents)}</span></div>` : ''}
        <div class="summary-line"><span>Driver tip</span><span>${money(q.tip_cents)}</span></div><div class="summary-line total"><span>Total</span><span>${money(q.total_cents)}</span></div>
        <div class="secure">${ic('lock', 14)} Secured by Stripe · Card · Apple Pay · Google Pay</div>`;
    } catch (e) { el.innerHTML = `<div class="alert warn">${esc(e.message)}</div>`; }
  }
  async function submitCheckout(form) {
    const f = formData(form);
    if (!S.co.window_id) return toast('Please choose a delivery window', true);
    const btn = document.getElementById('co-submit'); btn.disabled = true; btn.textContent = 'Reserving your window…';
    try {
      const address = { line1: f.line1, line2: f.line2, city: f.city, state: f.state, zip: f.zip };
      store.set('bd_addr', address);
      const r = await api('POST', '/api/checkout', { items: S.cart.map(({ product_id, qty }) => ({ product_id, qty })), window_id: S.co.window_id, tip_cents: S.co.tip, address, phone: f.phone, notes: f.notes });
      S.pending = r;
      form.querySelectorAll('input,button').forEach((x) => { x.disabled = true; });
      btn.textContent = 'Window reserved ✓';
      await renderPayment(r);
    } catch (e) { btn.disabled = false; btn.textContent = 'Continue to payment'; fail(e); }
  }

  /* ---- payments ---- */
  function loadStripeJs() {
    return new Promise((res, rej) => {
      if (window.Stripe) return res(window.Stripe);
      const s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.onload = () => res(window.Stripe); s.onerror = () => rej(new Error('Could not load Stripe')); document.head.appendChild(s);
    });
  }
  async function renderPayment(r) {
    const panel = document.getElementById('pay-panel');
    panel.innerHTML = `<div class="card" id="pay-card"><h3>4 · Payment</h3><p class="small muted">Total due: <b>${money(r.amount_cents)}</b></p><div id="pay-body"><div class="loader"><div class="spin"></div></div></div></div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const body = document.getElementById('pay-body');
    if (r.mode === 'stripe' && S.config.payments.publishableKey) {
      const StripeJs = await loadStripeJs();
      const stripe = StripeJs(S.config.payments.publishableKey);
      const elements = stripe.elements({ clientSecret: r.client_secret, appearance: { theme: 'stripe', variables: { colorPrimary: '#0B1F4B', borderRadius: '10px', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' } } });
      body.innerHTML = `<div id="express-el"></div><div class="divider">or pay with card</div><div id="payment-el"></div><button class="btn btn-gold btn-lg btn-block mt16" id="pay-btn">Pay ${money(r.amount_cents)}</button><div class="secure">${ic('lock', 14)} Payments are processed securely by Stripe. BuckDuck never stores your card.</div>`;
      const returnUrl = `${location.origin}${location.pathname}?checkout_return=${r.checkout_id}`;
      const confirm = async () => {
        const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: 'if_required' });
        if (error) throw new Error(error.message);
        await finishCheckout(r.checkout_id);
      };
      const express = elements.create('expressCheckout', { buttonType: { applePay: 'buy', googlePay: 'buy' }, paymentMethods: { applePay: 'always', googlePay: 'always', link: 'auto' }, buttonHeight: 50 });
      express.mount('#express-el');
      express.on('confirm', () => confirm().catch(fail));
      elements.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } }).mount('#payment-el');
      document.getElementById('pay-btn').onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'Processing…';
        try { const { error } = await elements.submit(); if (error) throw new Error(error.message); await confirm(); } catch (err) { fail(err); b.disabled = false; b.textContent = `Pay ${money(r.amount_cents)}`; }
      };
    } else {
      body.innerHTML = `<div class="alert info small mb16">${ic('lock', 16)} <span><b>Test mode.</b> No real charge is made. Connect Stripe keys to accept live card, Apple Pay and Google Pay payments.</span></div>
        <div class="pay-wallets"><button class="wallet apple" data-act="demoPay" data-method="apple_pay"><svg width="18" height="22" viewBox="0 0 17 20" fill="currentColor" aria-hidden="true"><path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.8 3.4-.8s2 .8 3.4.8 2.3-1.3 3.2-2.6c1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.3zM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>Pay</button>
          <button class="wallet google" data-act="demoPay" data-method="google_pay"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>Pay</button></div>
        <div class="divider">or pay with card</div>
        <div class="card-input"><input value="4242 4242 4242 4242" aria-label="Card number" inputmode="numeric"><input value="12 / 29" aria-label="Expiry"><input value="123" aria-label="CVC" inputmode="numeric"></div>
        <button class="btn btn-gold btn-lg btn-block mt16" data-act="demoPay" data-method="card">Pay ${money(r.amount_cents)}</button>
        <div class="secure">${ic('lock', 14)} Secured by Stripe</div>`;
    }
  }
  async function demoPay(method, btn) {
    if (!S.pending) return;
    document.querySelectorAll('[data-act="demoPay"]').forEach((b) => { b.disabled = true; });
    const old = btn.innerHTML; btn.innerHTML = '<span class="spin" style="width:18px;height:18px;border-width:2px"></span> Processing…';
    await new Promise((r) => setTimeout(r, 1100));
    try { await finishCheckout(S.pending.checkout_id, method); } catch (e) { fail(e); btn.innerHTML = old; document.querySelectorAll('[data-act="demoPay"]').forEach((b) => { b.disabled = false; }); }
  }
  async function finishCheckout(checkoutId, method) {
    const r = await api('POST', `/api/checkout/${checkoutId}/confirm`, { payment_method: method });
    S.cart = []; saveCart(); S.pending = null;
    toast('Payment successful — your order is placed!');
    go(r.orders.length === 1 ? `#/order/${r.orders[0].id}?new=1` : '#/account?new=1');
  }

  async function orderPage(id, q) {
    if (!S.user) return go('#/login');
    const { order: o } = await api('GET', `/api/orders/${id}`);
    const flow = ['placed', 'accepted', 'packing', 'ready', 'picked_up', 'delivered'];
    const idx = flow.indexOf(o.status);
    return `<div class="container section">${q.new ? `<div class="alert ok mb16">🎉 <span><b>Order confirmed!</b> ${esc(o.store_name)} will pack it in BuckDuck bags for your ${winText(o)} delivery.</span></div>` : ''}
      <div class="row between wrap"><div><a href="#/account" class="small">← All orders</a><h1 class="display mt8 mb0">Order ${esc(o.number)}</h1><div class="muted">${esc(o.store_name)} · placed ${fmtDT(o.created_at)}</div></div>${badge(o.status)}</div>
      <div class="layout-2 mt24"><div class="stack"><div class="card"><div class="row between"><div><div class="tiny muted strong">DELIVERY WINDOW</div><div class="display" style="font-size:22px">${winText(o)}</div></div><div style="font-size:40px">${o.status === 'delivered' ? '✅' : o.status === 'picked_up' ? '🚚' : '🛍️'}</div></div>
        ${idx >= 0 ? `<div class="progress-steps" style="grid-template-columns:repeat(6,1fr)">${flow.map((_, i) => `<div class="${i <= idx ? 'on' : ''}"></div>`).join('')}</div>` : ''}
        <div class="timeline mt16">${o.events.filter((e) => e.status !== 'pending_payment').map((e, i, arr) => `<div class="ev ${i < arr.length - 1 ? 'done' : 'cur'}"><div class="strong">${esc(STATUS[e.status]?.[0] || e.status)}</div><div class="tiny muted">${fmtDT(e.at)}${e.note ? ' · ' + esc(e.note) : ''}</div></div>`).join('')}</div>
        ${o.driver_name && ['ready', 'picked_up', 'delivered'].includes(o.status) ? `<div class="alert info mt8">🚚 <span>Your driver is <b>${esc(o.driver_name)}</b>${o.driver_vehicle ? ` · ${esc(o.driver_vehicle)}` : ''}</span></div>` : ''}
        ${o.status === 'placed' ? `<button class="btn btn-danger btn-sm mt16" data-act="cancelOrder" data-id="${o.id}">Cancel order</button>` : ''}</div>
        <div class="card"><h3>Items</h3>${o.items.map((i) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:24px">${esc(i.emoji || '🛒')}</span><div class="grow">${esc(i.name)} <span class="tiny muted">${esc(i.unit || '')}</span></div><span class="muted">×${i.qty}</span><span class="num" style="width:80px">${money(i.price_cents * i.qty)}</span></div>`).join('')}</div></div>
      <div class="card sticky"><h3>Receipt</h3><div class="summary-line"><span>Items</span><span>${money(o.subtotal_cents)}</span></div><div class="summary-line"><span>Delivery</span><span>${money(o.delivery_fee_cents)}</span></div>
        <div class="summary-line"><span>Service fee</span><span>${money(o.service_fee_cents)}</span></div>${o.tax_cents ? `<div class="summary-line"><span>Tax</span><span>${money(o.tax_cents)}</span></div>` : ''}<div class="summary-line"><span>Driver tip</span><span>${money(o.tip_cents)}</span></div>
        <div class="summary-line total"><span>Total</span><span>${money(o.total_cents)}</span></div><div class="small muted mt8">Paid with ${PAY[o.payment_method] || 'card'}</div>
        <div class="mt16 small"><div class="strong">Deliver to</div>${esc(o.address_line1)}${o.address_line2 ? ', ' + esc(o.address_line2) : ''}<br>${esc(o.city)}, ${esc(o.state)} ${esc(o.zip)}</div>
        <div class="mt16"><span class="bag-tag">🛍️ ${o.bags} BuckDuck bag${o.bags > 1 ? 's' : ''}</span></div></div></div></div>`;
  }

  async function accountPage(q) {
    if (!S.user) return go('#/login?next=%23%2Faccount');
    if (S.user.role !== 'customer') return go(homeFor(S.user));
    const { orders } = await api('GET', '/api/orders');
    const active = orders.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status));
    const past = orders.filter((o) => ['delivered', 'cancelled', 'refunded'].includes(o.status));
    const row = (o) => `<a class="card flat row between" href="#/order/${o.id}" style="color:inherit;text-decoration:none;margin-bottom:10px"><div class="row"><div style="width:48px;height:48px;border-radius:12px;background:${esc(o.store_color)};display:flex;align-items:center;justify-content:center;font-size:24px">${esc(o.store_emoji)}</div>
      <div><div class="strong">${esc(o.store_name)} <span class="muted tiny">${esc(o.number)}</span></div><div class="small muted">${winText(o)} · ${o.item_count} items</div></div></div><div class="row">${badge(o.status)}<span class="strong num">${money(o.total_cents)}</span></div></a>`;
    return `<div class="container section">${q.new ? '<div class="alert ok mb16">🎉 <span><b>Orders confirmed!</b> Each store will pack your items in BuckDuck bags for the same delivery window.</span></div>' : ''}
      <div class="row between wrap"><div><h1 class="display mb0">Hi, ${esc(S.user.name.split(' ')[0])}</h1><p class="muted">${esc(S.user.email)}</p></div><div class="row"><button class="btn btn-ghost btn-sm" data-act="editProfile">Edit profile</button><button class="btn btn-ghost btn-sm" data-act="logout">${ic('logout', 16)} Sign out</button></div></div>
      <h3 class="mt24">Upcoming deliveries</h3>${active.length ? active.map(row).join('') : '<div class="card flat muted">No upcoming deliveries. <a href="#/stores">Start shopping →</a></div>'}
      <h3 class="mt32">Past orders</h3>${past.length ? past.map(row).join('') : '<div class="muted">No past orders yet.</div>'}</div>`;
  }

  function loginPage(q) {
    if (S.user) return go(q.next || homeFor(S.user));
    return `<div class="auth-wrap"><div class="auth-art"><span class="eyebrow">Welcome back</span><h1 class="display" style="font-size:44px">One cart. Many stores.<br>Every Saturday.</h1><p style="opacity:.8;max-width:420px">Sign in to shop, manage your storefront, run your delivery route or operate the marketplace.</p></div>
      <div class="auth-form"><div class="inner"><h2>Sign in</h2><p class="muted">Shoppers, merchants, drivers and admins all sign in here.</p>
      <form class="stack mt16" data-form="login"><input type="hidden" name="next" value="${esc(q.next || '')}"><label class="field">Email<input class="input" type="email" name="email" required autocomplete="email"></label>
        <label class="field">Password<input class="input" type="password" name="password" required autocomplete="current-password"></label><button class="btn btn-primary btn-lg btn-block">Sign in</button></form>
      <p class="small center mt16">New to BuckDuck? <a href="#/register">Create an account</a></p>
      ${S.config.demo ? `<div class="divider">Demo accounts · password demo1234</div><div class="demo-accounts">${[['customer', '🛒 Shopper', 'Ama Mensah'], ['merchant', '🏪 Merchant', 'Accra Market'], ['driver', '🚚 Driver', 'Kwame Asante'], ['admin', '🛡️ Admin', 'Operations']]
        .map(([r, l, n]) => `<button data-act="demoAs" data-role="${r}"><b>${l}</b><br><span class="muted">${n}</span></button>`).join('')}</div>` : ''}</div></div></div>`;
  }
  function registerPage(q) {
    const role = ['customer', 'merchant', 'driver'].includes(q.role) ? q.role : 'customer';
    return `<div class="auth-wrap"><div class="auth-art"><span class="eyebrow">Join BuckDuck</span><h1 class="display" style="font-size:44px">${role === 'merchant' ? 'Open your storefront on StoreFront USA.' : role === 'driver' ? 'Earn on Saturdays with batched routes.' : 'Groceries from the stores you love.'}</h1>
      <p style="opacity:.8;max-width:420px">${role === 'merchant' ? 'List your products, receive orders all week, and pack in BuckDuck bags for Saturday pickup. Payouts via Stripe.' : role === 'driver' ? 'Pick up packed BuckDuck orders from partner stores and deliver within set windows. Base pay + 100% of tips.' : 'Shop multiple local stores in one checkout and get everything delivered in one Saturday window.'}</p></div>
      <div class="auth-form"><div class="inner"><h2>Create your account</h2>
      <div class="role-tabs">${[['customer', '🛒', 'Shop'], ['merchant', '🏪', 'Sell'], ['driver', '🚚', 'Drive']].map(([r, e, l]) => `<a class="role-tab ${r === role ? 'active' : ''}" href="#/register?role=${r}" style="color:inherit;text-decoration:none"><span class="e">${e}</span>${l}</a>`).join('')}</div>
      <form class="form-grid" data-form="register"><input type="hidden" name="role" value="${role}">
        <label class="field span6">Full name<input class="input" name="name" required autocomplete="name"></label>
        <label class="field span3">Email<input class="input" type="email" name="email" required autocomplete="email"></label>
        <label class="field span3">Phone<input class="input" name="phone" autocomplete="tel"></label>
        <label class="field span6">Password<input class="input" type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></label>
        ${role === 'merchant' ? `<label class="field span4">Store name<input class="input" name="store_name" required></label><label class="field span2">Category<select class="input" name="category"><option>African Groceries</option><option>Caribbean</option><option>Fresh Produce</option><option>Meat & Seafood</option><option>Bakery</option><option>International</option><option>Groceries</option></select></label>
          <label class="field span6">Store address<input class="input" name="address" required></label><label class="field span3">City<input class="input" name="city" required></label><label class="field span1">State<input class="input" name="state" maxlength="2" required></label><label class="field span2">ZIP<input class="input" name="zip" required></label>` : ''}
        ${role === 'driver' ? '<label class="field span6">Vehicle (make, model, color)<input class="input" name="vehicle" required placeholder="Toyota Sienna · Silver"></label>' : ''}
        <label class="check span6"><input type="checkbox" required> I agree to the BuckDuck Terms and Privacy Policy${role === 'driver' ? ' and consent to a background check' : ''}.</label>
        <button class="btn btn-primary btn-lg btn-block span6">${role === 'merchant' ? 'Submit store for approval' : role === 'driver' ? 'Apply to drive' : 'Create account'}</button></form>
      <p class="small center mt16">Already have an account? <a href="#/login">Sign in</a></p></div></div></div>`;
  }

  /* =====================================================================
     PORTAL SHELL (merchant + admin)
     ===================================================================== */
  const NAV = {
    merchant: [['', 'Dashboard', 'chart'], ['orders', 'Orders', 'list'], ['products', 'Products', 'box'], ['store', 'Storefront', 'store'], ['payouts', 'Payouts', 'dollar']],
    admin: [['', 'Overview', 'chart'], ['orders', 'Orders', 'list'], ['dispatch', 'Dispatch', 'truck'], ['stores', 'Stores', 'store'], ['users', 'Users', 'users'], ['drivers', 'Drivers', 'truck'], ['windows', 'Delivery windows', 'cal'], ['finance', 'Finance', 'dollar'], ['settings', 'Settings', 'cog']]
  };
  function portalShell(parts, content) {
    const area = parts[0]; const cur = parts[1] || '';
    const sub = area === 'admin' ? 'Admin Console' : 'Merchant Portal';
    return `<div class="portal"><aside class="sidebar" id="sidebar">${logo(sub, `#/${area}`)}
      ${area === 'merchant' && S.myStore ? `<div class="card" style="background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);padding:12px;box-shadow:none;color:#fff"><div class="row"><div style="width:40px;height:40px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden">${storeAvatar(S.myStore)}</div><div style="min-width:0"><div class="strong small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(S.myStore.name)}</div><div class="tiny" style="opacity:.7">${S.myStore.status === 'active' ? '● Live' : S.myStore.status === 'pending' ? '◌ Pending approval' : '✕ Suspended'}</div></div></div></div>` : ''}
      <div class="side-sec">Menu</div>${NAV[area].map(([p, l, i]) => `<a class="side-link ${cur === p ? 'active' : ''}" href="#/${area}${p ? '/' + p : ''}">${ic(i)}${l}</a>`).join('')}
      ${area === 'merchant' && S.myStore?.status === 'active' ? `<div class="side-sec">Public</div><a class="side-link" href="#/store/${esc(S.myStore.slug)}">${ic('home')}View my storefront</a>` : ''}
      <div class="side-foot"><div class="row"><div class="avatar-sm">${initials(S.user.name)}</div><div style="min-width:0"><div class="strong small">${esc(S.user.name)}</div><div class="tiny" style="opacity:.6">${esc(S.user.email)}</div></div></div>
      <button class="btn btn-sm btn-block mt16" style="background:rgba(255,255,255,.08);color:#fff" data-act="logout">${ic('logout', 16)} Sign out</button></div></aside>
      <div class="main"><div class="main-top no-print"><div class="row"><button class="icon-btn mobile-toggle" data-act="toggleSide" aria-label="Menu">${ic('menu')}</button><div class="strong">${esc((NAV[area].find(([p]) => p === cur) || [])[1] || '')}</div></div>
      <div class="row"><span class="badge b-gold hide-sm">${ic('truck', 14)} Next: ${S.config.next_window ? fmtDate(S.config.next_window.date) : '—'}</span><a class="btn btn-ghost btn-sm" href="#/">Marketplace</a></div></div>
      <div class="main-body">${content}</div></div></div>`;
  }

  /* =====================================================================
     MERCHANT PORTAL
     ===================================================================== */
  async function merchantPage(parts, q) {
    const sub = parts[1] || '';
    await loadMe();
    if (sub === '') return merchantDash();
    if (sub === 'orders') return merchantOrders(q);
    if (sub === 'products') return merchantProducts();
    if (sub === 'store') return merchantStore();
    if (sub === 'payouts') return merchantPayouts(q);
    throw new Error('Page not found');
  }
  async function merchantDash() {
    const d = await api('GET', '/api/merchant/summary');
    const c = d.counts;
    const pendingBanner = d.store.status === 'pending' ? '<div class="alert warn mb16">⏳ <span><b>Your store is pending approval.</b> Add products and set up your storefront now — you will go live as soon as BuckDuck operations approves your store.</span></div>' : '';
    return `${pendingBanner}<div class="page-h"><div><h1>Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${esc(S.user.name.split(' ')[0])}</h1><p>Next delivery day: <b>${fmtDate(d.next_delivery_date, { weekday: 'long', month: 'long', day: 'numeric' })}</b> — have all orders packed and marked ready by the window start.</p></div>
      <a class="btn btn-primary" href="#/merchant/orders">${ic('list', 16)} Open order queue</a></div>
      <div class="grid g4 kpis"><div class="card kpi"><div class="lbl">New orders</div><div class="val">${c.placed || 0}</div><div class="sub">Need to be accepted</div></div>
        <div class="card kpi"><div class="lbl">In progress</div><div class="val">${(c.accepted || 0) + (c.packing || 0)}</div><div class="sub">Accepted & packing</div></div>
        <div class="card kpi"><div class="lbl">Ready for pickup</div><div class="val">${c.ready || 0}</div><div class="sub">Awaiting driver</div></div>
        <div class="card kpi"><div class="lbl">BuckDuck bags needed</div><div class="val">${d.bags_needed}</div><div class="sub">For ${fmtDate(d.next_delivery_date)}</div></div></div>
      <div class="grid mt16" style="grid-template-columns:2fr 1fr"><div class="card"><div class="card-h"><h3>Weekly sales</h3><span class="muted small">Merchandise sales by delivery day</span></div>${barChart(d.weekly.map((w) => ({ ...w, lbl: fmtDate(w.date, { month: 'short', day: 'numeric' }) })), { valueKey: 'sales', labelKey: 'lbl', tipLabel: 'Sales' })}</div>
        <div class="card"><h3>Lifetime</h3><div class="summary-line"><span>Delivered orders</span><b>${d.totals.orders}</b></div><div class="summary-line"><span>Gross sales</span><b>${money(d.totals.sales)}</b></div><div class="summary-line"><span>Commission (${pct(d.store.commission_rate)})</span><b>−${money(d.totals.sales - d.totals.payout)}</b></div><div class="summary-line total"><span>Your earnings</span><span>${money(d.totals.payout)}</span></div></div></div>
      <div class="grid g2 mt16"><div class="card"><h3>Top products</h3>${d.top_products.length ? d.top_products.map((p) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:22px">${esc(p.emoji)}</span><span class="grow">${esc(p.name)}</span><span class="muted small">${p.qty} sold</span><b class="num" style="width:90px">${money(p.revenue)}</b></div>`).join('') : '<div class="muted">No sales yet</div>'}</div>
        <div class="card"><div class="card-h"><h3>Low stock</h3><a href="#/merchant/products" class="small strong">Manage →</a></div>${d.low_stock.length ? d.low_stock.map((p) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:22px">${esc(p.emoji)}</span><span class="grow">${esc(p.name)}</span><span class="badge ${p.stock < 5 ? 'b-red' : 'b-amber'}">${p.stock} left</span></div>`).join('') : '<div class="muted">All products are well stocked 👍</div>'}</div></div>`;
  }
  async function merchantOrders(q) {
    const scope = q.scope || 'upcoming';
    const { orders } = await api('GET', '/api/merchant/orders', { scope });
    if (scope !== 'upcoming') {
      return `<div class="page-h"><div><h1>Orders</h1><p>Full order history</p></div><div class="row"><a class="btn btn-ghost btn-sm" href="#/merchant/orders">Upcoming queue</a></div></div>
        <div class="card pad0"><div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Delivery</th><th>Customer</th><th>Items</th><th>Status</th><th class="num">Subtotal</th></tr></thead><tbody>
        ${orders.map((o) => `<tr class="click" data-act="orderModal" data-id="${o.id}"><td class="strong">${esc(o.number)}</td><td>${winText(o)}</td><td>${esc(o.customer_name)}</td><td>${o.item_count}</td><td>${badge(o.status)}</td><td class="num">${money(o.subtotal_cents)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    const cols = [['placed', 'New', 'Accept', 'accepted'], ['accepted', 'Accepted', 'Start packing', 'packing'], ['packing', 'Packing', 'Mark ready', 'ready'], ['ready', 'Ready for pickup', '', '']];
    return `<div class="page-h"><div><h1>Order queue</h1><p>Move each order across: accept → pack into BuckDuck bags → mark ready for driver pickup.</p></div><div class="row"><a class="btn btn-ghost btn-sm" href="#/merchant/orders?scope=all">History</a><button class="btn btn-ghost btn-sm" data-act="printPickList">${ic('list', 16)} Pick list</button></div></div>
      <div class="kanban">${cols.map(([st, label, act, next]) => { const list = orders.filter((o) => o.status === st); return `<div class="kanban-col"><h4>${label} <span class="badge ${STATUS[st][1]}">${list.length}</span></h4>
        ${list.map((o) => `<div class="order-card mb16" style="margin-bottom:10px"><div class="row between"><b>${esc(o.number)}</b><span class="tiny muted">${fmtDate(o.window_date)} · ${fmtT(o.window_start)}</span></div>
          <div class="small">${esc(o.customer_name)} · ${o.item_count} items</div><div class="row between"><span class="bag-tag">🛍️ ${o.bags}</span><b>${money(o.subtotal_cents)}</b></div>
          ${st === 'ready' && o.driver_name ? `<div class="tiny muted">🚚 ${esc(o.driver_name)} assigned</div>` : ''}
          <div class="row"><button class="btn btn-ghost btn-sm grow" data-act="orderModal" data-id="${o.id}">Details</button>${act ? `<button class="btn btn-primary btn-sm grow" data-act="mStatus" data-id="${o.id}" data-status="${next}" data-bags="${o.bags}">${act}</button>` : ''}</div></div>`).join('') || '<div class="tiny muted center" style="padding:20px">No orders</div>'}</div>`; }).join('')}</div>`;
  }
  async function merchantProducts() {
    const { products } = await api('GET', '/api/merchant/products');
    S.mProducts = products;
    return `<div class="page-h"><div><h1>Products</h1><p>${products.filter((p) => p.active).length} active listings on your storefront</p></div><button class="btn btn-gold" data-act="editProduct" data-id="">${ic('plus', 16)} Add product</button></div>
      <div class="card pad0"><div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th>Category</th><th class="num">Price</th><th>Unit</th><th class="num">Stock</th><th>Status</th><th></th></tr></thead><tbody>
      ${products.map((p) => `<tr><td><div class="row"><div style="width:44px;height:44px;border-radius:10px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;flex:none">${productImg(p)}</div><b>${esc(p.name)}</b></div></td>
        <td>${esc(p.category)}</td><td class="num">${money(p.price_cents)}</td><td class="muted">${esc(p.unit || '')}</td><td class="num"><span class="badge ${p.stock < 5 ? 'b-red' : p.stock < 15 ? 'b-amber' : 'b-green'}">${p.stock}</span></td>
        <td>${p.active ? '<span class="badge b-green">Live</span>' : '<span class="badge b-gray">Hidden</span>'}</td><td class="right"><button class="btn btn-ghost btn-sm" data-act="editProduct" data-id="${p.id}">Edit</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function productForm(p = {}) {
    return `<form class="form-grid" data-form="product" data-id="${p.id || ''}">
      <label class="field span4">Product name<input class="input" name="name" required value="${esc(p.name || '')}"></label><label class="field span2">Emoji icon<input class="input" name="emoji" value="${esc(p.emoji || '🛒')}" maxlength="4"></label>
      <label class="field span2">Price ($)<input class="input" name="price" type="number" step="0.01" min="0.01" required value="${p.price_cents ? (p.price_cents / 100).toFixed(2) : ''}"></label>
      <label class="field span2">Unit<input class="input" name="unit" value="${esc(p.unit || '')}" placeholder="per lb, 4 pack…"></label><label class="field span2">Stock<input class="input" name="stock" type="number" min="0" value="${p.stock ?? 25}"></label>
      <label class="field span3">Category<input class="input" name="category" value="${esc(p.category || '')}" placeholder="Produce, Pantry…"></label>
      <label class="field span3">Photo<input class="input" type="file" name="image" accept="image/*"></label>
      <label class="field span6">Description<textarea class="input" name="description">${esc(p.description || '')}</textarea></label>
      <label class="check span6"><input type="checkbox" name="active" ${p.active === 0 ? '' : 'checked'}> Visible on my storefront</label></form>`;
  }
  async function merchantStore() {
    const { store: s } = await api('GET', '/api/merchant/store');
    return `<div class="page-h"><div><h1>Storefront</h1><p>How your store appears to shoppers on StoreFront USA.</p></div>${s.status === 'active' ? `<a class="btn btn-ghost" href="#/store/${esc(s.slug)}">View live store →</a>` : ''}</div>
      <div class="grid" style="grid-template-columns:1.4fr 1fr"><form class="card form-grid" data-form="storeProfile">
        <label class="field span4">Store name<input class="input" name="name" required value="${esc(s.name)}"></label><label class="field span2">Category<input class="input" name="category" value="${esc(s.category || '')}"></label>
        <label class="field span6">Tagline<input class="input" name="tagline" value="${esc(s.tagline || '')}" maxlength="120"></label>
        <label class="field span6">About your store<textarea class="input" name="description">${esc(s.description || '')}</textarea></label>
        <label class="field span6">Street address<input class="input" name="address" value="${esc(s.address || '')}"></label>
        <label class="field span3">City<input class="input" name="city" value="${esc(s.city || '')}"></label><label class="field span1">State<input class="input" name="state" maxlength="2" value="${esc(s.state || '')}"></label><label class="field span2">ZIP<input class="input" name="zip" value="${esc(s.zip || '')}"></label>
        <label class="field span2">Phone<input class="input" name="phone" value="${esc(s.phone || '')}"></label><label class="field span2">Brand color<input class="input" type="color" name="color" value="${esc(s.color || '#1E3A8A')}" style="height:46px;padding:4px"></label><label class="field span2">Icon<input class="input" name="emoji" value="${esc(s.emoji || '🛒')}" maxlength="4"></label>
        <label class="field span6">Logo image<input class="input" type="file" name="logo" accept="image/*"></label>
        <div class="span6"><button class="btn btn-primary">Save storefront</button></div></form>
        <div><div class="small strong muted mb16" style="margin-bottom:8px">PREVIEW</div>${storeCard({ ...s, product_count: '—' }).replace('<a ', '<div ').replace(/<\/a>$/, '</div>')}
        <div class="card mt16"><h4>Status</h4>${s.status === 'active' ? '<span class="badge b-green">Live on marketplace</span>' : s.status === 'pending' ? '<span class="badge b-amber">Pending review</span><p class="small muted mt8 mb0">Our team reviews new stores within 1–2 business days.</p>' : '<span class="badge b-red">Suspended</span>'}
        <div class="summary-line mt16"><span>Commission rate</span><b>${pct(s.commission_rate)}</b></div><div class="summary-line"><span>Store URL</span><span class="small">/store/${esc(s.slug)}</span></div></div></div></div>`;
  }
  async function merchantPayouts(q) {
    const d = await api('GET', '/api/merchant/payouts');
    const connected = d.store.stripe_charges_enabled;
    return `<div class="page-h"><div><h1>Payouts</h1><p>Earnings are transferred to your bank through Stripe after each order is delivered.</p></div></div>
      <div class="grid g3"><div class="card kpi"><div class="lbl">Pending earnings</div><div class="val">${money(d.pending_cents)}</div><div class="sub">Orders not yet delivered</div></div>
        <div class="card kpi"><div class="lbl">Paid out (last 26 wks)</div><div class="val">${money(d.weeks.reduce((a, w) => a + w.net, 0))}</div><div class="sub">After ${pct(d.store.commission_rate)} commission</div></div>
        <div class="card"><h4>Bank account</h4>${connected ? `<span class="badge b-green">Stripe connected</span><p class="small muted">${esc(d.store.stripe_account_id)}</p>` : '<p class="small muted">Connect a bank account with Stripe to receive automatic payouts.</p>'}
          <button class="btn ${connected ? 'btn-ghost' : 'btn-gold'} btn-sm" data-act="stripeOnboard">${connected ? 'Open Stripe dashboard' : 'Connect with Stripe'}</button></div></div>
      <div class="card pad0 mt16"><div class="table-wrap"><table class="table"><thead><tr><th>Delivery day</th><th class="num">Orders</th><th class="num">Gross sales</th><th class="num">Commission</th><th class="num">Net payout</th><th>Status</th></tr></thead><tbody>
      ${d.weeks.map((w) => `<tr><td class="strong">${fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td><td class="num">${w.orders}</td><td class="num">${money(w.gross)}</td><td class="num">−${money(w.commission)}</td><td class="num strong">${money(w.net)}</td>
        <td>${w.transferred ? '<span class="badge b-green">Transferred</span>' : d.payments_mode === 'stripe' ? '<span class="badge b-amber">Pending</span>' : '<span class="badge b-green">Settled</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted center">No delivered orders yet</td></tr>'}</tbody></table></div></div>`;
  }

  /* ---- shared order modal (merchant/admin) ---- */
  async function orderModal(id) {
    const { order: o } = await api('GET', `/api/orders/${id}`);
    const role = S.user.role;
    let extra = '', foot = CAN_PRINT ? `<button class="btn btn-ghost" data-act="printOrder">${ic('print', 16)} Print packing slip</button>` : '';
    if (role === 'merchant') {
      const nx = { placed: [['accepted', 'Accept order'], ['cancelled', 'Decline & refund']], accepted: [['packing', 'Start packing'], ['cancelled', 'Cancel & refund']], packing: [['ready', 'Mark ready for pickup']] }[o.status] || [];
      foot += nx.map(([s, l]) => `<button class="btn ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}" data-act="mStatus" data-id="${o.id}" data-status="${s}" data-bags="${o.bags}">${l}</button>`).join('');
    }
    if (role === 'admin') {
      const { drivers } = await api('GET', '/api/admin/drivers');
      extra = `<div class="card flat mt16" style="background:var(--surface-2)"><h4>Operations</h4><div class="form-grid">
        <label class="field span3">Assigned driver<select class="input" id="adm-driver"><option value="">— Unassigned —</option>${drivers.filter((d) => d.status === 'active').map((d) => `<option value="${d.id}" ${d.id === o.driver_id ? 'selected' : ''}>${esc(d.name)}${d.driver_online ? ' (online)' : ''}</option>`).join('')}</select></label>
        <label class="field span3">Status override<select class="input" id="adm-status">${['placed', 'accepted', 'packing', 'ready', 'picked_up', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS[s][0]}</option>`).join('')}</select></label></div></div>`;
      foot += `${!['refunded', 'cancelled'].includes(o.status) ? `<button class="btn btn-danger" data-act="adminRefund" data-id="${o.id}" data-total="${o.total_cents}">Refund</button>` : ''}<button class="btn btn-primary" data-act="adminSaveOrder" data-id="${o.id}">Save changes</button>`;
    }
    const money2 = role === 'merchant'
      ? `<div class="summary-line"><span>Merchandise</span><b>${money(o.subtotal_cents)}</b></div><div class="summary-line"><span>BuckDuck commission</span><span>−${money(o.commission_cents)}</span></div><div class="summary-line total"><span>Your payout</span><span>${money(o.subtotal_cents - o.commission_cents)}</span></div>`
      : `<div class="summary-line"><span>Items</span><span>${money(o.subtotal_cents)}</span></div><div class="summary-line"><span>Delivery + service</span><span>${money(o.delivery_fee_cents + o.service_fee_cents)}</span></div><div class="summary-line"><span>Tip</span><span>${money(o.tip_cents)}</span></div><div class="summary-line total"><span>Customer paid</span><span>${money(o.total_cents)}</span></div><div class="summary-line"><span>Merchant payout</span><span>${money(o.subtotal_cents - o.commission_cents)}</span></div><div class="summary-line"><span>Driver pay</span><span>${money(o.driver_pay_cents)}</span></div>`;
    modal(`Order ${esc(o.number)} ${badge(o.status)}`, `<div class="print-area"><div class="grid g2"><div><div class="tiny muted strong">DELIVERY</div><div class="strong">${winText(o)}</div><div class="small">${esc(o.customer_name)} · ${esc(o.phone || '')}</div><div class="small muted">${esc(o.address_line1)}${o.address_line2 ? ', ' + esc(o.address_line2) : ''}, ${esc(o.city)} ${esc(o.zip)}</div>${o.notes ? `<div class="small mt8">📝 ${esc(o.notes)}</div>` : ''}</div>
      <div><div class="tiny muted strong">STORE</div><div class="strong">${esc(o.store_name)}</div><div class="small muted">${esc(o.store_address || '')}</div><div class="mt8"><span class="bag-tag">🛍️ ${o.bags} BuckDuck bag${o.bags > 1 ? 's' : ''}</span></div>${o.driver_name ? `<div class="small mt8">🚚 ${esc(o.driver_name)}</div>` : ''}</div></div>
      <table class="table mt16"><thead><tr><th>✓</th><th>Item</th><th>Unit</th><th class="num">Qty</th><th class="num">Price</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>☐</td><td>${esc(i.emoji || '')} ${esc(i.name)}</td><td class="muted small">${esc(i.unit || '')}</td><td class="num strong">${i.qty}</td><td class="num">${money(i.price_cents * i.qty)}</td></tr>`).join('')}</tbody></table>
      <div class="grid g2 mt16"><div class="timeline">${o.events.map((e) => `<div class="ev done"><div class="small strong">${esc(STATUS[e.status]?.[0] || e.status)}</div><div class="tiny muted">${fmtDT(e.at)}${e.note ? ' · ' + esc(e.note) : ''}</div></div>`).join('')}</div><div>${money2}${o.proof_note ? `<div class="alert ok mt16 small">📸 ${esc(o.proof_note)}</div>` : ''}</div></div></div>${extra}`, foot, true);
  }

  /* =====================================================================
     ADMIN CONSOLE
     ===================================================================== */
  async function adminPage(parts, q) {
    const sub = parts[1] || '';
    const pages = { '': adminOverview, orders: adminOrders, dispatch: adminDispatch, stores: adminStores, users: adminUsers, drivers: adminDrivers, windows: adminWindows, finance: adminFinance, settings: adminSettings };
    if (!pages[sub]) throw new Error('Page not found');
    return pages[sub](q);
  }
  async function adminOverview() {
    const d = await api('GET', '/api/admin/overview');
    const t = d.totals, c = d.counts, st = d.statuses;
    const nextDate = d.windows[0]?.date;
    const totalMix = d.payment_mix.reduce((a, x) => a + x.c, 0) || 1;
    return `<div class="page-h"><div><h1>Marketplace overview</h1><p>Live operations for ${nextDate ? fmtDate(nextDate, { weekday: 'long', month: 'long', day: 'numeric' }) : 'the next delivery day'}</p></div><div class="row"><a class="btn btn-ghost" href="#/admin/dispatch">${ic('truck', 16)} Dispatch board</a></div></div>
      ${c.pending_stores ? `<div class="alert warn mb16">🏪 <span><b>${c.pending_stores} store${c.pending_stores > 1 ? 's' : ''} awaiting approval.</b> <a href="#/admin/stores">Review now →</a></span></div>` : ''}
      ${c.unassigned_ready ? `<div class="alert info mb16">🚚 <span><b>${c.unassigned_ready} ready orders have no driver.</b> <a href="#/admin/dispatch">Assign drivers →</a></span></div>` : ''}
      <div class="grid g4 kpis"><div class="card kpi"><div class="lbl">Gross merchandise value</div><div class="val">${money0(t.gmv)}</div><div class="sub">All paid orders</div></div>
        <div class="card kpi"><div class="lbl">Net revenue</div><div class="val">${money0(t.net_revenue)}</div><div class="sub">Commission + fees − driver base pay</div></div>
        <div class="card kpi"><div class="lbl">Orders</div><div class="val">${t.orders.toLocaleString()}</div><div class="sub">${c.customers} customers</div></div>
        <div class="card kpi"><div class="lbl">Avg order value</div><div class="val">${money(t.aov)}</div><div class="sub">${c.stores} live stores · ${c.drivers_online}/${c.drivers} drivers online</div></div></div>
      <div class="grid mt16" style="grid-template-columns:2fr 1fr"><div class="card"><div class="card-h"><h3>GMV by delivery day</h3><span class="small muted">Hover a bar for detail</span></div>${barChart(d.weekly.map((w) => ({ ...w, lbl: fmtDate(w.date, { month: 'short', day: 'numeric' }) })), { valueKey: 'gmv', labelKey: 'lbl', tipLabel: 'GMV' })}</div>
        <div class="card"><h3>This Saturday's pipeline</h3>${['placed', 'accepted', 'packing', 'ready', 'picked_up'].map((s) => `<div class="summary-line"><span>${badge(s)}</span><b>${st[s] || 0}</b></div>`).join('')}
          <h4 class="mt16">Window capacity</h4>${d.windows.slice(0, 2).map((w) => `<div class="mt8"><div class="row between small"><span>${esc(w.label)}</span><span class="muted">${w.booked}/${w.capacity}</span></div><div class="cap mt8"><i class="${w.booked / w.capacity > 0.8 ? 'hot' : ''}" style="width:${Math.min(100, (w.booked / w.capacity) * 100)}%"></i></div></div>`).join('')}</div></div>
      <div class="grid g2 mt16"><div class="card"><h3>Top stores</h3><table class="table"><tbody>${d.top_stores.map((s) => `<tr><td><span style="font-size:20px">${esc(s.emoji)}</span> <b>${esc(s.name)}</b></td><td class="num muted">${s.orders} orders</td><td class="num strong">${money0(s.sales)}</td></tr>`).join('')}</tbody></table></div>
        <div class="card"><h3>Payment methods</h3>${d.payment_mix.sort((a, b) => b.c - a.c).map((m) => `<div class="mt8"><div class="row between small"><span>${PAY[m.method] || esc(m.method)}</span><span class="muted">${Math.round((m.c / totalMix) * 100)}%</span></div><div class="cap mt8"><i style="width:${(m.c / totalMix) * 100}%"></i></div></div>`).join('')}</div></div>`;
  }
  async function adminOrders(q) {
    const { orders } = await api('GET', '/api/admin/orders', { status: q.status || '', q: q.q || '' });
    return `<div class="page-h"><div><h1>Orders</h1><p>${orders.length} orders shown</p></div><form class="row" data-form="adminOrderSearch"><input class="input" name="q" placeholder="Search order #, customer, store" value="${esc(q.q || '')}" style="width:280px"><button class="btn btn-primary btn-sm">Search</button></form></div>
      <div class="tabs">${[['', 'All'], ['placed', 'New'], ['accepted', 'Accepted'], ['packing', 'Packing'], ['ready', 'Ready'], ['picked_up', 'Out for delivery'], ['delivered', 'Delivered'], ['refunded', 'Refunded'], ['cancelled', 'Cancelled']]
        .map(([s, l]) => `<a class="tab ${(q.status || '') === s ? 'active' : ''}" href="#/admin/orders${s ? '?status=' + s : ''}">${l}</a>`).join('')}</div>
      <div class="card pad0"><div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Delivery window</th><th>Customer</th><th>Store</th><th>Driver</th><th>Payment</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
      ${orders.map((o) => `<tr class="click" data-act="orderModal" data-id="${o.id}"><td class="strong">${esc(o.number)}</td><td class="small">${winText(o)}</td><td>${esc(o.customer_name)}</td><td>${esc(o.store_emoji)} ${esc(o.store_name)}</td><td class="small">${o.driver_name ? esc(o.driver_name) : '<span class="muted">—</span>'}</td><td class="small">${PAY[o.payment_method] || ''}</td><td>${badge(o.status)}</td><td class="num">${money(o.total_cents)}</td></tr>`).join('') || '<tr><td colspan="8" class="center muted">No orders</td></tr>'}
      </tbody></table></div></div>`;
  }
  async function adminDispatch() {
    const [{ orders }, { drivers }] = await Promise.all([api('GET', '/api/admin/orders', { status: 'ready' }), api('GET', '/api/admin/drivers')]);
    const { orders: out } = await api('GET', '/api/admin/orders', { status: 'picked_up' });
    const unassigned = orders.filter((o) => !o.driver_id);
    const active = drivers.filter((d) => d.status === 'active');
    return `<div class="page-h"><div><h1>Dispatch board</h1><p>Assign packed orders to drivers and monitor routes for delivery day.</p></div></div>
      <div class="grid" style="grid-template-columns:1.3fr 1fr"><div class="card"><div class="card-h"><h3>Ready — needs driver</h3><span class="badge b-gold">${unassigned.length}</span></div>
        ${unassigned.map((o) => `<div class="row" style="padding:10px 0;border-top:1px solid var(--line)"><div class="grow"><b>${esc(o.number)}</b> <span class="tiny muted">${winText(o)}</span><div class="small">${esc(o.store_name)} → ${esc(o.zip)} · 🛍️ ${o.bags}</div></div>
          <select class="input" style="width:180px" data-assign="${o.id}"><option value="">Assign driver…</option>${active.map((d) => `<option value="${d.id}">${esc(d.name)}${d.driver_online ? ' ●' : ''} (${d.active})</option>`).join('')}</select></div>`).join('') || '<div class="empty small">All ready orders are assigned ✓</div>'}</div>
        <div class="card"><h3>Drivers</h3>${active.map((d) => `<div class="row" style="padding:10px 0;border-top:1px solid var(--line)"><div class="avatar-sm">${initials(d.name)}</div><div class="grow"><b>${esc(d.name)}</b><div class="tiny muted">${esc(d.vehicle || '')}</div></div><span class="badge ${d.driver_online ? 'b-green' : 'b-gray'}">${d.driver_online ? 'Online' : 'Offline'}</span><span class="small strong">${d.active} stops</span></div>`).join('')}</div></div>
      <div class="card mt16"><h3>Out for delivery</h3>${out.length ? `<table class="table"><tbody>${out.map((o) => `<tr class="click" data-act="orderModal" data-id="${o.id}"><td class="strong">${esc(o.number)}</td><td>${esc(o.driver_name || '')}</td><td>${esc(o.store_name)} → ${esc(o.address_line1)}</td><td>${winText(o)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted small">No orders on the road right now.</div>'}</div>`;
  }
  async function adminStores() {
    const { stores } = await api('GET', '/api/admin/stores');
    return `<div class="page-h"><div><h1>Stores</h1><p>Approve new merchants, set commission and manage storefronts.</p></div></div>
      <div class="card pad0"><div class="table-wrap"><table class="table"><thead><tr><th>Store</th><th>Owner</th><th>Category</th><th class="num">Products</th><th class="num">Delivered</th><th class="num">Sales</th><th>Commission</th><th>Status</th><th></th></tr></thead><tbody>
      ${stores.map((s) => `<tr><td><div class="row"><div style="width:38px;height:38px;border-radius:10px;background:${esc(s.color)};display:flex;align-items:center;justify-content:center;font-size:20px">${esc(s.emoji)}</div><div><b>${esc(s.name)}</b><div class="tiny muted">${esc(s.city || '')}, ${esc(s.state || '')}</div></div></div></td>
        <td class="small">${esc(s.owner_name)}<div class="tiny muted">${esc(s.owner_email)}</div></td><td class="small">${esc(s.category)}</td><td class="num">${s.product_count}</td><td class="num">${s.delivered_orders}</td><td class="num">${money0(s.sales_cents)}</td>
        <td><div class="row" style="gap:4px"><input class="input" style="width:70px;padding:6px 8px" type="number" step="0.5" min="0" max="50" value="${Math.round(s.commission_rate * 1000) / 10}" data-commission="${s.id}"><span class="small">%</span></div></td>
        <td>${s.status === 'active' ? '<span class="badge b-green">Live</span>' : s.status === 'pending' ? '<span class="badge b-amber">Pending</span>' : '<span class="badge b-red">Suspended</span>'}</td>
        <td class="right" style="white-space:nowrap">${s.status !== 'active' ? `<button class="btn btn-success btn-sm" data-act="storeStatus" data-id="${s.id}" data-status="active">${s.status === 'pending' ? 'Approve' : 'Reinstate'}</button>` : `<button class="btn btn-danger btn-sm" data-act="storeStatus" data-id="${s.id}" data-status="suspended">Suspend</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  async function adminUsers(q) {
    const { users } = await api('GET', '/api/admin/users', { role: q.role || '', q: q.q || '' });
    return `<div class="page-h"><div><h1>Users</h1><p>${users.length} accounts</p></div><form class="row" data-form="adminUserSearch"><input class="input" name="q" placeholder="Search name or email" value="${esc(q.q || '')}" style="width:240px"><input type="hidden" name="role" value="${esc(q.role || '')}"><button class="btn btn-primary btn-sm">Search</button></form></div>
      <div class="tabs">${[['', 'All'], ['customer', 'Customers'], ['merchant', 'Merchants'], ['driver', 'Drivers'], ['admin', 'Admins']].map(([r, l]) => `<a class="tab ${(q.role || '') === r ? 'active' : ''}" href="#/admin/users${r ? '?role=' + r : ''}">${l}</a>`).join('')}</div>
      <div class="card pad0"><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th class="num">Orders</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr><td><div class="row"><div class="avatar-sm">${initials(u.name)}</div><b>${esc(u.name)}</b></div></td><td class="small">${esc(u.email)}</td><td><span class="badge ${{ customer: 'b-blue', merchant: 'b-purple', driver: 'b-gold', admin: 'b-gray' }[u.role]}">${u.role}</span></td>
        <td class="small">${esc(u.phone || '')}</td><td class="num">${u.role === 'customer' ? u.order_count : '—'}</td><td class="small muted">${fmtDate(u.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td>${u.status === 'active' ? '<span class="badge b-green">Active</span>' : '<span class="badge b-red">Suspended</span>'}</td>
        <td class="right">${u.id !== S.user.id ? `<button class="btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}" data-act="userStatus" data-id="${u.id}" data-status="${u.status === 'active' ? 'suspended' : 'active'}">${u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  async function adminDrivers() {
    const { drivers } = await api('GET', '/api/admin/drivers');
    return `<div class="page-h"><div><h1>Drivers</h1><p>${drivers.filter((d) => d.driver_online).length} online now · ${drivers.length} total</p></div></div>
      <div class="grid g3">${drivers.map((d) => `<div class="card"><div class="row"><div class="avatar-sm" style="width:46px;height:46px">${initials(d.name)}</div><div class="grow"><b>${esc(d.name)}</b><div class="tiny muted">${esc(d.vehicle || '')}</div></div><span class="badge ${d.status !== 'active' ? 'b-red' : d.driver_online ? 'b-green' : 'b-gray'}">${d.status !== 'active' ? 'Suspended' : d.driver_online ? 'Online' : 'Offline'}</span></div>
        <div class="grid g3 mt16 center"><div><div class="strong">${d.deliveries}</div><div class="tiny muted">Delivered</div></div><div><div class="strong">${d.active}</div><div class="tiny muted">Active stops</div></div><div><div class="strong">${money0(d.earnings)}</div><div class="tiny muted">Earned</div></div></div>
        <div class="small muted mt16">${esc(d.email)} · ${esc(d.phone || '')}</div></div>`).join('')}</div>`;
  }
  async function adminWindows() {
    const { windows } = await api('GET', '/api/admin/windows');
    return `<div class="page-h"><div><h1>Delivery windows</h1><p>Deliveries run on <b>${DAYS[S.config.delivery_weekday]}s</b>. Windows are published automatically several weeks ahead — adjust capacity, pause, or add special windows.</p></div><button class="btn btn-gold" data-act="addWindow">${ic('plus', 16)} Add window</button></div>
      <div class="card pad0"><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Window</th><th>Order cutoff</th><th style="width:240px">Booked</th><th>Capacity</th><th>Status</th><th></th></tr></thead><tbody>
      ${windows.map((w) => `<tr><td class="strong">${fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td><td>${esc(w.label)}</td><td class="small muted">${fmtDT(w.cutoff)}</td>
        <td><div class="row"><div class="cap grow"><i class="${w.booked / w.capacity > 0.8 ? 'hot' : ''}" style="width:${Math.min(100, (w.booked / (w.capacity || 1)) * 100)}%"></i></div><span class="small">${w.booked}</span></div></td>
        <td><input class="input" type="number" min="0" style="width:90px;padding:6px 8px" value="${w.capacity}" data-wcap="${w.id}"></td>
        <td>${!w.active ? '<span class="badge b-gray">Paused</span>' : w.open ? '<span class="badge b-green">Open</span>' : '<span class="badge b-amber">Closed</span>'}</td>
        <td class="right"><button class="btn btn-ghost btn-sm" data-act="toggleWindow" data-id="${w.id}" data-active="${w.active ? 0 : 1}">${w.active ? 'Pause' : 'Resume'}</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  async function adminFinance() {
    const { weeks, refunds } = await api('GET', '/api/admin/finance');
    const sum = (k) => weeks.reduce((a, w) => a + (w[k] || 0), 0);
    return `<div class="page-h"><div><h1>Finance</h1><p>Settlement by delivery day (delivered orders)</p></div></div>
      <div class="grid g4 kpis"><div class="card kpi"><div class="lbl">GMV</div><div class="val">${money0(sum('gmv'))}</div></div><div class="card kpi"><div class="lbl">Net revenue</div><div class="val">${money0(sum('net_revenue'))}</div></div>
        <div class="card kpi"><div class="lbl">Merchant payouts</div><div class="val">${money0(sum('merchant_payouts'))}</div></div><div class="card kpi"><div class="lbl">Refunds</div><div class="val">${money0(refunds.amt)}</div><div class="sub">${refunds.c} orders</div></div></div>
      <div class="card mt16"><div class="card-h"><h3>Net revenue by delivery day</h3></div>${barChart([...weeks].reverse().map((w) => ({ ...w, lbl: fmtDate(w.date, { month: 'short', day: 'numeric' }) })), { valueKey: 'net_revenue', labelKey: 'lbl', color: 'var(--gold-600)', tipLabel: 'Net revenue' })}</div>
      <div class="card pad0 mt16"><div class="table-wrap"><table class="table"><thead><tr><th>Delivery day</th><th class="num">Orders</th><th class="num">GMV</th><th class="num">Commission</th><th class="num">Service fees</th><th class="num">Delivery fees</th><th class="num">Driver pay</th><th class="num">Merchant payouts</th><th class="num">Net revenue</th></tr></thead><tbody>
      ${weeks.map((w) => `<tr><td class="strong">${fmtDate(w.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td class="num">${w.orders}</td><td class="num">${money(w.gmv)}</td><td class="num">${money(w.commission)}</td><td class="num">${money(w.service_fees)}</td><td class="num">${money(w.delivery_fees)}</td><td class="num">${money(w.driver_pay)}</td><td class="num">${money(w.merchant_payouts)}</td><td class="num strong">${money(w.net_revenue)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  async function adminSettings() {
    const { settings: s } = await api('GET', '/api/admin/settings');
    const field = (k, l, help, attrs = '') => `<label class="field span3">${l}<input class="input" name="${k}" value="${esc(s[k])}" ${attrs}><span class="tiny muted" style="font-weight:500">${help}</span></label>`;
    return `<div class="page-h"><div><h1>Marketplace settings</h1><p>Fees, payouts and delivery schedule. Changes apply to new orders immediately.</p></div></div>
      <form class="card form-grid" data-form="settings"><h3 class="span6">Customer fees</h3>
        ${field('delivery_fee_cents', 'Delivery fee per store (cents)', 'e.g. 599 = $5.99', 'type="number" min="0"')}${field('service_fee_rate', 'Service fee rate', '0.05 = 5% of items', 'type="number" step="0.005" min="0"')}
        ${field('service_fee_min_cents', 'Minimum service fee (cents)', 'Applied when % is lower', 'type="number" min="0"')}${field('min_order_cents', 'Minimum order (cents)', 'Cart subtotal required', 'type="number" min="0"')}
        ${field('tax_rate', 'Tax rate', 'Use 0 where groceries are tax-exempt', 'type="number" step="0.0001" min="0"')}
        <h3 class="span6 mt16">Partners</h3>${field('default_commission_rate', 'Default merchant commission', '0.15 = 15% for new stores', 'type="number" step="0.005" min="0"')}${field('driver_base_pay_cents', 'Driver base pay per order (cents)', 'Drivers also keep 100% of tips', 'type="number" min="0"')}
        ${field('bag_item_capacity', 'Items per BuckDuck bag', 'Used to estimate bags per order', 'type="number" min="1"')}
        <h3 class="span6 mt16">Delivery schedule</h3>
        <label class="field span3">Delivery day<select class="input" name="delivery_weekday">${DAYS.map((d, i) => `<option value="${i}" ${String(i) === String(s.delivery_weekday) ? 'selected' : ''}>${d}</option>`).join('')}</select><span class="tiny muted" style="font-weight:500">BuckDuck delivers once a week</span></label>
        ${field('order_cutoff_hours', 'Order cutoff (hours before window)', 'Gives stores time to pack', 'type="number" min="0"')}${field('windows_weeks_ahead', 'Weeks of windows to publish', '', 'type="number" min="1" max="12"')}
        ${field('default_window_capacity', 'Default capacity per window', 'Orders per window', 'type="number" min="1"')}
        <label class="field span6">Default windows (JSON)<input class="input" name="default_slots" value="${esc(s.default_slots)}"><span class="tiny muted" style="font-weight:500">[["06:00","12:00"],["12:00","16:00"]] = 6 AM–12 PM and 12 PM–4 PM</span></label>
        <label class="field span6">Service ZIP codes<input class="input" name="service_zips" value="${esc(s.service_zips)}" placeholder="Leave blank to accept all ZIPs"><span class="tiny muted" style="font-weight:500">Comma-separated, e.g. 77036,77042,77072</span></label>
        <div class="span6"><button class="btn btn-primary">Save settings</button></div></form>`;
  }

  /* =====================================================================
     DRIVER APP
     ===================================================================== */
  function driverShell(parts, content) {
    const cur = parts[1] || '';
    const tabs = [['', 'Home', 'home'], ['available', 'Jobs', 'list'], ['route', 'Route', 'map'], ['earnings', 'Earnings', 'dollar']];
    return `<div class="driver-shell"><div class="phone">${content}<nav class="d-nav no-print">${tabs.map(([p, l, i]) => `<a href="#/driver${p ? '/' + p : ''}" class="${cur === p ? 'active' : ''}">${ic(i, 22)}${l}</a>`).join('')}</nav></div></div>`;
  }
  async function driverPage(parts) {
    const sub = parts[1] || '';
    const sum = await api('GET', '/api/driver/summary');
    S.user = sum.user;
    const head = (title, extra = '') => `<div class="d-head"><div class="row"><div class="row" style="gap:10px">${LOGO_MARK.replace('<svg', '<svg width="34" height="34"')}<div><div class="tiny" style="color:var(--gold-400);font-weight:800;letter-spacing:.1em">BUCKDUCK DRIVER</div><div class="strong">${title}</div></div></div>
      <button class="icon-btn" style="background:rgba(255,255,255,.1);border:0;color:#fff" data-act="logout" aria-label="Sign out">${ic('logout', 16)}</button></div>${extra}</div>`;
    const toggle = `<div class="online-toggle"><div><div class="strong">${sum.user.driver_online ? "You're online" : "You're offline"}</div><div class="tiny" style="opacity:.7">${sum.user.driver_online ? 'Receiving delivery offers' : 'Go online to accept deliveries'}</div></div><button class="switch ${sum.user.driver_online ? 'on' : ''}" data-act="driverOnline" aria-label="Toggle online"></button></div>`;
    if (sub === '') {
      const w = sum.next_window;
      return head(`Hi, ${esc(sum.user.name.split(' ')[0])}`, toggle) + `<div class="d-body">
        <div class="card" style="background:var(--gold-50);border-color:var(--gold-200)"><div class="tiny strong" style="color:var(--gold-700)">NEXT DELIVERY DAY</div><div class="display" style="font-size:22px">${w ? fmtDate(w.date, { weekday: 'long', month: 'long', day: 'numeric' }) : '—'}</div><div class="small muted">Morning 6 AM–12 PM · Afternoon 12 PM–4 PM</div></div>
        <div class="grid g2 mt16"><a class="card" href="#/driver/available" style="color:inherit;text-decoration:none"><div class="tiny muted strong">AVAILABLE JOBS</div><div class="display" style="font-size:32px">${sum.available}</div><div class="small" style="color:var(--blue-700)">Browse →</div></a>
          <a class="card" href="#/driver/route" style="color:inherit;text-decoration:none"><div class="tiny muted strong">MY ROUTE</div><div class="display" style="font-size:32px">${sum.active}</div><div class="small" style="color:var(--blue-700)">Open route →</div></a></div>
        <div class="card mt16"><div class="row between"><div><div class="tiny muted strong">LIFETIME EARNINGS</div><div class="display" style="font-size:28px">${money(sum.totals.earnings)}</div></div><div class="right"><div class="strong">${sum.totals.deliveries}</div><div class="tiny muted">deliveries</div></div></div>
          <div class="small muted mt8">Base pay ${money(sum.base_pay_cents)} per stop + 100% of tips (${money(sum.totals.tips)} in tips so far)</div></div>
        <div class="card mt16"><h4>Delivery-day checklist</h4>${['Insulated bags & cooler loaded', 'Phone charged, app online', 'Verify BuckDuck bag count at each store', 'Photo + note at every drop-off'].map((t) => `<label class="check" style="padding:6px 0"><input type="checkbox"> ${t}</label>`).join('')}</div></div>`;
    }
    if (sub === 'available') {
      const { orders } = await api('GET', '/api/driver/available');
      return head('Available jobs', toggle) + `<div class="d-body">${!sum.user.driver_online ? '<div class="alert warn mb16">Go online to accept jobs.</div>' : ''}
        ${orders.map((o) => `<div class="stop"><div class="row between"><span class="badge b-gold">${winText(o)}</span><span class="pay-pill">${money(o.driver_pay_cents)}</span></div>
          <div class="leg"><div class="pin pick">🏪</div><div><div class="strong">${esc(o.store_name)}</div><div class="tiny muted">${esc(o.store_address || '')}</div></div></div>
          <div class="leg"><div class="pin drop">🏠</div><div><div class="strong">${esc(o.city)}, ${esc(o.zip)}</div><div class="tiny muted">Exact address shown after accepting</div></div></div>
          <div class="row between small muted"><span>🛍️ ${o.bags} bag${o.bags > 1 ? 's' : ''} · ${o.item_count} items</span><span>${o.tip_cents ? `incl. ${money(o.tip_cents)} tip` : ''}</span></div>
          <button class="btn btn-primary btn-block mt16" data-act="claim" data-id="${o.id}" ${sum.user.driver_online ? '' : 'disabled'}>Accept delivery</button></div>`).join('') || '<div class="empty"><div class="e">📭</div>No jobs right now. Stores mark orders ready as they finish packing.</div>'}</div>`;
    }
    if (sub === 'route') {
      const { orders } = await api('GET', '/api/driver/route');
      const pts = orders.map((_, i) => [30 + (i * 330) / Math.max(1, orders.length - 1 || 1), 30 + ((i * 53) % 60)]);
      return head('My route', `<div class="small mt8" style="opacity:.8">${orders.length} stop${orders.length === 1 ? '' : 's'} · ${orders.reduce((a, o) => a + o.bags, 0)} bags · ${money(orders.reduce((a, o) => a + o.driver_pay_cents, 0))} est. pay</div>`) + `<div class="d-body">
        ${orders.length ? `<div class="map-strip"><svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#1D4ED8" stroke-width="3" stroke-dasharray="6 5"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="#0B1F4B" stroke="#E8BC3A" stroke-width="2"/><text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">${i + 1}</text>`).join('')}</svg></div>` : ''}
        ${orders.map((o, i) => { const addr = `${o.address_line1}, ${o.city}, ${o.state} ${o.zip}`; const saddr = `${o.store_address || ''}, ${o.store_city || ''} ${o.store_zip || ''}`; return `<div class="stop"><div class="row between"><b>Stop ${i + 1} · ${esc(o.number)}</b>${badge(o.status)}</div><div class="tiny muted">${winText(o)}</div>
          <div class="leg"><div class="pin pick">🏪</div><div class="grow"><div class="strong">${esc(o.store_name)}</div><div class="tiny muted">${esc(saddr)}</div></div><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(saddr)}">${ic('nav', 14)}</a></div>
          <div class="leg"><div class="pin drop">🏠</div><div class="grow"><div class="strong">${esc(o.customer_name)}</div><div class="tiny muted">${esc(addr)}${o.address_line2 ? ' · ' + esc(o.address_line2) : ''}</div>${o.notes ? `<div class="tiny">📝 ${esc(o.notes)}</div>` : ''}</div>
            <div class="row" style="gap:6px"><a class="btn btn-ghost btn-sm" href="tel:${esc(o.phone)}" aria-label="Call">${ic('phone', 14)}</a><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}">${ic('nav', 14)}</a></div></div>
          <div class="row between small"><span class="bag-tag">🛍️ Collect ${o.bags} BuckDuck bag${o.bags > 1 ? 's' : ''}</span><span class="pay-pill">${money(o.driver_pay_cents)}</span></div>
          ${o.status === 'ready' ? `<div class="row mt16"><button class="btn btn-ghost btn-sm" data-act="release" data-id="${o.id}">Release</button><button class="btn btn-primary grow" data-act="dStatus" data-id="${o.id}" data-status="picked_up">Confirm pickup (${o.bags} bag${o.bags > 1 ? 's' : ''})</button></div>`
            : `<button class="btn btn-success btn-block mt16" data-act="deliverModal" data-id="${o.id}">Complete delivery</button>`}</div>`; }).join('') || '<div class="empty"><div class="e">🗺️</div>Your route is empty. <a href="#/driver/available">Find jobs →</a></div>'}</div>`;
    }
    if (sub === 'earnings') {
      const { orders } = await api('GET', '/api/driver/history');
      return head('Earnings', `<div class="display mt16" style="font-size:36px">${money(sum.totals.earnings)}</div><div class="small" style="opacity:.75">${sum.totals.deliveries} deliveries · ${money(sum.totals.tips)} tips</div>`) + `<div class="d-body">
        <div class="card">${barChart([...sum.weeks].reverse().map((w) => ({ ...w, lbl: fmtDate(w.date, { month: 'short', day: 'numeric' }) })), { valueKey: 'earnings', labelKey: 'lbl', height: 200, color: 'var(--gold-600)', tipLabel: 'Earned' })}</div>
        <h4 class="mt16">By delivery day</h4>${sum.weeks.map((w) => `<div class="card flat row between" style="margin-bottom:8px;padding:14px"><div><b>${fmtDate(w.date)}</b><div class="tiny muted">${w.deliveries} deliveries · ${money(w.tips)} tips</div></div><b>${money(w.earnings)}</b></div>`).join('') || '<div class="muted small">No earnings yet.</div>'}
        <h4 class="mt16">Recent deliveries</h4>${orders.slice(0, 15).map((o) => `<div class="row between small" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>${esc(o.number)} · ${esc(o.store_name)}</span><b>${money(o.driver_pay_cents)}</b></div>`).join('')}
        <p class="tiny muted mt16">Payouts are sent weekly via direct deposit every Tuesday.</p></div>`;
    }
    throw new Error('Page not found');
  }

  /* ================= actions (event delegation) ================= */
  const ACT = {
    closeModal, logout: () => logout(), demoAs: (el) => demoAs(el.dataset.role),
    toggleSide: () => document.getElementById('sidebar')?.classList.toggle('open'),
    inc: (el) => { const p = PRODUCT_CACHE.get(Number(el.dataset.pid)); if (p) { setQty(p, cartQty(p.id) + 1); if (cartQty(p.id) === 1) toast(`Added ${p.name}`); if (parseHash().parts[0] === 'cart') render(); } },
    dec: (el) => { const p = PRODUCT_CACHE.get(Number(el.dataset.pid)); if (p) { setQty(p, cartQty(p.id) - 1); if (parseHash().parts[0] === 'cart') render(); } },
    storeCat: (el) => { document.querySelectorAll('#cat-chips .chip').forEach((c) => c.classList.toggle('active', c === el)); const cat = el.dataset.cat; document.querySelectorAll('#products .product').forEach((p) => p.classList.toggle('hidden', cat !== 'All' && p.dataset.cat !== cat)); },
    pickWindow: (el) => { if (S.pending) return; S.co.window_id = Number(el.dataset.id); document.querySelectorAll('.window-opt').forEach((w) => { const on = w === el; w.classList.toggle('sel', on); w.setAttribute('aria-checked', on); }); },
    pickTip: (el) => { if (S.pending) return; S.co.tip = Number(el.dataset.tip); document.querySelectorAll('[data-act="pickTip"]').forEach((c) => c.classList.toggle('active', c === el)); updateCheckoutTotals(); },
    demoPay: (el) => demoPay(el.dataset.method, el),
    cancelOrder: async (el) => { if (!(await ask('Cancel order?', 'You will receive a full refund to your original payment method.', { ok: 'Cancel order', danger: true }))) return; try { await api('POST', `/api/orders/${el.dataset.id}/cancel`); toast('Order cancelled and refunded'); render(); } catch (e) { fail(e); } },
    editProfile: () => modal('Edit profile', `<form class="stack" data-form="profile"><label class="field">Name<input class="input" name="name" value="${esc(S.user.name)}" required></label><label class="field">Phone<input class="input" name="phone" value="${esc(S.user.phone || '')}"></label><button class="btn btn-primary">Save</button></form>`),
    orderModal: (el) => orderModal(el.dataset.id).catch(fail),
    printOrder: () => window.print(),
    printPickList: async () => {
      try {
        const { orders } = await api('GET', '/api/merchant/orders', { scope: 'upcoming' });
        const open = orders.filter((o) => ['accepted', 'packing'].includes(o.status));
        const details = await Promise.all(open.map((o) => api('GET', `/api/orders/${o.id}`).then((r) => r.order)));
        const agg = {}; details.forEach((o) => o.items.forEach((i) => { (agg[i.name] ||= { ...i, qty: 0 }).qty += i.qty; }));
        modal('Pick list — accepted & packing orders', `<p class="small muted">${details.length} orders · ${details.reduce((a, o) => a + o.bags, 0)} BuckDuck bags</p><table class="table"><thead><tr><th>✓</th><th>Item</th><th>Unit</th><th class="num">Total qty</th></tr></thead><tbody>${Object.values(agg).sort((a, b) => a.name.localeCompare(b.name)).map((i) => `<tr><td>☐</td><td>${esc(i.emoji || '')} ${esc(i.name)}</td><td class="muted small">${esc(i.unit || '')}</td><td class="num strong">${i.qty}</td></tr>`).join('') || '<tr><td colspan="4" class="muted center">No accepted orders to pick</td></tr>'}</tbody></table>`, CAN_PRINT ? `<button class="btn btn-primary" data-act="printOrder">${ic('print', 16)} Print</button>` : '', true);
      } catch (e) { fail(e); }
    },
    mStatus: async (el) => {
      const st = el.dataset.status; let body = { status: st };
      if (st === 'cancelled' && !(await ask('Cancel this order?', 'The customer is refunded in full and the items return to your stock.', { ok: 'Cancel & refund', danger: true }))) return;
      if (st === 'ready') { const r = await ask('Mark ready for pickup', 'Confirm the number of sealed BuckDuck bags. The driver checks this count at pickup.', { ok: 'Mark ready', fields: [{ id: 'bags', label: 'BuckDuck bags packed', type: 'number', value: el.dataset.bags || '1', attrs: 'min="1" max="30"' }] }); if (!r) return; body.bags = Number(r.bags) || 1; }
      try { await api('POST', `/api/merchant/orders/${el.dataset.id}/status`, body); toast(`Order ${STATUS[st][0].toLowerCase()}`); closeModal(); render(); } catch (e) { fail(e); }
    },
    editProduct: (el) => { const p = (S.mProducts || []).find((x) => String(x.id) === el.dataset.id) || {};
      modal(p.id ? 'Edit product' : 'Add product', productForm(p), `${p.id ? `<button class="btn btn-danger" data-act="deleteProduct" data-id="${p.id}">Remove</button>` : ''}<button class="btn btn-ghost" data-act="closeModal">Cancel</button><button class="btn btn-primary" data-act="submitProduct">Save product</button>`); },
    submitProduct: () => document.querySelector('[data-form="product"]').requestSubmit(),
    deleteProduct: async (el) => { if (!(await ask('Remove product?', 'It will be hidden from your storefront. Past orders are not affected.', { ok: 'Remove', danger: true }))) return; try { await api('DELETE', `/api/merchant/products/${el.dataset.id}`); toast('Product removed'); closeModal(); render(); } catch (e) { fail(e); } },
    stripeOnboard: async () => { try { const r = await api('POST', '/api/merchant/stripe/onboard'); if (r.url) location.href = r.url; else { toast(r.connected ? 'Bank account connected' : 'Onboarding started'); render(); } } catch (e) { fail(e); } },
    storeStatus: async (el) => { try { await api('POST', `/api/admin/stores/${el.dataset.id}`, { status: el.dataset.status }); toast(el.dataset.status === 'active' ? 'Store is live' : 'Store suspended'); render(); } catch (e) { fail(e); } },
    userStatus: async (el) => { try { await api('POST', `/api/admin/users/${el.dataset.id}`, { status: el.dataset.status }); toast('User updated'); render(); } catch (e) { fail(e); } },
    adminSaveOrder: async (el) => { try { await api('POST', `/api/admin/orders/${el.dataset.id}`, { driver_id: document.getElementById('adm-driver').value || null, status: document.getElementById('adm-status').value }); toast('Order updated'); closeModal(); render(); } catch (e) { fail(e); } },
    adminRefund: async (el) => { const r = await ask('Issue refund', 'Refunds go back to the customer\'s original payment method. A full refund closes the order.', { ok: 'Issue refund', danger: true, fields: [{ id: 'amt', label: 'Amount ($)', type: 'number', value: (el.dataset.total / 100).toFixed(2), attrs: 'step="0.01" min="0.01"' }, { id: 'reason', label: 'Reason', value: 'Customer service' }] }); if (!r) return;
      try { await api('POST', `/api/admin/orders/${el.dataset.id}/refund`, { amount_cents: Math.round(Number(r.amt) * 100), reason: r.reason }); toast('Refund issued'); closeModal(); render(); } catch (e) { fail(e); } },
    addWindow: () => modal('Add delivery window', `<form class="form-grid" data-form="window"><label class="field span2">Date<input class="input" type="date" name="date" required></label><label class="field span2">Start<input class="input" type="time" name="start_time" value="16:00" required></label><label class="field span2">End<input class="input" type="time" name="end_time" value="19:00" required></label><label class="field span3">Capacity<input class="input" type="number" name="capacity" value="80" min="1"></label><div class="span6"><button class="btn btn-primary">Create window</button></div></form>`),
    toggleWindow: async (el) => { try { await api('PUT', `/api/admin/windows/${el.dataset.id}`, { active: el.dataset.active === '1' }); toast('Window updated'); render(); } catch (e) { fail(e); } },
    driverOnline: async (el) => { try { await api('POST', '/api/driver/online', { online: !el.classList.contains('on') }); render(); } catch (e) { fail(e); } },
    claim: async (el) => { el.disabled = true; try { await api('POST', `/api/driver/orders/${el.dataset.id}/claim`); toast('Delivery added to your route'); render(); } catch (e) { el.disabled = false; fail(e); } },
    release: async (el) => { if (!(await ask('Release delivery?', 'It goes back on the job board for another driver.', { ok: 'Release' }))) return; try { await api('POST', `/api/driver/orders/${el.dataset.id}/release`); toast('Delivery released'); render(); } catch (e) { fail(e); } },
    dStatus: async (el) => { try { await api('POST', `/api/driver/orders/${el.dataset.id}/status`, { status: el.dataset.status }); toast('Pickup confirmed — on the way!'); render(); } catch (e) { fail(e); } },
    deliverModal: (el) => modal('Complete delivery', `<form class="stack" data-form="deliver" data-id="${el.dataset.id}"><label class="field">Drop-off note<select class="input" name="proof_note"><option>Handed to customer</option><option>Left at front door</option><option>Left with building concierge</option><option>Left at back door / garage</option></select></label>
      <label class="field">Photo of delivered bags (optional)<input class="input" type="file" name="photo" accept="image/*" capture="environment"></label><button class="btn btn-success btn-lg">Mark as delivered</button></form>`)
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = ACT[el.dataset.act]; if (!fn) return;
    e.preventDefault(); fn(el);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.window-opt[data-act]')) { e.preventDefault(); ACT.pickWindow(e.target); } });
  document.addEventListener('change', async (e) => {
    const t = e.target;
    try {
      if (t.dataset.assign) { if (!t.value) return; await api('POST', `/api/admin/orders/${t.dataset.assign}`, { driver_id: Number(t.value) }); toast('Driver assigned'); render(); }
      if (t.dataset.commission) { await api('POST', `/api/admin/stores/${t.dataset.commission}`, { commission_rate: Number(t.value) / 100 }); toast('Commission updated'); }
      if (t.dataset.wcap) { await api('PUT', `/api/admin/windows/${t.dataset.wcap}`, { capacity: Number(t.value) }); toast('Capacity updated'); }
    } catch (err) { fail(err); }
  });

  const FORMS = {
    search: (f) => { const q = f.q.value.trim(); if (q) go(`#/search?q=${encodeURIComponent(q)}`); },
    login: async (f) => { const d = formData(f); const r = await api('POST', '/api/auth/login', { email: d.email, password: d.password }); setSession(r); await loadMe(); toast(`Welcome back, ${r.user.name.split(' ')[0]}`); go(d.next || homeFor(r.user)); },
    register: async (f) => { const r = await api('POST', '/api/auth/register', formData(f)); setSession(r); await loadMe(); toast(r.user.role === 'merchant' ? 'Store submitted for approval' : 'Account created'); go(homeFor(r.user)); },
    checkout: (f) => submitCheckout(f),
    profile: async (f) => { const r = await api('PUT', '/api/me', formData(f)); S.user = r.user; toast('Profile saved'); closeModal(); render(); },
    product: async (f) => { const d = formData(f); const file = f.image.files[0]; delete d.image; d.active = f.active.checked; if (file) d.image_data = await readImage(file);
      const id = f.dataset.id; await api(id ? 'PUT' : 'POST', `/api/merchant/products${id ? '/' + id : ''}`, d); toast('Product saved'); closeModal(); render(); },
    storeProfile: async (f) => { const d = formData(f); const file = f.logo.files[0]; delete d.logo; if (file) d.logo_data = await readImage(file, 400); await api('PUT', '/api/merchant/store', d); await loadMe(); toast('Storefront saved'); render(); },
    adminOrderSearch: (f) => { const p = parseHash().query; go(`#/admin/orders?${new URLSearchParams({ ...p, q: f.q.value })}`); },
    adminUserSearch: (f) => go(`#/admin/users?${new URLSearchParams({ role: f.role.value, q: f.q.value })}`),
    window: async (f) => { await api('POST', '/api/admin/windows', formData(f)); toast('Window created'); closeModal(); render(); },
    settings: async (f) => { await api('PUT', '/api/admin/settings', formData(f)); S.config = await api('GET', '/api/config'); toast('Settings saved'); render(); },
    deliver: async (f) => { const d = formData(f); const file = f.photo.files[0]; const body = { status: 'delivered', proof_note: d.proof_note }; if (file) body.photo_data = await readImage(file, 900);
      await api('POST', `/api/driver/orders/${f.dataset.id}/status`, body); toast('Delivered! Great work 🎉'); closeModal(); render(); }
  };
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form]; if (!fn) return;
    const btn = f.querySelector('button:not([type=button])') || document.querySelector('[data-act="submitProduct"]');
    if (btn && f.dataset.form !== 'checkout') btn.disabled = true;
    try { await fn(f); } catch (err) { fail(err); } finally { if (btn && f.dataset.form !== 'checkout' && document.body.contains(btn)) btn.disabled = false; }
  });

  /* ================= boot ================= */
  async function boot() {
    try { S.config = await api('GET', '/api/config'); } catch (e) { $app.innerHTML = `<div class="empty"><div class="e">🦆</div><h2>BuckDuck is unavailable</h2><p>${esc(e.message)}</p></div>`; return; }
    await loadMe();
    const sp = new URLSearchParams(location.search);
    if (sp.get('checkout_return') && S.user) {   // returning from a Stripe redirect (3-D Secure, bank auth)
      const id = sp.get('checkout_return'); history.replaceState(null, '', location.pathname + '#/account');
      try { await finishCheckout(id); } catch (e) { fail(e); }
    }
    window.addEventListener('hashchange', render);
    render();
  }
  window.BuckApp = { boot };
  if (!window.BUCK_DEFER_BOOT) boot();
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.BUCK_TRANSPORT) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
</script>