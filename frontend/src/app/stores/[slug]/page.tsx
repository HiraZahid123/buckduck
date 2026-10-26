'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCart } from '../../../context/CartContext';

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  unit: string;
  stock: number;
  emoji: string;
  image_url: string;
  store_id: number;
}

interface Store {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  color: string;
  emoji: string;
  rating: number;
  products: Product[];
}

export default function StoreDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [store, setStore] = useState<Store | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const { items, addToCart, updateQty } = useCart();

  useEffect(() => {
    async function loadStore() {
      try {
        const res = await fetch(`/api/stores/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setStore(data);
        }
      } catch (err) {
        console.error('Failed to load store', err);
      } finally {
        setLoading(false);
      }
    }
    if (slug) loadStore();
  }, [slug]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p className="muted">Loading store catalog...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h2>Store Not Found</h2>
        <p className="muted">The store you are looking for does not exist or is inactive.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
          Return to Marketplace
        </Link>
      </div>
    );
  }

  // Categories in this store
  const storeCategories = ['All', ...Array.from(new Set(store.products.map((p) => p.category)))];

  const filteredProducts =
    selectedCategory === 'All'
      ? store.products
      : store.products.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());

  // Helper to get cart quantity for a product
  const getCartQty = (productId: number) => {
    const found = items.find((i) => i.product.id === productId);
    return found ? found.qty : 0;
  };

  return (
    <div>
      {/* Store Banner */}
      <div className="store-hero" style={{ background: store.color || '#1E3A8A' }}>
        <div className="container" style={{ display: 'block' }}>
          {/* Back to all stores navigation */}
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/stores"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '6px 14px',
                borderRadius: 20,
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>←</span>
              <span>Back to all stores</span>
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="avatar">{store.emoji || '🛒'}</div>
            <div>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <span className="badge b-gold">{store.category}</span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                  ★ {store.rating || 4.9}
                </span>
              </div>
              <h1 style={{ color: '#fff', fontSize: 32, marginBottom: 4 }}>{store.name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, margin: 0 }}>
                {store.tagline || store.description}
              </p>
              <div className="small" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
                📍 {store.address}, {store.city}, {store.state} · 📞 {store.phone} · 📦 Packed in BuckDuck bags
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products & Catalog */}
      <div className="container" style={{ padding: '32px 20px' }}>
        {/* Category Filter */}
        <div className="chips mb16">
          {storeCategories.map((c) => (
            <button
              key={c}
              className={`chip ${selectedCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
              onClick={() => setSelectedCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="product-grid">
          {filteredProducts.map((p) => {
            const qty = getCartQty(p.id);
            const priceFormatted = `$${(p.price_cents / 100).toFixed(2)}`;

            return (
              <div key={p.id} className="product">
                <div className="img">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} />
                  ) : (
                    <span>{p.emoji || '🛒'}</span>
                  )}
                </div>

                <div className="price">{priceFormatted}</div>
                <div className="name" title={p.name}>
                  {p.name}
                </div>
                <div className="unit">
                  {p.unit} · <span className="muted">{p.category}</span>
                </div>

                {qty === 0 ? (
                  <button
                    className="btn btn-primary btn-block add-btn"
                    onClick={() =>
                      addToCart({
                        ...p,
                        stores: {
                          id: store.id,
                          name: store.name,
                          color: store.color,
                          emoji: store.emoji,
                        },
                      })
                    }
                  >
                    + Add to Cart
                  </button>
                ) : (
                  <div className="stepper">
                    <button onClick={() => updateQty(p.id, qty - 1)}>-</button>
                    <span>{qty}</span>
                    <button onClick={() => updateQty(p.id, qty + 1)}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Back Link */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <Link href="/" className="btn btn-ghost">
            ← Back to All Stores
          </Link>
        </div>
      </div>
    </div>
  );
}
