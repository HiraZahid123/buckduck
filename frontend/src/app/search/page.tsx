'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '../../context/CartContext';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { items, addToCart, updateQty } = useCart();

  useEffect(() => {
    async function search() {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }
    search();
  }, [query]);

  const getCartQty = (productId: number) => {
    const found = items.find((i) => i.product.id === productId);
    return found ? found.qty : 0;
  };

  return (
    <div className="container" style={{ padding: '36px 20px' }}>
      <div className="section-h">
        <div>
          <h2>Search Results</h2>
          <p className="muted small">
            {query ? `Showing results for "${query}"` : 'Browse all products'}
          </p>
        </div>
        <span className="badge b-blue">{products.length} Items Found</span>
      </div>

      {loading ? (
        <div className="card center" style={{ padding: 40 }}>
          <p className="muted">Searching marketplace catalog...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="card center" style={{ padding: 50 }}>
          <h3>No products found</h3>
          <p className="muted">Try searching for gari, egusi, goat, plantain, yam, or spices.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Browse Stores
          </Link>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => {
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
                  {p.unit} ·{' '}
                  <Link href={`/stores/${p.stores?.slug}`} className="muted" style={{ fontWeight: 600 }}>
                    {p.stores?.name}
                  </Link>
                </div>

                {qty === 0 ? (
                  <button
                    className="btn btn-primary btn-block add-btn"
                    onClick={() => addToCart(p)}
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
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: 40 }}>Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
