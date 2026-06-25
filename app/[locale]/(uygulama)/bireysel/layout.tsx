"use client";

import { CartProvider } from "@/lib/cart-context";
import Cart from "@/components/Cart";

export default function BireyselLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <Cart />
    </CartProvider>
  );
}
