"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = { productId: string; variantId: string; quantity: number };
type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  add: (productId: string, variantId: string) => void;
  setQuantity: (productId: string, variantId: string, quantity: number) => void;
  remove: (productId: string, variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "qurraojos-cart-v1";

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is CartItem =>
      typeof item?.productId === "string" &&
      typeof item?.variantId === "string" &&
      Number.isInteger(item?.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 20,
    );
  } catch (error) {
    console.error("Unable to restore the saved cart:", error);
    return [];
  }
}

function writeStoredCart(items: CartItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Unable to persist the cart:", error);
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStoredCart(items);
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    hydrated,
    add(productId, variantId) {
      setItems((current) => {
        const existing = current.find((item) => item.productId === productId && item.variantId === variantId);
        if (existing) return current.map((item) =>
          item === existing ? { ...item, quantity: Math.min(item.quantity + 1, 20) } : item,
        );
        return [...current, { productId, variantId, quantity: 1 }];
      });
    },
    setQuantity(productId, variantId, quantity) {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return;
      setItems((current) => current.map((item) =>
        item.productId === productId && item.variantId === variantId ? { ...item, quantity } : item,
      ));
    },
    remove(productId, variantId) {
      setItems((current) => current.filter((item) => item.productId !== productId || item.variantId !== variantId));
    },
    clear() {
      setItems([]);
    },
  }), [items, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
