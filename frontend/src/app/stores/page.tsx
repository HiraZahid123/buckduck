'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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
  color: string;
  emoji: string;
  rating: number;
  products?: any[];
  product_count?: number;
}

function StoresContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';

  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [storesRes, catsRes] = await Promise.all([
          fetch('/api/stores'),
          fetch('/api/stores/categories'),
        ]);

        if (storesRes.ok) setStores(await storesRes.json());
        if (catsRes.ok) setCategories(await catsRes.json());
      } catch (err) {
        console.error('Failed to load stores', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredStores =
    selectedCategory === 'All'
      ? stores
      : stores.filter(
          (s) => s.category?.toLowerCase() === selectedCategory.toLowerCase()
        );

  return (
    <div className="container section">
      <div className="section-h">
        <div>
          <h2>All stores</h2>
          <p className="muted mb0">Every store delivers on Saturdays in sealed BuckDuck bags.</p>
        </div>
      </div>

      <div className="chips mb16">
        {['All', ...Array.from(new Set(categories.filter((c) => c && c.toLowerCase() !== 'all')))].map((c) => (
          <button
            key={c}
            className={`chip ${selectedCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
            onClick={() => setSelectedCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card center" style={{ padding: 40 }}>
          <div className="spin" style={{ margin: '0 auto 8px' }} />
          <p className="muted">Loading stores...</p>
        </div>
      ) : filteredStores.length > 0 ? (
        <div className="store-grid">
          {filteredStores.map((store) => (
            <Link
              key={store.id}
              href={`/stores/${store.slug}`}
              className="store-card"
            >
              <div
                className="cover"
                style={{
                  background: `linear-gradient(135deg, ${store.color || '#1E3A8A'}, ${store.color || '#1E3A8A'}cc), var(--navy-900)`,
                }}
              >
                <div className="avatar">{store.emoji || '🛒'}</div>
              </div>
              <div className="body">
                <h3 className="mb0">{store.name}</h3>
                <div className="muted small">
                  {store.tagline || store.category}
                </div>
                <div className="meta">
                  <span>★ {Number(store.rating || 4.8).toFixed(1)}</span>
                  <span>· {store.category}</span>
                  <span>· {store.products?.length || store.product_count || 12} items</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="e">🏪</div>
          <h3>No stores match</h3>
          <p className="muted">Try selecting a different category.</p>
        </div>
      )}
    </div>
  );
}

export default function StoresPage() {
  return (
    <Suspense fallback={<div className="container section center"><div className="spin" /></div>}>
      <StoresContent />
    </Suspense>
  );
}
