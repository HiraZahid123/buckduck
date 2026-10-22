'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  product: {
    id: number;
    store_id: number;
    name: string;
    price_cents: number;
    unit?: string;
    emoji?: string;
    image_url?: string;
    stores?: {
      id: number;
      name: string;
      color?: string;
      emoji?: string;
      commission_rate?: number;
    };
  };
  qty: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, qty?: number) => void;
  updateQty: (productId: number, qty: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  serviceFeeCents: number;
  storeCount: number;
  storesGrouped: { [storeId: number]: { store: any; items: CartItem[]; subtotal: number; bags: number } };
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const CartContext = createContext<CartContextType>({} as CartContextType);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bd_cart');
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveCart = (newItems: CartItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem('bd_cart', JSON.stringify(newItems));
    } catch {
      // ignore
    }
  };

  const addToCart = (product: any, qty: number = 1) => {
    const existingIndex = items.findIndex((i) => i.product.id === product.id);
    let newItems: CartItem[];
    if (existingIndex > -1) {
      newItems = [...items];
      newItems[existingIndex].qty += qty;
    } else {
      newItems = [...items, { product, qty }];
    }
    saveCart(newItems);
    setIsDrawerOpen(true);
  };

  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    const newItems = items.map((i) => (i.product.id === productId ? { ...i, qty } : i));
    saveCart(newItems);
  };

  const removeFromCart = (productId: number) => {
    const newItems = items.filter((i) => i.product.id !== productId);
    saveCart(newItems);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);

  // Group by store and compute totals
  const storesGrouped: { [storeId: number]: { store: any; items: CartItem[]; subtotal: number; bags: number } } = {};
  let subtotalCents = 0;
  let itemCount = 0;

  for (const item of items) {
    const sId = item.product.store_id;
    const itemTotal = item.product.price_cents * item.qty;
    subtotalCents += itemTotal;
    itemCount += item.qty;

    if (!storesGrouped[sId]) {
      storesGrouped[sId] = {
        store: item.product.stores || { id: sId, name: 'Partner Store' },
        items: [],
        subtotal: 0,
        bags: 0,
      };
    }

    storesGrouped[sId].items.push(item);
    storesGrouped[sId].subtotal += itemTotal;
  }

  // Calculate bags per store
  for (const sId of Object.keys(storesGrouped)) {
    const totalQty = storesGrouped[sId].items.reduce((acc, it) => acc + it.qty, 0);
    storesGrouped[sId].bags = Math.max(1, Math.ceil(totalQty / 10));
  }

  const storeCount = Object.keys(storesGrouped).length;
  const deliveryFeeCents = 599 * storeCount; // $5.99 per store
  const serviceFeeCents = subtotalCents > 0 ? Math.max(199, Math.round(subtotalCents * 0.05)) : 0; // 5%, min $1.99

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
        itemCount,
        subtotalCents,
        deliveryFeeCents,
        serviceFeeCents,
        storeCount,
        storesGrouped,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
