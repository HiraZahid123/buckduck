<script>/*!
 * BuckDuck Core API — shared business logic.
 * Runs unchanged on the Node server (node:sqlite) and in the browser demo (sql.js).
 * All money is stored in integer cents.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuckCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT, status TEXT NOT NULL DEFAULT 'active',
    driver_online INTEGER NOT NULL DEFAULT 0, vehicle TEXT, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS stores(
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    tagline TEXT, description TEXT, category TEXT, address TEXT, city TEXT, state TEXT, zip TEXT, phone TEXT,
    color TEXT, emoji TEXT, logo_url TEXT, status TEXT NOT NULL DEFAULT 'pending', commission_rate REAL NOT NULL DEFAULT 0.15,
    stripe_account_id TEXT, stripe_charges_enabled INTEGER NOT NULL DEFAULT 0, rating REAL NOT NULL DEFAULT 4.8,
    created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT,
    category TEXT, price_cents INTEGER NOT NULL, unit TEXT, stock INTEGER NOT NULL DEFAULT 0, emoji TEXT,
    image_url TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS delivery_windows(
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    label TEXT, capacity INTEGER NOT NULL DEFAULT 120, active INTEGER NOT NULL DEFAULT 1, UNIQUE(date, start_time));
  CREATE TABLE IF NOT EXISTS checkouts(
    id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, total_cents INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending', payment_intent_id TEXT, payment_method TEXT, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT UNIQUE, checkout_id INTEGER, customer_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL, window_id INTEGER NOT NULL, driver_id INTEGER, status TEXT NOT NULL,
    subtotal_cents INTEGER NOT NULL DEFAULT 0, delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
    service_fee_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, tip_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0, commission_cents INTEGER NOT NULL DEFAULT 0, driver_pay_cents INTEGER NOT NULL DEFAULT 0,
    bags INTEGER NOT NULL DEFAULT 1, address_line1 TEXT, address_line2 TEXT, city TEXT, state TEXT, zip TEXT, phone TEXT,
    notes TEXT, proof_note TEXT, transfer_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS order_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER, name TEXT, emoji TEXT,
    unit TEXT, price_cents INTEGER NOT NULL, qty INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS order_events(
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, status TEXT NOT NULL, note TEXT, actor TEXT, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id, status);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id, status);
  CREATE INDEX IF NOT EXISTS idx_orders_window ON orders(window_id);
  CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
  `;

  const DEFAULT_SETTINGS = {
    delivery_fee_cents: '599',
    service_fee_rate: '0.05',
    service_fee_min_cents: '199',
    tax_rate: '0',
    default_commission_rate: '0.15',
    driver_base_pay_cents: '550',
    order_cutoff_hours: '24',
    windows_weeks_ahead: '4',
    default_window_capacity: '120',
    default_slots: '[["06:00","12:00"],["12:00","16:00"]]',
    delivery_weekday: '6',
    service_zips: '',
    min_order_cents: '1500',
    bag_item_capacity: '10'
  };

  const ORDER_FLOW = ['pending_payment', 'placed', 'accepted', 'packing', 'ready', 'picked_up', 'delivered'];
  const STATUS_LABEL = {
    pending_payment: 'Awaiting payment', placed: 'Order placed', accepted: 'Accepted by store', packing: 'Packing in BuckDuck bags',
    ready: 'Ready for pickup', picked_up: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded'
  };

  /* ---------------- helpers ---------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'store';
  const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 || 12; return m ? `${hh}:${pad(m)} ${ap}` : `${hh} ${ap}`; };
  const windowLabel = (s, e) => `${Number(s.split(':')[0]) < 12 ? 'Morning' : 'Afternoon'} · ${fmtTime(s)} – ${fmtTime(e)}`;
  const windowStart = (w) => new Date(`${w.date}T${w.start_time}:00`);

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
  const fail = (s, m) => { throw new HttpError(s, m); };
  const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
  const req = (v, name, max) => { const s = str(v, max); if (!s) fail(400, `${name} is required`); return s; };
  const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
  const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const publicUser = (u) => u && ({ id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone, status: u.status, driver_online: !!u.driver_online, vehicle: u.vehicle, created_at: u.created_at });

  /* ---------------- seed data ---------------- */
  const SEED_STORES = [
    { name: 'Accra Market', owner: 'merchant@buckduck.com', ownerName: 'Efua Boateng', category: 'African Groceries', emoji: '🌍', color: '#B7791F', city: 'Houston', state: 'TX', zip: '77036',
      tagline: 'Ghanaian staples, fresh every week', description: 'Family-owned since 2009. Gari, kenkey, palm oil, smoked fish and the flavors of home — packed fresh for Saturday delivery.',
      products: [['Gari (White), 4 lb', 'Staples', 899, '4 lb bag', '🍚'], ['Red Palm Oil', 'Pantry', 1099, '1 L', '🫙'], ['Ripe Plantains', 'Produce', 499, 'bunch of 5', '🍌'],
        ['Shito Hot Pepper Sauce', 'Pantry', 799, '12 oz jar', '🌶️'], ['Fresh Kenkey', 'Prepared', 1299, '5 balls', '🍙'], ['Fufu Flour', 'Staples', 699, '24 oz', '🥣'],
        ['Smoked Herring', 'Seafood', 1499, '1 lb', '🐟'], ['Kontomire Leaves', 'Produce', 599, '1 lb', '🥬'], ['Jollof Spice Blend', 'Spices', 499, '6 oz', '🧂'],
        ['Roasted Corn Cereal', 'Breakfast', 899, '1 kg', '🥣'], ['Puna Yam', 'Produce', 1299, 'per tuber', '🍠'], ['Chocolate Malt Drink Mix', 'Beverages', 899, '400 g', '☕']] },
    { name: 'Green Valley Produce', owner: 'greenvalley@buckduck.com', ownerName: 'Daniel Ortiz', category: 'Fresh Produce', emoji: '🥬', color: '#2F855A', city: 'Houston', state: 'TX', zip: '77042',
      tagline: 'Farm-direct fruits & vegetables', description: 'We source from Texas growers every Thursday so your produce is at peak freshness on Saturday.',
      products: [['Roma Tomatoes', 'Vegetables', 199, 'per lb', '🍅'], ['Red Onions', 'Vegetables', 349, '3 lb bag', '🧅'], ['Hass Avocados', 'Fruit', 599, '4 count', '🥑'],
        ['Baby Spinach', 'Greens', 449, '10 oz', '🥬'], ['Bananas', 'Fruit', 69, 'per lb', '🍌'], ['Honeycrisp Apples', 'Fruit', 699, '3 lb bag', '🍎'],
        ['Strawberries', 'Fruit', 499, '1 lb', '🍓'], ['Carrots', 'Vegetables', 249, '2 lb', '🥕'], ['Sweet Potatoes', 'Vegetables', 149, 'per lb', '🍠'],
        ['Lemons', 'Fruit', 399, '2 lb bag', '🍋'], ['Broccoli Crowns', 'Vegetables', 299, 'per lb', '🥦'], ['Bell Peppers', 'Vegetables', 449, '3 pack', '🫑']] },
    { name: 'Lagos Pantry', owner: 'lagos@buckduck.com', ownerName: 'Tunde Adeyemi', category: 'African Groceries', emoji: '🌶️', color: '#C53030', city: 'Houston', state: 'TX', zip: '77099',
      tagline: 'Nigerian kitchen essentials', description: 'Egusi, ogbono, crayfish, stockfish and everything you need for Sunday stew — delivered Saturday.',
      products: [['Ground Egusi', 'Pantry', 899, '1 lb', '🥜'], ['Semolina Flour', 'Staples', 999, '5 lb', '🌾'], ['Honey Beans', 'Staples', 1099, '4 lb', '🫘'],
        ['Ground Crayfish', 'Seafood', 1199, '8 oz', '🦐'], ['Ogbono Seeds', 'Pantry', 1099, '8 oz', '🥜'], ['Suya Spice (Yaji)', 'Spices', 599, '6 oz', '🌶️'],
        ['Chin Chin', 'Snacks', 499, '14 oz', '🍪'], ['Instant Noodles', 'Pantry', 1899, '40 pack', '🍜'], ['Stockfish Cuts', 'Seafood', 2499, '1 lb', '🐟'],
        ['Frozen Ugu Leaves', 'Frozen', 699, '1 lb', '🥬'], ['Yellow Garri', 'Staples', 899, '4 lb', '🍚'], ['Malt Drink', 'Beverages', 899, '6 pack', '🥤']] },
    { name: 'Island Spice Mart', owner: 'island@buckduck.com', ownerName: 'Marcia Campbell', category: 'Caribbean', emoji: '🍍', color: '#D69E2E', city: 'Houston', state: 'TX', zip: '77071',
      tagline: 'Caribbean flavor, island fresh', description: 'From scotch bonnets to saltfish — the authentic taste of Jamaica, Trinidad and beyond.',
      products: [['Scotch Bonnet Peppers', 'Produce', 399, '8 oz', '🌶️'], ['Canned Ackee', 'Pantry', 1299, '19 oz', '🥫'], ['Jerk Seasoning', 'Spices', 699, '10 oz', '🍖'],
        ['Callaloo', 'Pantry', 349, '19 oz can', '🥬'], ['Coco Bread', 'Bakery', 499, '4 pack', '🥖'], ['Breadfruit', 'Produce', 599, 'each', '🍈'],
        ['Dried Sorrel', 'Beverages', 699, '4 oz', '🌺'], ['Island Curry Powder', 'Spices', 499, '8 oz', '🍛'], ['Ginger Beer', 'Beverages', 799, '4 pack', '🥤'],
        ['Boneless Saltfish', 'Seafood', 1399, '1 lb', '🐟'], ['Golden Pineapple', 'Produce', 399, 'each', '🍍'], ['Coconut Milk', 'Pantry', 249, '13.5 oz', '🥥']] },
    { name: 'Prime Cut Halal Meats', owner: 'primecut@buckduck.com', ownerName: 'Yusuf Hassan', category: 'Meat & Seafood', emoji: '🥩', color: '#9B2C2C', city: 'Houston', state: 'TX', zip: '77074',
      tagline: 'Hand-cut halal meats & fresh fish', description: 'Certified halal butcher. Every order is cut, sealed and chilled the morning of delivery.',
      products: [['Whole Chicken', 'Poultry', 1299, '4–5 lb', '🍗'], ['Goat Meat, Cubed', 'Goat & Lamb', 999, 'per lb', '🥩'], ['Beef Stew Meat', 'Beef', 899, 'per lb', '🥩'],
        ['Lamb Chops', 'Goat & Lamb', 1699, 'per lb', '🍖'], ['Whole Tilapia', 'Seafood', 799, 'per lb', '🐟'], ['Party Wings', 'Poultry', 1199, '3 lb', '🍗'],
        ['Ground Beef 80/20', 'Beef', 699, 'per lb', '🥩'], ['Turkey Wings', 'Poultry', 899, '2 lb', '🦃'], ['Jumbo Shrimp', 'Seafood', 1299, '1 lb', '🦐'], ['Suya-Cut Beef', 'Beef', 1099, 'per lb', '🥩']] },
    { name: 'Golden Crust Bakery', owner: 'goldencrust@buckduck.com', ownerName: 'Grace Okafor', category: 'Bakery', emoji: '🥐', color: '#975A16', city: 'Houston', state: 'TX', zip: '77057',
      tagline: 'Baked before sunrise, delivered by noon', description: 'Sweet breads, meat pies and pastries baked Saturday at 3 AM for the morning window.',
      products: [['Sourdough Loaf', 'Bread', 799, 'each', '🍞'], ['Sweet Bread Loaf', 'Bread', 599, 'each', '🍞'], ['Meat Pies', 'Savory', 999, '4 pack', '🥧'],
        ['Butter Croissants', 'Pastry', 899, '4 pack', '🥐'], ['Puff-Puff', 'Pastry', 699, 'dozen', '🍩'], ['Banana Bread', 'Bread', 899, 'loaf', '🍌'],
        ['Bagels', 'Bread', 699, '6 pack', '🥯'], ['Cinnamon Rolls', 'Pastry', 1099, '4 pack', '🥮']] },
    { name: 'Nairobi Fresh', owner: 'nairobi@buckduck.com', ownerName: 'Wanjiru Kamau', category: 'African Groceries', emoji: '☕', color: '#276749', city: 'Houston', state: 'TX', zip: '77036', pending: true,
      tagline: 'East African groceries & coffee', description: 'Ugali flour, chai masala, Kenyan coffee and more.',
      products: [['Maize Flour (Ugali)', 'Staples', 799, '2 kg', '🌽'], ['Kenyan AA Coffee', 'Beverages', 1599, '12 oz', '☕'], ['Chai Masala', 'Spices', 599, '4 oz', '🫖']] }
  ];
  const SEED_CUSTOMERS = ['Ama Mensah', 'Kofi Owusu', 'Chidinma Eze', 'Jessica Turner', 'Michael Brooks', 'Abena Darko', 'Samuel Johnson', 'Nadia Rahman',
    'Kevin Nguyen', 'Funmi Balogun', 'Andre Williams', 'Priya Patel', 'Yaw Antwi', 'Rachel Kim', 'Olu Adebayo', 'Tasha Green'];
  const SEED_DRIVERS = [['Kwame Asante', 'driver@buckduck.com', 'Toyota Sienna · Silver'], ['Luis Ramirez', 'luis@buckduck.com', 'Ford Transit · White'],
    ['Brianna Scott', 'brianna@buckduck.com', 'Honda CR-V · Blue'], ['Emeka Nwosu', 'emeka@buckduck.com', 'Chevy Express · White'], ['Hannah Lee', 'hannah@buckduck.com', 'Kia Carnival · Gray']];
  const STREETS = ['Bellaire Blvd', 'Westheimer Rd', 'Bissonnet St', 'Beechnut St', 'Fondren Rd', 'Hillcroft Ave', 'Gessner Rd', 'Richmond Ave', 'Wilcrest Dr', 'Kirkwood Rd'];

  /* ---------------- DB init + seed ---------------- */
  async function initDb(db, deps) {
    db.exec(SCHEMA);
    const has = db.get('SELECT COUNT(*) AS c FROM users');
    if (has.c > 0) return false;
    await seed(db, deps);
    return true;
  }

  async function seed(db, { hashPassword, now }) {
    const nowD = (now || (() => new Date()))();
    const rand = mulberry32(20261004);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    const pw = await hashPassword('demo1234');
    const ts = (d) => d.toISOString();
    const daysAgo = (n) => new Date(nowD.getTime() - n * 86400000);
    db.exec('BEGIN');
    try {
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) db.run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', [k, v]);
      const addUser = (email, name, role, extra = {}) => db.run(
        'INSERT INTO users(email,password_hash,name,role,phone,status,driver_online,vehicle,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
        [email, pw, name, role, extra.phone || `(713) 555-${String(1000 + Math.floor(rand() * 8999))}`, 'active', extra.online ? 1 : 0, extra.vehicle || null, ts(daysAgo(120 + Math.floor(rand() * 60)))]).id;

      addUser('admin@buckduck.com', 'BuckDuck Operations', 'admin');
      const customers = SEED_CUSTOMERS.map((n, i) => addUser(i === 0 ? 'customer@buckduck.com' : `${n.split(' ')[0].toLowerCase()}@example.com`, n, 'customer'));
      const drivers = SEED_DRIVERS.map(([n, e, v], i) => addUser(e, n, 'driver', { vehicle: v, online: i < 3 }));

      const stores = [];
      for (const s of SEED_STORES) {
        const owner = addUser(s.owner, s.ownerName, 'merchant');
        const storeId = db.run(`INSERT INTO stores(owner_id,name,slug,tagline,description,category,address,city,state,zip,phone,color,emoji,status,commission_rate,rating,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [owner, s.name, slugify(s.name), s.tagline, s.description, s.category,
          `${1000 + Math.floor(rand() * 9000)} ${pick(STREETS)}`, s.city, s.state, s.zip, '(713) 555-0' + (100 + stores.length), s.color, s.emoji,
          s.pending ? 'pending' : 'active', 0.15, Math.round((4.5 + rand() * 0.5) * 10) / 10, ts(daysAgo(s.pending ? 2 : 100))]).id;
        const prods = s.products.map(([name, cat, price, unit, emoji]) => ({
          id: db.run('INSERT INTO products(store_id,name,description,category,price_cents,unit,stock,emoji,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
            [storeId, name, `${name} from ${s.name}.`, cat, price, unit, 20 + Math.floor(rand() * 80), emoji, 1, ts(daysAgo(90))]).id, name, price, unit, emoji }));
        stores.push({ id: storeId, pending: !!s.pending, prods });
      }

      // Windows: past 6 Saturdays + upcoming are generated by ensureWindows
      const slots = JSON.parse(DEFAULT_SETTINGS.default_slots);
      const sat = new Date(nowD); sat.setHours(0, 0, 0, 0);
      const diff = (6 - sat.getDay() + 7) % 7; sat.setDate(sat.getDate() + diff);   // next (or today) Saturday
      const winFor = (d) => slots.map(([a, b]) => {
        const date = ymd(d);
        const ex = db.get('SELECT id FROM delivery_windows WHERE date=? AND start_time=?', [date, a]);
        return ex ? ex.id : db.run('INSERT INTO delivery_windows(date,start_time,end_time,label,capacity,active) VALUES(?,?,?,?,?,1)', [date, a, b, windowLabel(a, b), 120]).id;
      });

      const activeStores = stores.filter((s) => !s.pending);
      const settings = { fee: 599, rate: 0.05, min: 199, driverBase: 550 };
      let orderSeq = 0;
      const makeOrder = (custId, store, winId, status, created, driverId) => {
        const n = 1 + Math.floor(rand() * 5);
        const items = []; const used = new Set();
        for (let i = 0; i < n; i++) { const p = pick(store.prods); if (used.has(p.id)) continue; used.add(p.id); items.push({ p, qty: 1 + Math.floor(rand() * 3) }); }
        const subtotal = items.reduce((a, it) => a + it.p.price * it.qty, 0);
        const service = Math.max(settings.min, Math.round(subtotal * settings.rate));
        const tip = [0, 200, 300, 500, 500, 800][Math.floor(rand() * 6)];
        const total = subtotal + settings.fee + service + tip;
        const commission = Math.round(subtotal * 0.15);
        const qtySum = items.reduce((a, it) => a + it.qty, 0);
        const paid = status !== 'pending_payment';
        const co = db.run('INSERT INTO checkouts(customer_id,total_cents,payment_status,payment_intent_id,payment_method,created_at) VALUES(?,?,?,?,?,?)',
          [custId, total, status === 'refunded' ? 'refunded' : paid ? 'paid' : 'pending', `pi_seed_${++orderSeq}`, pick(['card', 'card', 'apple_pay', 'google_pay']), ts(created)]).id;
        const oid = db.run(`INSERT INTO orders(checkout_id,customer_id,store_id,window_id,driver_id,status,subtotal_cents,delivery_fee_cents,service_fee_cents,tax_cents,tip_cents,total_cents,commission_cents,driver_pay_cents,bags,address_line1,city,state,zip,phone,notes,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [co, custId, store.id, winId, driverId || null, status, subtotal, settings.fee, service, 0, tip, total, commission,
          settings.driverBase + tip, Math.max(1, Math.ceil(qtySum / 10)), `${100 + Math.floor(rand() * 9800)} ${pick(STREETS)}`, 'Houston', 'TX', pick(['77036', '77042', '77072', '77099', '77074', '77057']),
          '(713) 555-' + (2000 + Math.floor(rand() * 7000)), rand() < 0.2 ? 'Please ring the doorbell.' : '', ts(created), ts(created)]).id;
        db.run('UPDATE orders SET number=? WHERE id=?', ['BD-' + (10000 + oid), oid]);
        for (const it of items) db.run('INSERT INTO order_items(order_id,product_id,name,emoji,unit,price_cents,qty) VALUES(?,?,?,?,?,?,?)', [oid, it.p.id, it.p.name, it.p.emoji, it.p.unit, it.p.price, it.qty]);
        const flow = status === 'refunded' || status === 'cancelled' ? ['placed', status] : ORDER_FLOW.slice(1, ORDER_FLOW.indexOf(status) + 1);
        flow.forEach((st, i) => db.run('INSERT INTO order_events(order_id,status,note,actor,at) VALUES(?,?,?,?,?)', [oid, st, '', 'system', ts(new Date(created.getTime() + i * 3600000 * 6))]));
        return oid;
      };

      // History: past 8 Saturdays, growing volume
      for (let w = 8; w >= 1; w--) {
        const d = new Date(sat); d.setDate(d.getDate() - 7 * w);
        const wins = winFor(d);
        const count = 14 + (8 - w) * 4 + Math.floor(rand() * 6);
        for (let i = 0; i < count; i++) {
          const created = new Date(d.getTime() - (1 + rand() * 5) * 86400000);
          const st = rand() < 0.04 ? 'refunded' : 'delivered';
          makeOrder(pick(customers), pick(activeStores), pick(wins), st, created, st === 'delivered' ? pick(drivers) : null);
        }
      }
      // Upcoming Saturday: live pipeline
      const wins = winFor(sat);
      const pipeline = [['placed', 9], ['accepted', 6], ['packing', 5], ['ready', 6], ['ready_claimed', 3]];
      for (const [st, n] of pipeline) for (let i = 0; i < n; i++) {
        const created = new Date(nowD.getTime() - rand() * 2.5 * 86400000);
        const store = i === 0 ? activeStores[0] : pick(activeStores);
        const cust = i === 0 && st === 'placed' ? customers[0] : pick(customers);
        makeOrder(cust, store, pick(wins), st === 'ready_claimed' ? 'ready' : st, created, st === 'ready_claimed' ? drivers[0] : null);
      }
      // Ensure the demo customer has a delivered order + an in-progress order
      makeOrder(customers[0], activeStores[1], wins[0], 'packing', daysAgo(1), null);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  /* ---------------- API ---------------- */
  function createApi(deps) {
    const { db, hashPassword, verifyPassword, signToken, verifyToken, payments, saveImage } = deps;
    const now = deps.now || (() => new Date());
    const iso = () => now().toISOString();
    const log = deps.log || ((...a) => console.error(...a));

    const setting = (k) => { const r = db.get('SELECT value FROM settings WHERE key=?', [k]); return r ? r.value : DEFAULT_SETTINGS[k]; };
    const nset = (k) => Number(setting(k));
    const allSettings = () => { const o = { ...DEFAULT_SETTINGS }; db.all('SELECT key,value FROM settings').forEach((r) => { o[r.key] = r.value; }); return o; };

    /* ---- delivery windows ---- */
    function ensureWindows() {
      const weekday = nset('delivery_weekday');
      const weeks = nset('windows_weeks_ahead');
      let slots; try { slots = JSON.parse(setting('default_slots')); } catch { slots = JSON.parse(DEFAULT_SETTINGS.default_slots); }
      const cap = nset('default_window_capacity');
      const d = new Date(now()); d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
      for (let i = 0; i < weeks; i++) {
        const date = ymd(d);
        for (const [a, b] of slots) db.run('INSERT OR IGNORE INTO delivery_windows(date,start_time,end_time,label,capacity,active) VALUES(?,?,?,?,?,1)', [date, a, b, windowLabel(a, b), cap]);
        d.setDate(d.getDate() + 7);
      }
    }
    function windowRow(w) {
      const booked = db.get("SELECT COUNT(*) AS c FROM orders WHERE window_id=? AND status NOT IN ('cancelled','refunded','pending_payment')", [w.id]).c;
      const cutoff = new Date(windowStart(w).getTime() - nset('order_cutoff_hours') * 3600000);
      return { ...w, active: !!w.active, booked, remaining: Math.max(0, w.capacity - booked), cutoff: cutoff.toISOString(), open: !!w.active && now() < cutoff && booked < w.capacity };
    }
    const upcomingWindows = () => {
      ensureWindows();
      return db.all('SELECT * FROM delivery_windows WHERE date >= ? ORDER BY date, start_time', [ymd(now())]).map(windowRow);
    };

    /* ---- pricing ---- */
    function priceItems(items) {
      if (!Array.isArray(items) || !items.length) fail(400, 'Your cart is empty');
      const byStore = new Map();
      for (const it of items) {
        const qty = int(it.qty);
        if (qty < 1 || qty > 99) fail(400, 'Invalid quantity');
        const p = db.get('SELECT p.*, s.name AS store_name, s.status AS store_status, s.commission_rate FROM products p JOIN stores s ON s.id=p.store_id WHERE p.id=?', [int(it.product_id)]);
        if (!p || !p.active) fail(400, 'An item in your cart is no longer available');
        if (p.store_status !== 'active') fail(400, `${p.store_name} is not accepting orders right now`);
        if (p.stock < qty) fail(400, `Only ${p.stock} left of ${p.name}`);
        if (!byStore.has(p.store_id)) byStore.set(p.store_id, { store_id: p.store_id, store_name: p.store_name, commission_rate: p.commission_rate, lines: [] });
        byStore.get(p.store_id).lines.push({ product: p, qty });
      }
      const fee = nset('delivery_fee_cents'), rate = nset('service_fee_rate'), min = nset('service_fee_min_cents'), tax = nset('tax_rate');
      const bagCap = nset('bag_item_capacity') || 10;
      const groups = [...byStore.values()].map((g) => {
        const subtotal = g.lines.reduce((a, l) => a + l.product.price_cents * l.qty, 0);
        const service = Math.max(min, Math.round(subtotal * rate));
        const taxC = Math.round(subtotal * tax);
        const qtySum = g.lines.reduce((a, l) => a + l.qty, 0);
        return { ...g, subtotal_cents: subtotal, delivery_fee_cents: fee, service_fee_cents: service, tax_cents: taxC, bags: Math.max(1, Math.ceil(qtySum / bagCap)),
          total_cents: subtotal + fee + service + taxC };
      });
      return groups;
    }
    function quote(items, tip) {
      const groups = priceItems(items);
      const tipC = Math.max(0, Math.min(int(tip), 50000));
      const sum = (k) => groups.reduce((a, g) => a + g[k], 0);
      return {
        stores: groups.map((g) => ({ store_id: g.store_id, store_name: g.store_name, subtotal_cents: g.subtotal_cents, delivery_fee_cents: g.delivery_fee_cents, service_fee_cents: g.service_fee_cents, tax_cents: g.tax_cents, bags: g.bags })),
        subtotal_cents: sum('subtotal_cents'), delivery_fee_cents: sum('delivery_fee_cents'), service_fee_cents: sum('service_fee_cents'), tax_cents: sum('tax_cents'),
        tip_cents: tipC, total_cents: sum('total_cents') + tipC, min_order_cents: nset('min_order_cents'), groups
      };
    }

    /* ---- orders ---- */
    const ORDER_SELECT = `SELECT o.*, s.name AS store_name, s.slug AS store_slug, s.emoji AS store_emoji, s.color AS store_color, s.address AS store_address, s.phone AS store_phone,
      s.city AS store_city, s.zip AS store_zip, u.name AS customer_name, u.email AS customer_email, d.name AS driver_name, d.phone AS driver_phone, d.vehicle AS driver_vehicle,
      w.date AS window_date, w.start_time AS window_start, w.end_time AS window_end, w.label AS window_label, c.payment_method, c.payment_status, c.payment_intent_id
      FROM orders o JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=o.customer_id LEFT JOIN users d ON d.id=o.driver_id
      JOIN delivery_windows w ON w.id=o.window_id LEFT JOIN checkouts c ON c.id=o.checkout_id`;
    const withItemCounts = (rows) => rows.map((o) => ({ ...o, item_count: db.get('SELECT COALESCE(SUM(qty),0) AS c FROM order_items WHERE order_id=?', [o.id]).c, status_label: STATUS_LABEL[o.status] }));
    function orderDetail(id) {
      const o = db.get(ORDER_SELECT + ' WHERE o.id=?', [id]);
      if (!o) fail(404, 'Order not found');
      o.items = db.all('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [id]);
      o.events = db.all('SELECT * FROM order_events WHERE order_id=? ORDER BY id', [id]);
      o.status_label = STATUS_LABEL[o.status];
      o.item_count = o.items.reduce((a, i) => a + i.qty, 0);
      return o;
    }
    function canView(user, o) {
      if (user.role === 'admin') return true;
      if (user.role === 'customer') return o.customer_id === user.id;
      if (user.role === 'merchant') return !!db.get('SELECT 1 AS x FROM stores WHERE id=? AND owner_id=?', [o.store_id, user.id]);
      if (user.role === 'driver') return o.driver_id === user.id || (o.status === 'ready' && !o.driver_id);
      return false;
    }
    function setStatus(orderId, status, actor, note) {
      db.run('UPDATE orders SET status=?, updated_at=? WHERE id=?', [status, iso(), orderId]);
      db.run('INSERT INTO order_events(order_id,status,note,actor,at) VALUES(?,?,?,?,?)', [orderId, status, note || '', actor || 'system', iso()]);
    }
    function markCheckoutPaid(checkoutId, method) {
      const co = db.get('SELECT * FROM checkouts WHERE id=?', [checkoutId]);
      if (!co) fail(404, 'Checkout not found');
      if (co.payment_status === 'paid') return co;
      db.exec('BEGIN');
      try {
        db.run('UPDATE checkouts SET payment_status=?, payment_method=COALESCE(?,payment_method) WHERE id=?', ['paid', method || null, checkoutId]);
        for (const o of db.all("SELECT id FROM orders WHERE checkout_id=? AND status='pending_payment'", [checkoutId])) {
          for (const it of db.all('SELECT product_id, qty FROM order_items WHERE order_id=?', [o.id])) db.run('UPDATE products SET stock=MAX(0, stock-?) WHERE id=?', [it.qty, it.product_id]);
          setStatus(o.id, 'placed', 'customer', 'Payment received');
        }
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return db.get('SELECT * FROM checkouts WHERE id=?', [checkoutId]);
    }
    async function maybeTransfer(orderId) {
      if (payments.mode !== 'stripe' || !payments.transfer) return;
      const o = db.get('SELECT o.*, s.stripe_account_id, s.stripe_charges_enabled FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.id=?', [orderId]);
      if (!o || o.transfer_id || !o.stripe_account_id || !o.stripe_charges_enabled) return;
      try {
        const t = await payments.transfer({ amount: o.subtotal_cents - o.commission_cents, destination: o.stripe_account_id, transfer_group: `checkout_${o.checkout_id}`, metadata: { order: o.number } });
        db.run('UPDATE orders SET transfer_id=? WHERE id=?', [t.id, orderId]);
      } catch (e) { log('Transfer failed', e.message); }
    }

    const myStore = (user) => { const s = db.get('SELECT * FROM stores WHERE owner_id=?', [user.id]); if (!s) fail(404, 'No store found for this account'); return s; };
    const ownedOrder = (user, id) => { const s = myStore(user); const o = db.get('SELECT * FROM orders WHERE id=? AND store_id=?', [int(id), s.id]); if (!o) fail(404, 'Order not found'); return o; };

    /* ---- router ---- */
    const routes = [];
    const route = (method, path, roles, fn) => {
      const keys = [];
      const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      routes.push({ method, re, keys, roles, fn });
    };

    /* PUBLIC */
    route('GET', '/api/config', null, () => ({
      brand: 'BuckDuck', marketplace: 'StoreFront USA', payments: { mode: payments.mode, publishableKey: payments.publishableKey || null, country: 'US', currency: 'usd' },
      demo: !!deps.demo, delivery_weekday: nset('delivery_weekday'), delivery_fee_cents: nset('delivery_fee_cents'), service_fee_rate: nset('service_fee_rate'),
      min_order_cents: nset('min_order_cents'), next_window: upcomingWindows().find((w) => w.open) || null
    }));

    route('POST', '/api/auth/register', null, async ({ body }) => {
      const role = ['customer', 'merchant', 'driver'].includes(body.role) ? body.role : 'customer';
      const email = req(body.email, 'Email', 120).toLowerCase();
      if (!isEmail(email)) fail(400, 'Enter a valid email');
      const password = String(body.password || '');
      if (password.length < 8) fail(400, 'Password must be at least 8 characters');
      const name = req(body.name, 'Name', 80);
      if (db.get('SELECT id FROM users WHERE email=?', [email])) fail(409, 'An account with that email already exists');
      const hash = await hashPassword(password);
      db.exec('BEGIN');
      let uid;
      try {
        uid = db.run('INSERT INTO users(email,password_hash,name,role,phone,status,vehicle,created_at) VALUES(?,?,?,?,?,?,?,?)',
          [email, hash, name, role, str(body.phone, 30), 'active', role === 'driver' ? str(body.vehicle, 80) : null, iso()]).id;
        if (role === 'merchant') {
          const storeName = req(body.store_name, 'Store name', 80);
          let slug = slugify(storeName), n = 1;
          while (db.get('SELECT id FROM stores WHERE slug=?', [slug])) slug = `${slugify(storeName)}-${++n}`;
          db.run(`INSERT INTO stores(owner_id,name,slug,tagline,description,category,address,city,state,zip,phone,color,emoji,status,commission_rate,created_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [uid, storeName, slug, str(body.tagline, 120), str(body.description, 1000), str(body.category, 60) || 'Groceries',
            str(body.address, 160), str(body.city, 60), str(body.state, 2).toUpperCase(), str(body.zip, 10), str(body.phone, 30), '#1E3A8A', '🛒', 'pending', nset('default_commission_rate'), iso()]);
        }
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      const user = db.get('SELECT * FROM users WHERE id=?', [uid]);
      return { token: await signToken(uid), user: publicUser(user) };
    });

    route('POST', '/api/auth/login', null, async ({ body }) => {
      const email = str(body.email, 120).toLowerCase();
      const user = db.get('SELECT * FROM users WHERE email=?', [email]);
      if (!user || !(await verifyPassword(String(body.password || ''), user.password_hash))) fail(401, 'Incorrect email or password');
      if (user.status !== 'active') fail(403, 'This account is suspended. Contact support.');
      return { token: await signToken(user.id), user: publicUser(user) };
    });

    route('GET', '/api/me', ['customer', 'merchant', 'driver', 'admin'], ({ user }) => {
      const out = { user: publicUser(user) };
      if (user.role === 'merchant') out.store = db.get('SELECT * FROM stores WHERE owner_id=?', [user.id]);
      return out;
    });
    route('PUT', '/api/me', ['customer', 'merchant', 'driver', 'admin'], ({ user, body }) => {
      db.run('UPDATE users SET name=?, phone=?, vehicle=COALESCE(?,vehicle) WHERE id=?', [req(body.name || user.name, 'Name', 80), str(body.phone ?? user.phone, 30), body.vehicle ? str(body.vehicle, 80) : null, user.id]);
      return { user: publicUser(db.get('SELECT * FROM users WHERE id=?', [user.id])) };
    });

    route('GET', '/api/stores', null, ({ query }) => {
      const q = `%${str(query.q, 60)}%`;
      const cat = str(query.category, 60);
      const rows = db.all(`SELECT s.id,s.name,s.slug,s.tagline,s.category,s.city,s.state,s.color,s.emoji,s.logo_url,s.rating,
        (SELECT COUNT(*) FROM products p WHERE p.store_id=s.id AND p.active=1) AS product_count
        FROM stores s WHERE s.status='active' AND (s.name LIKE ? OR s.category LIKE ? OR s.tagline LIKE ?) ${cat ? 'AND s.category=?' : ''} ORDER BY s.rating DESC, s.name`,
        cat ? [q, q, q, cat] : [q, q, q]);
      const categories = db.all("SELECT category, COUNT(*) AS c FROM stores WHERE status='active' GROUP BY category ORDER BY c DESC").map((r) => r.category);
      return { stores: rows, categories };
    });
    route('GET', '/api/stores/:slug', null, ({ params }) => {
      const s = db.get("SELECT id,name,slug,tagline,description,category,address,city,state,zip,phone,color,emoji,logo_url,rating,status FROM stores WHERE slug=?", [params.slug]);
      if (!s || s.status !== 'active') fail(404, 'Store not found');
      const products = db.all('SELECT id,name,description,category,price_cents,unit,stock,emoji,image_url FROM products WHERE store_id=? AND active=1 ORDER BY category, name', [s.id]);
      return { store: s, products };
    });
    route('GET', '/api/search', null, ({ query }) => {
      const q = str(query.q, 60);
      if (!q) return { products: [] };
      return { products: db.all(`SELECT p.id,p.name,p.category,p.price_cents,p.unit,p.stock,p.emoji,p.image_url,s.name AS store_name,s.slug AS store_slug,s.id AS store_id
        FROM products p JOIN stores s ON s.id=p.store_id WHERE p.active=1 AND s.status='active' AND (p.name LIKE ? OR p.category LIKE ?) ORDER BY p.name LIMIT 60`, [`%${q}%`, `%${q}%`]) };
    });
    route('GET', '/api/windows', null, () => ({ windows: upcomingWindows().filter((w) => w.active) }));

    /* CHECKOUT */
    route('POST', '/api/checkout/quote', null, ({ body }) => { const q = quote(body.items, body.tip_cents); delete q.groups; return q; });

    route('POST', '/api/checkout', ['customer'], async ({ user, body }) => {
      const q = quote(body.items, body.tip_cents);
      if (q.subtotal_cents < q.min_order_cents) fail(400, `Minimum order is $${(q.min_order_cents / 100).toFixed(2)}`);
      const w = db.get('SELECT * FROM delivery_windows WHERE id=?', [int(body.window_id)]);
      if (!w) fail(400, 'Choose a delivery window');
      const wr = windowRow(w);
      if (!wr.open) fail(400, 'That delivery window is closed or full — please pick another');
      const a = body.address || {};
      const addr = { line1: req(a.line1, 'Street address', 120), line2: str(a.line2, 60), city: req(a.city, 'City', 60), state: req(a.state, 'State', 2).toUpperCase(), zip: req(a.zip, 'ZIP code', 10) };
      if (!/^\d{5}(-\d{4})?$/.test(addr.zip)) fail(400, 'Enter a valid ZIP code');
      const zips = setting('service_zips').split(',').map((z) => z.trim()).filter(Boolean);
      if (zips.length && !zips.includes(addr.zip.slice(0, 5))) fail(400, `Sorry, we don't deliver to ${addr.zip} yet`);
      const phone = req(body.phone || user.phone, 'Phone', 30);
      const base = nset('driver_base_pay_cents');
      const tipEach = Math.floor(q.tip_cents / q.groups.length);
      const tipRem = q.tip_cents - tipEach * q.groups.length;

      db.exec('BEGIN');
      let checkoutId; const orderIds = [];
      try {
        checkoutId = db.run('INSERT INTO checkouts(customer_id,total_cents,payment_status,created_at) VALUES(?,?,?,?)', [user.id, q.total_cents, 'pending', iso()]).id;
        q.groups.forEach((g, i) => {
          const tip = tipEach + (i === 0 ? tipRem : 0);
          const oid = db.run(`INSERT INTO orders(checkout_id,customer_id,store_id,window_id,status,subtotal_cents,delivery_fee_cents,service_fee_cents,tax_cents,tip_cents,total_cents,commission_cents,driver_pay_cents,bags,address_line1,address_line2,city,state,zip,phone,notes,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [checkoutId, user.id, g.store_id, w.id, 'pending_payment', g.subtotal_cents, g.delivery_fee_cents, g.service_fee_cents, g.tax_cents, tip,
            g.total_cents + tip, Math.round(g.subtotal_cents * g.commission_rate), base + tip, g.bags, addr.line1, addr.line2, addr.city, addr.state, addr.zip, phone, str(body.notes, 300), iso(), iso()]).id;
          db.run('UPDATE orders SET number=? WHERE id=?', ['BD-' + (10000 + oid), oid]);
          for (const l of g.lines) db.run('INSERT INTO order_items(order_id,product_id,name,emoji,unit,price_cents,qty) VALUES(?,?,?,?,?,?,?)', [oid, l.product.id, l.product.name, l.product.emoji, l.product.unit, l.product.price_cents, l.qty]);
          db.run('INSERT INTO order_events(order_id,status,note,actor,at) VALUES(?,?,?,?,?)', [oid, 'pending_payment', 'Checkout started', 'customer', iso()]);
          orderIds.push(oid);
        });
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }

      const intent = await payments.createIntent({ amount: q.total_cents, currency: 'usd', receipt_email: user.email,
        metadata: { checkout_id: String(checkoutId), customer_id: String(user.id), orders: orderIds.map((i) => 'BD-' + (10000 + i)).join(',') }, transfer_group: `checkout_${checkoutId}` });
      db.run('UPDATE checkouts SET payment_intent_id=? WHERE id=?', [intent.id, checkoutId]);
      return { checkout_id: checkoutId, client_secret: intent.client_secret, amount_cents: q.total_cents, order_ids: orderIds, mode: payments.mode };
    });

    route('POST', '/api/checkout/:id/confirm', ['customer'], async ({ user, params, body }) => {
      const co = db.get('SELECT * FROM checkouts WHERE id=? AND customer_id=?', [int(params.id), user.id]);
      if (!co) fail(404, 'Checkout not found');
      if (co.payment_status !== 'paid') {
        const pi = await payments.retrieveIntent(co.payment_intent_id, { method: str(body.payment_method, 30) });
        if (pi.status !== 'succeeded') fail(402, pi.status === 'processing' ? 'Payment is processing — we will confirm shortly' : 'Payment was not completed');
        markCheckoutPaid(co.id, pi.method || str(body.payment_method, 30) || 'card');
      }
      return { ok: true, orders: withItemCounts(db.all(ORDER_SELECT + ' WHERE o.checkout_id=?', [co.id])) };
    });

    route('POST', '/api/webhooks/payment', null, ({ body }) => {
      // Called by the server only after Stripe signature verification.
      if (body.type === 'payment_intent.succeeded') {
        const co = db.get('SELECT id FROM checkouts WHERE payment_intent_id=?', [str(body.intent_id, 100)]);
        if (co) markCheckoutPaid(co.id, str(body.method, 30) || 'card');
      }
      if (body.type === 'payment_intent.payment_failed') {
        db.run("UPDATE checkouts SET payment_status='failed' WHERE payment_intent_id=? AND payment_status='pending'", [str(body.intent_id, 100)]);
      }
      if (body.type === 'account.updated') {
        db.run('UPDATE stores SET stripe_charges_enabled=? WHERE stripe_account_id=?', [body.charges_enabled ? 1 : 0, str(body.account_id, 100)]);
      }
      return { received: true };
    });

    /* CUSTOMER ORDERS */
    route('GET', '/api/orders', ['customer'], ({ user }) => ({
      orders: withItemCounts(db.all(ORDER_SELECT + " WHERE o.customer_id=? AND o.status!='pending_payment' ORDER BY o.id DESC LIMIT 100", [user.id]))
    }));
    route('GET', '/api/orders/:id', ['customer', 'merchant', 'driver', 'admin'], ({ user, params }) => {
      const o = orderDetail(int(params.id));
      if (!canView(user, o)) fail(404, 'Order not found');
      if (user.role === 'driver' && o.driver_id !== user.id) { o.customer_email = undefined; }
      return { order: o };
    });
    route('POST', '/api/orders/:id/cancel', ['customer'], async ({ user, params }) => {
      const o = db.get('SELECT o.*, c.payment_intent_id FROM orders o LEFT JOIN checkouts c ON c.id=o.checkout_id WHERE o.id=? AND o.customer_id=?', [int(params.id), user.id]);
      if (!o) fail(404, 'Order not found');
      if (o.status !== 'placed') fail(400, 'This order can no longer be cancelled — the store has started preparing it');
      if (payments.refund && o.payment_intent_id) await payments.refund(o.payment_intent_id, o.total_cents);
      for (const it of db.all('SELECT product_id, qty FROM order_items WHERE order_id=?', [o.id])) db.run('UPDATE products SET stock=stock+? WHERE id=?', [it.qty, it.product_id]);
      setStatus(o.id, 'cancelled', 'customer', 'Cancelled by customer — full refund issued');
      return { order: orderDetail(o.id) };
    });

    /* MERCHANT */
    const M = ['merchant'];
    route('GET', '/api/merchant/summary', M, ({ user }) => {
      const s = myStore(user);
      const nextWin = upcomingWindows()[0];
      const nextDate = nextWin ? nextWin.date : ymd(now());
      const counts = {};
      db.all(`SELECT o.status, COUNT(*) AS c FROM orders o JOIN delivery_windows w ON w.id=o.window_id WHERE o.store_id=? AND w.date>=? AND o.status NOT IN ('pending_payment') GROUP BY o.status`, [s.id, ymd(now())])
        .forEach((r) => { counts[r.status] = r.c; });
      const wk = db.all(`SELECT w.date, COUNT(*) AS orders, SUM(o.subtotal_cents) AS sales, SUM(o.subtotal_cents-o.commission_cents) AS payout
        FROM orders o JOIN delivery_windows w ON w.id=o.window_id WHERE o.store_id=? AND o.status IN ('placed','accepted','packing','ready','picked_up','delivered')
        GROUP BY w.date ORDER BY w.date DESC LIMIT 10`, [s.id]).reverse();
      const totals = db.get(`SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal_cents),0) AS sales, COALESCE(SUM(subtotal_cents-commission_cents),0) AS payout FROM orders WHERE store_id=? AND status='delivered'`, [s.id]);
      const top = db.all(`SELECT i.name, i.emoji, SUM(i.qty) AS qty, SUM(i.qty*i.price_cents) AS revenue FROM order_items i JOIN orders o ON o.id=i.order_id
        WHERE o.store_id=? AND o.status NOT IN ('pending_payment','cancelled','refunded') GROUP BY i.product_id ORDER BY qty DESC LIMIT 5`, [s.id]);
      const lowStock = db.all('SELECT id,name,emoji,stock FROM products WHERE store_id=? AND active=1 AND stock<15 ORDER BY stock LIMIT 6', [s.id]);
      const bags = db.get(`SELECT COALESCE(SUM(o.bags),0) AS b FROM orders o JOIN delivery_windows w ON w.id=o.window_id WHERE o.store_id=? AND w.date=? AND o.status IN ('placed','accepted','packing','ready')`, [s.id, nextDate]).b;
      return { store: s, next_delivery_date: nextDate, counts, weekly: wk, totals, top_products: top, low_stock: lowStock, bags_needed: bags };
    });
    route('GET', '/api/merchant/store', M, ({ user }) => ({ store: myStore(user) }));
    route('PUT', '/api/merchant/store', M, async ({ user, body }) => {
      const s = myStore(user);
      let logo = s.logo_url;
      if (body.logo_data && saveImage) logo = await saveImage(body.logo_data);
      db.run(`UPDATE stores SET name=?, tagline=?, description=?, category=?, address=?, city=?, state=?, zip=?, phone=?, color=?, emoji=?, logo_url=? WHERE id=?`,
        [req(body.name ?? s.name, 'Store name', 80), str(body.tagline ?? s.tagline, 120), str(body.description ?? s.description, 1000), str(body.category ?? s.category, 60),
          str(body.address ?? s.address, 160), str(body.city ?? s.city, 60), str(body.state ?? s.state, 2).toUpperCase(), str(body.zip ?? s.zip, 10), str(body.phone ?? s.phone, 30),
          /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : s.color, str(body.emoji ?? s.emoji, 8) || '🛒', logo, s.id]);
      return { store: myStore(user) };
    });
    route('GET', '/api/merchant/products', M, ({ user }) => ({ products: db.all('SELECT * FROM products WHERE store_id=? ORDER BY category, name', [myStore(user).id]) }));
    const productFields = async (body, existing = {}) => {
      const price = Math.round(Number(body.price ?? (existing.price_cents / 100)) * 100);
      if (!Number.isFinite(price) || price <= 0 || price > 1000000) fail(400, 'Enter a valid price');
      let image = existing.image_url || null;
      if (body.image_data && saveImage) image = await saveImage(body.image_data);
      if (body.remove_image) image = null;
      return [req(body.name ?? existing.name, 'Product name', 100), str(body.description ?? existing.description, 500), str(body.category ?? existing.category, 60) || 'General',
        price, str(body.unit ?? existing.unit, 40), Math.max(0, int(body.stock ?? existing.stock)), str(body.emoji ?? existing.emoji, 8) || '🛒', image,
        body.active === undefined ? (existing.active ?? 1) : (body.active ? 1 : 0)];
    };
    route('POST', '/api/merchant/products', M, async ({ user, body }) => {
      const s = myStore(user);
      const f = await productFields(body);
      const id = db.run('INSERT INTO products(name,description,category,price_cents,unit,stock,emoji,image_url,active,store_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [...f, s.id, iso()]).id;
      return { product: db.get('SELECT * FROM products WHERE id=?', [id]) };
    });
    route('PUT', '/api/merchant/products/:id', M, async ({ user, params, body }) => {
      const s = myStore(user);
      const p = db.get('SELECT * FROM products WHERE id=? AND store_id=?', [int(params.id), s.id]);
      if (!p) fail(404, 'Product not found');
      const f = await productFields(body, p);
      db.run('UPDATE products SET name=?,description=?,category=?,price_cents=?,unit=?,stock=?,emoji=?,image_url=?,active=? WHERE id=?', [...f, p.id]);
      return { product: db.get('SELECT * FROM products WHERE id=?', [p.id]) };
    });
    route('DELETE', '/api/merchant/products/:id', M, ({ user, params }) => {
      const s = myStore(user);
      const r = db.run('UPDATE products SET active=0 WHERE id=? AND store_id=?', [int(params.id), s.id]);
      if (!r.changes) fail(404, 'Product not found');
      return { ok: true };
    });
    route('GET', '/api/merchant/orders', M, ({ user, query }) => {
      const s = myStore(user);
      const st = str(query.status, 20);
      const scope = str(query.scope, 10) || 'upcoming';
      const where = ['o.store_id=?', "o.status!='pending_payment'"]; const args = [s.id];
      if (st) { where.push('o.status=?'); args.push(st); }
      if (scope === 'upcoming') { where.push('w.date>=?'); args.push(ymd(now())); }
      return { orders: withItemCounts(db.all(ORDER_SELECT + ` WHERE ${where.join(' AND ')} ORDER BY w.date ${scope === 'upcoming' ? 'ASC' : 'DESC'}, w.start_time, o.id LIMIT 300`, args)) };
    });
    const MERCHANT_NEXT = { placed: ['accepted', 'cancelled'], accepted: ['packing', 'cancelled'], packing: ['ready'], ready: [] };
    route('POST', '/api/merchant/orders/:id/status', M, async ({ user, params, body }) => {
      const o = ownedOrder(user, params.id);
      const next = str(body.status, 20);
      if (!(MERCHANT_NEXT[o.status] || []).includes(next)) fail(400, `Cannot move an order from "${STATUS_LABEL[o.status]}" to "${STATUS_LABEL[next] || next}"`);
      if (next === 'cancelled') {
        const co = db.get('SELECT payment_intent_id FROM checkouts WHERE id=?', [o.checkout_id]);
        if (payments.refund && co && co.payment_intent_id) await payments.refund(co.payment_intent_id, o.total_cents);
        for (const it of db.all('SELECT product_id, qty FROM order_items WHERE order_id=?', [o.id])) db.run('UPDATE products SET stock=stock+? WHERE id=?', [it.qty, it.product_id]);
      }
      if (next === 'ready' && body.bags) db.run('UPDATE orders SET bags=? WHERE id=?', [Math.max(1, Math.min(30, int(body.bags))), o.id]);
      setStatus(o.id, next, 'merchant', str(body.note, 200) || (next === 'cancelled' ? 'Cancelled by store — customer refunded' : ''));
      return { order: orderDetail(o.id) };
    });
    route('GET', '/api/merchant/payouts', M, ({ user }) => {
      const s = myStore(user);
      const weeks = db.all(`SELECT w.date, COUNT(*) AS orders, SUM(o.subtotal_cents) AS gross, SUM(o.commission_cents) AS commission, SUM(o.subtotal_cents-o.commission_cents) AS net,
        SUM(CASE WHEN o.transfer_id IS NOT NULL THEN 1 ELSE 0 END) AS transferred
        FROM orders o JOIN delivery_windows w ON w.id=o.window_id WHERE o.store_id=? AND o.status='delivered' GROUP BY w.date ORDER BY w.date DESC LIMIT 26`, [s.id]);
      const pending = db.get(`SELECT COALESCE(SUM(subtotal_cents-commission_cents),0) AS net FROM orders WHERE store_id=? AND status IN ('placed','accepted','packing','ready','picked_up')`, [s.id]).net;
      return { store: { id: s.id, commission_rate: s.commission_rate, stripe_account_id: s.stripe_account_id, stripe_charges_enabled: !!s.stripe_charges_enabled }, weeks, pending_cents: pending, payments_mode: payments.mode };
    });
    route('POST', '/api/merchant/stripe/onboard', M, async ({ user, origin }) => {
      const s = myStore(user);
      if (!payments.onboardMerchant) fail(400, 'Payouts are not configured');
      const r = await payments.onboardMerchant({ store: s, user, returnUrl: `${origin || ''}/#/merchant/payouts` });
      if (r.accountId && r.accountId !== s.stripe_account_id) db.run('UPDATE stores SET stripe_account_id=? WHERE id=?', [r.accountId, s.id]);
      if (r.chargesEnabled !== undefined) db.run('UPDATE stores SET stripe_charges_enabled=? WHERE id=?', [r.chargesEnabled ? 1 : 0, s.id]);
      return { url: r.url || null, connected: !!r.chargesEnabled };
    });

    /* DRIVER */
    const D = ['driver'];
    route('GET', '/api/driver/summary', D, ({ user }) => {
      const wk = db.get(`SELECT COUNT(*) AS deliveries, COALESCE(SUM(driver_pay_cents),0) AS earnings, COALESCE(SUM(tip_cents),0) AS tips FROM orders WHERE driver_id=? AND status='delivered'`, [user.id]);
      const last = db.all(`SELECT w.date, COUNT(*) AS deliveries, SUM(o.driver_pay_cents) AS earnings, SUM(o.tip_cents) AS tips FROM orders o JOIN delivery_windows w ON w.id=o.window_id
        WHERE o.driver_id=? AND o.status='delivered' GROUP BY w.date ORDER BY w.date DESC LIMIT 8`, [user.id]);
      const active = db.get("SELECT COUNT(*) AS c FROM orders WHERE driver_id=? AND status IN ('ready','picked_up')", [user.id]).c;
      const available = db.get("SELECT COUNT(*) AS c FROM orders WHERE status='ready' AND driver_id IS NULL").c;
      return { user: publicUser(user), totals: wk, weeks: last, active, available, next_window: upcomingWindows()[0] || null, base_pay_cents: nset('driver_base_pay_cents') };
    });
    route('POST', '/api/driver/online', D, ({ user, body }) => {
      db.run('UPDATE users SET driver_online=? WHERE id=?', [body.online ? 1 : 0, user.id]);
      return { online: !!body.online };
    });
    route('GET', '/api/driver/available', D, () => ({
      orders: withItemCounts(db.all(ORDER_SELECT + " WHERE o.status='ready' AND o.driver_id IS NULL ORDER BY w.date, w.start_time, o.id LIMIT 100")).map((o) => ({ ...o, customer_email: undefined }))
    }));
    route('GET', '/api/driver/route', D, ({ user }) => ({
      orders: withItemCounts(db.all(ORDER_SELECT + " WHERE o.driver_id=? AND o.status IN ('ready','picked_up') ORDER BY w.date, w.start_time, o.status DESC, o.id", [user.id]))
    }));
    route('GET', '/api/driver/history', D, ({ user }) => ({
      orders: withItemCounts(db.all(ORDER_SELECT + " WHERE o.driver_id=? AND o.status='delivered' ORDER BY o.updated_at DESC LIMIT 60", [user.id]))
    }));
    route('POST', '/api/driver/orders/:id/claim', D, ({ user, params }) => {
      if (!user.driver_online) fail(400, 'Go online to accept deliveries');
      const active = db.get("SELECT COUNT(*) AS c FROM orders WHERE driver_id=? AND status IN ('ready','picked_up')", [user.id]).c;
      if (active >= 12) fail(400, 'You have reached the 12-stop route limit');
      const r = db.run("UPDATE orders SET driver_id=?, updated_at=? WHERE id=? AND status='ready' AND driver_id IS NULL", [user.id, iso(), int(params.id)]);
      if (!r.changes) fail(409, 'Another driver already accepted this delivery');
      db.run('INSERT INTO order_events(order_id,status,note,actor,at) VALUES(?,?,?,?,?)', [int(params.id), 'ready', `Driver ${user.name} assigned`, 'driver', iso()]);
      return { order: orderDetail(int(params.id)) };
    });
    route('POST', '/api/driver/orders/:id/release', D, ({ user, params }) => {
      const r = db.run("UPDATE orders SET driver_id=NULL, updated_at=? WHERE id=? AND driver_id=? AND status='ready'", [iso(), int(params.id), user.id]);
      if (!r.changes) fail(400, 'Only un-picked orders can be released');
      db.run('INSERT INTO order_events(order_id,status,note,actor,at) VALUES(?,?,?,?,?)', [int(params.id), 'ready', 'Driver released the delivery', 'driver', iso()]);
      return { ok: true };
    });
    route('POST', '/api/driver/orders/:id/status', D, async ({ user, params, body }) => {
      const o = db.get('SELECT * FROM orders WHERE id=? AND driver_id=?', [int(params.id), user.id]);
      if (!o) fail(404, 'Order not found');
      const next = str(body.status, 20);
      const ok = (o.status === 'ready' && next === 'picked_up') || (o.status === 'picked_up' && next === 'delivered');
      if (!ok) fail(400, 'Invalid status change');
      if (next === 'delivered') {
        const proof = str(body.proof_note, 200);
        if (!proof) fail(400, 'Add a delivery note (e.g. "Left at front door")');
        let photo = null;
        if (body.photo_data && saveImage) photo = await saveImage(body.photo_data);
        db.run('UPDATE orders SET proof_note=? WHERE id=?', [photo ? `${proof} | photo: ${photo}` : proof, o.id]);
      }
      setStatus(o.id, next, 'driver', next === 'picked_up' ? `Picked up by ${user.name}` : str(body.proof_note, 200));
      if (next === 'delivered') await maybeTransfer(o.id);
      return { order: orderDetail(o.id) };
    });

    /* ADMIN */
    const A = ['admin'];
    route('GET', '/api/admin/overview', A, () => {
      const live = "('placed','accepted','packing','ready','picked_up','delivered')";
      const tot = db.get(`SELECT COUNT(*) AS orders, COALESCE(SUM(total_cents),0) AS gmv, COALESCE(SUM(commission_cents+service_fee_cents+delivery_fee_cents-(driver_pay_cents-tip_cents)),0) AS net_revenue,
        COALESCE(AVG(total_cents),0) AS aov FROM orders WHERE status IN ${live}`);
      const weekly = db.all(`SELECT w.date, COUNT(*) AS orders, SUM(o.total_cents) AS gmv, SUM(o.commission_cents+o.service_fee_cents+o.delivery_fee_cents-(o.driver_pay_cents-o.tip_cents)) AS revenue
        FROM orders o JOIN delivery_windows w ON w.id=o.window_id WHERE o.status IN ${live} GROUP BY w.date ORDER BY w.date DESC LIMIT 10`).reverse();
      const statuses = {}; db.all(`SELECT o.status, COUNT(*) AS c FROM orders o JOIN delivery_windows w ON w.id=o.window_id WHERE w.date>=? AND o.status!='pending_payment' GROUP BY o.status`, [ymd(now())]).forEach((r) => { statuses[r.status] = r.c; });
      const topStores = db.all(`SELECT s.name, s.emoji, s.color, COUNT(o.id) AS orders, COALESCE(SUM(o.subtotal_cents),0) AS sales FROM stores s LEFT JOIN orders o ON o.store_id=s.id AND o.status IN ${live}
        WHERE s.status='active' GROUP BY s.id ORDER BY sales DESC LIMIT 6`);
      const counts = {
        customers: db.get("SELECT COUNT(*) AS c FROM users WHERE role='customer'").c,
        stores: db.get("SELECT COUNT(*) AS c FROM stores WHERE status='active'").c,
        pending_stores: db.get("SELECT COUNT(*) AS c FROM stores WHERE status='pending'").c,
        drivers: db.get("SELECT COUNT(*) AS c FROM users WHERE role='driver'").c,
        drivers_online: db.get("SELECT COUNT(*) AS c FROM users WHERE role='driver' AND driver_online=1").c,
        unassigned_ready: db.get("SELECT COUNT(*) AS c FROM orders WHERE status='ready' AND driver_id IS NULL").c
      };
      const windows = upcomingWindows().slice(0, 4);
      const payMix = db.all("SELECT payment_method AS method, COUNT(*) AS c FROM checkouts WHERE payment_status='paid' GROUP BY payment_method");
      return { totals: tot, weekly, statuses, top_stores: topStores, counts, windows, payment_mix: payMix };
    });
    route('GET', '/api/admin/stores', A, () => ({
      stores: db.all(`SELECT s.*, u.name AS owner_name, u.email AS owner_email,
        (SELECT COUNT(*) FROM products p WHERE p.store_id=s.id AND p.active=1) AS product_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id=s.id AND o.status='delivered') AS delivered_orders,
        (SELECT COALESCE(SUM(subtotal_cents),0) FROM orders o WHERE o.store_id=s.id AND o.status='delivered') AS sales_cents
        FROM stores s JOIN users u ON u.id=s.owner_id ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.name`)
    }));
    route('POST', '/api/admin/stores/:id', A, ({ params, body }) => {
      const s = db.get('SELECT * FROM stores WHERE id=?', [int(params.id)]);
      if (!s) fail(404, 'Store not found');
      const status = ['pending', 'active', 'suspended'].includes(body.status) ? body.status : s.status;
      let rate = body.commission_rate === undefined ? s.commission_rate : Number(body.commission_rate);
      if (!(rate >= 0 && rate <= 0.5)) fail(400, 'Commission must be between 0% and 50%');
      db.run('UPDATE stores SET status=?, commission_rate=? WHERE id=?', [status, rate, s.id]);
      return { store: db.get('SELECT * FROM stores WHERE id=?', [s.id]) };
    });
    route('GET', '/api/admin/users', A, ({ query }) => {
      const role = str(query.role, 20); const q = `%${str(query.q, 60)}%`;
      const args = [q, q]; let where = '(name LIKE ? OR email LIKE ?)';
      if (role) { where += ' AND role=?'; args.push(role); }
      return { users: db.all(`SELECT id,email,name,role,phone,status,driver_online,vehicle,created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id=users.id AND o.status!='pending_payment') AS order_count FROM users WHERE ${where} ORDER BY created_at DESC LIMIT 300`, args) };
    });
    route('POST', '/api/admin/users/:id', A, ({ user, params, body }) => {
      const u = db.get('SELECT * FROM users WHERE id=?', [int(params.id)]);
      if (!u) fail(404, 'User not found');
      if (u.id === user.id) fail(400, 'You cannot change your own account status');
      const status = ['active', 'suspended'].includes(body.status) ? body.status : u.status;
      db.run('UPDATE users SET status=? WHERE id=?', [status, u.id]);
      if (status === 'suspended' && u.role === 'driver') { db.run("UPDATE orders SET driver_id=NULL WHERE driver_id=? AND status='ready'", [u.id]); db.run('UPDATE users SET driver_online=0 WHERE id=?', [u.id]); }
      return { user: publicUser(db.get('SELECT * FROM users WHERE id=?', [u.id])) };
    });
    route('GET', '/api/admin/orders', A, ({ query }) => {
      const where = ["o.status!='pending_payment'"]; const args = [];
      if (query.status) { where.push('o.status=?'); args.push(str(query.status, 20)); }
      if (query.window_id) { where.push('o.window_id=?'); args.push(int(query.window_id)); }
      if (query.q) { where.push('(o.number LIKE ? OR u.name LIKE ? OR s.name LIKE ?)'); const q = `%${str(query.q, 60)}%`; args.push(q, q, q); }
      return { orders: withItemCounts(db.all(ORDER_SELECT + ` WHERE ${where.join(' AND ')} ORDER BY w.date DESC, o.id DESC LIMIT 300`, args)) };
    });
    route('POST', '/api/admin/orders/:id', A, async ({ params, body }) => {
      const o = db.get('SELECT * FROM orders WHERE id=?', [int(params.id)]);
      if (!o) fail(404, 'Order not found');
      if (body.driver_id !== undefined) {
        if (body.driver_id) {
          const d = db.get("SELECT * FROM users WHERE id=? AND role='driver' AND status='active'", [int(body.driver_id)]);
          if (!d) fail(400, 'Driver not found');
          if (!['ready', 'picked_up', 'placed', 'accepted', 'packing'].includes(o.status)) fail(400, 'Order is closed');
          db.run('UPDATE orders SET driver_id=?, updated_at=? WHERE id=?', [d.id, iso(), o.id]);
          db.run('INSERT INTO order_events(order_id,status,note,actor,at) VALUES(?,?,?,?,?)', [o.id, o.status, `Assigned to ${d.name} by admin`, 'admin', iso()]);
        } else {
          db.run('UPDATE orders SET driver_id=NULL, updated_at=? WHERE id=?', [iso(), o.id]);
        }
      }
      if (body.status && body.status !== o.status) {
        if (!ORDER_FLOW.includes(body.status) && body.status !== 'cancelled') fail(400, 'Invalid status');
        setStatus(o.id, body.status, 'admin', str(body.note, 200) || 'Updated by operations');
        if (body.status === 'delivered') await maybeTransfer(o.id);
      }
      return { order: orderDetail(o.id) };
    });
    route('POST', '/api/admin/orders/:id/refund', A, async ({ params, body }) => {
      const o = db.get('SELECT o.*, c.payment_intent_id FROM orders o LEFT JOIN checkouts c ON c.id=o.checkout_id WHERE o.id=?', [int(params.id)]);
      if (!o) fail(404, 'Order not found');
      if (['refunded', 'cancelled', 'pending_payment'].includes(o.status)) fail(400, 'Order is not refundable');
      const amount = body.amount_cents ? Math.min(int(body.amount_cents), o.total_cents) : o.total_cents;
      if (payments.refund && o.payment_intent_id) await payments.refund(o.payment_intent_id, amount);
      if (amount >= o.total_cents) setStatus(o.id, 'refunded', 'admin', str(body.reason, 200) || 'Full refund');
      else db.run('INSERT INTO order_events(order_id,status,note,actor,at) VALUES(?,?,?,?,?)', [o.id, o.status, `Partial refund $${(amount / 100).toFixed(2)} — ${str(body.reason, 160)}`, 'admin', iso()]);
      return { order: orderDetail(o.id) };
    });
    route('GET', '/api/admin/drivers', A, () => ({
      drivers: db.all(`SELECT u.id,u.name,u.email,u.phone,u.vehicle,u.status,u.driver_online,
        (SELECT COUNT(*) FROM orders o WHERE o.driver_id=u.id AND o.status='delivered') AS deliveries,
        (SELECT COALESCE(SUM(driver_pay_cents),0) FROM orders o WHERE o.driver_id=u.id AND o.status='delivered') AS earnings,
        (SELECT COUNT(*) FROM orders o WHERE o.driver_id=u.id AND o.status IN ('ready','picked_up')) AS active
        FROM users u WHERE u.role='driver' ORDER BY u.driver_online DESC, u.name`)
    }));
    route('GET', '/api/admin/windows', A, () => {
      ensureWindows();
      return { windows: db.all('SELECT * FROM delivery_windows WHERE date >= ? ORDER BY date, start_time', [ymd(new Date(now().getTime() - 14 * 86400000))]).map(windowRow) };
    });
    route('POST', '/api/admin/windows', A, ({ body }) => {
      const date = req(body.date, 'Date', 10), s = req(body.start_time, 'Start', 5), e = req(body.end_time, 'End', 5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e) || s >= e) fail(400, 'Enter a valid date and time range');
      if (db.get('SELECT id FROM delivery_windows WHERE date=? AND start_time=?', [date, s])) fail(409, 'A window already starts at that time');
      const id = db.run('INSERT INTO delivery_windows(date,start_time,end_time,label,capacity,active) VALUES(?,?,?,?,?,1)', [date, s, e, windowLabel(s, e), Math.max(1, int(body.capacity, 120))]).id;
      return { window: windowRow(db.get('SELECT * FROM delivery_windows WHERE id=?', [id])) };
    });
    route('PUT', '/api/admin/windows/:id', A, ({ params, body }) => {
      const w = db.get('SELECT * FROM delivery_windows WHERE id=?', [int(params.id)]);
      if (!w) fail(404, 'Window not found');
      db.run('UPDATE delivery_windows SET capacity=?, active=? WHERE id=?', [Math.max(0, int(body.capacity ?? w.capacity)), body.active === undefined ? w.active : (body.active ? 1 : 0), w.id]);
      return { window: windowRow(db.get('SELECT * FROM delivery_windows WHERE id=?', [w.id])) };
    });
    route('GET', '/api/admin/settings', A, () => ({ settings: allSettings() }));
    route('PUT', '/api/admin/settings', A, ({ body }) => {
      const numeric = ['delivery_fee_cents', 'service_fee_rate', 'service_fee_min_cents', 'tax_rate', 'default_commission_rate', 'driver_base_pay_cents', 'order_cutoff_hours', 'windows_weeks_ahead', 'default_window_capacity', 'delivery_weekday', 'min_order_cents', 'bag_item_capacity'];
      for (const [k, v] of Object.entries(body || {})) {
        if (!(k in DEFAULT_SETTINGS)) continue;
        if (numeric.includes(k) && !(Number(v) >= 0)) fail(400, `Invalid value for ${k}`);
        if (k === 'delivery_weekday' && !(Number(v) >= 0 && Number(v) <= 6)) fail(400, 'Delivery day must be 0–6');
        if (k === 'default_slots') { try { const s = JSON.parse(v); if (!Array.isArray(s) || !s.every((x) => Array.isArray(x) && x.length === 2)) throw 0; } catch { fail(400, 'Slots must look like [["06:00","12:00"]]'); } }
        db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, String(v)]);
      }
      return { settings: allSettings() };
    });
    route('GET', '/api/admin/finance', A, () => {
      const rows = db.all(`SELECT w.date, COUNT(*) AS orders, SUM(o.total_cents) AS gmv, SUM(o.subtotal_cents) AS merchandise, SUM(o.commission_cents) AS commission,
        SUM(o.service_fee_cents) AS service_fees, SUM(o.delivery_fee_cents) AS delivery_fees, SUM(o.tip_cents) AS tips, SUM(o.driver_pay_cents) AS driver_pay,
        SUM(o.subtotal_cents-o.commission_cents) AS merchant_payouts
        FROM orders o JOIN delivery_windows w ON w.id=o.window_id WHERE o.status='delivered' GROUP BY w.date ORDER BY w.date DESC LIMIT 26`);
      rows.forEach((r) => { r.net_revenue = r.commission + r.service_fees + r.delivery_fees - (r.driver_pay - r.tips); });
      const refunds = db.get("SELECT COUNT(*) AS c, COALESCE(SUM(total_cents),0) AS amt FROM orders WHERE status='refunded'");
      return { weeks: rows, refunds };
    });

    async function handle({ method, path, query = {}, body = {}, token, origin }) {
      try {
        const rt = routes.find((x) => x.method === method && x.re.test(path));
        if (!rt) fail(404, 'Not found');
        const m = path.match(rt.re); const params = {};
        rt.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        let user = null;
        if (token) {
          const uid = await verifyToken(token);
          if (uid) { user = db.get('SELECT * FROM users WHERE id=?', [uid]); if (user && user.status !== 'active') user = null; }
        }
        if (rt.roles) { if (!user) fail(401, 'Please sign in to continue'); if (!rt.roles.includes(user.role)) fail(403, 'You do not have access to this area'); }
        const data = await rt.fn({ params, query, body: body || {}, user, origin });
        return { status: 200, body: data };
      } catch (e) {
        if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
        log(e);
        return { status: 500, body: { error: 'Something went wrong. Please try again.' } };
      }
    }

    return { handle, markCheckoutPaid, ensureWindows };
  }

  return { SCHEMA, DEFAULT_SETTINGS, STATUS_LABEL, initDb, createApi, slugify };
});
</script>