"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CartItem } from "./seed-data";
import { fetchSystemSettings } from "./seed-data";
import type { GiftInfo } from "./types";

// Export edildi — arazi sayfası direkt kullanabilsin
export interface ReservationInfo {
  orderId: string;
  items: CartItem[];
  expiresAt: number;
  gift?: GiftInfo | null;  // Hediye ekimi (opsiyonel)
}

interface CartContextType {
  // Fiziksel sepet (siparis - timer yok)
  seedItems: CartItem[];
  addSeedItem: (item: CartItem) => void;
  removeSeedItem: (index: number) => void;
  updateSeedQty: (index: number, newQty: number) => void;
  clearSeedCart: () => void;
  seedTotalPrice: number;
  seedTotalItems: number;
  // Rezervasyon sepeti (dinamik timer)
  reservation: ReservationInfo | null;
  setReservation: (info: ReservationInfo) => void;
  clearReservation: () => void;
  timeLeft: number;
  isExpired: boolean;
  reservationTtlMinutes: number; // Admin'den gelen dinamik TTL
  // Otonom Karbon Aboneliği (MRR)
  isSubscription: boolean;
  setIsSubscription: (v: boolean) => void;
  // Genel
  totalPrice: number;
  totalItems: number;
  // System state
  maintenanceMode: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // -- Dinamik ayarlar (DB'den gelir) --
  const [reservationTtlMinutes, setReservationTtlMinutes] = useState(5);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Uygulama açılışında sistem ayarlarını çek
  useEffect(() => {
    fetchSystemSettings().then((settings) => {
      setReservationTtlMinutes(settings.reservationTtlMinutes);
      setMaintenanceMode(settings.maintenanceMode);
    });
  }, []);

  // -- Otonom Karbon Aboneliği (MRR toggle) --
  const [isSubscription, setIsSubscription] = useState(false);

  // -- Fiziksel tohum sepeti (timer yok) --
  const [seedItems, setSeedItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // localStorage'dan sepeti yükle (SSR-safe — yalnızca client'ta çalışır)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("stg_seed_cart");
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) setSeedItems(parsed);
      }
    } catch { /* bozuk veri — yoksay */ }
    setHydrated(true);
  }, []);

  // Sepet değiştiğinde localStorage'a yaz
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (seedItems.length > 0) {
        localStorage.setItem("stg_seed_cart", JSON.stringify(seedItems));
      } else {
        localStorage.removeItem("stg_seed_cart");
      }
    } catch { /* quota aşımı vb. — yoksay */ }
  }, [seedItems, hydrated]);

  const addSeedItem = useCallback((item: CartItem) => {
    setSeedItems((prev) => [...prev, item]);
  }, []);

  const removeSeedItem = useCallback((index: number) => {
    setSeedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateSeedQty = useCallback((index: number, newQty: number) => {
    setSeedItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: newQty, totalPrice: (item.pricePerSeed ?? item.seedType?.price ?? 0) * newQty }
          : item
      )
    );
  }, []);

  const clearSeedCart = useCallback(() => setSeedItems([]), []);

  // -- Arazi rezervasyon sepeti (dinamik timer) --
  const [reservation, setReservationState] = useState<ReservationInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  // Rezervasyonu localStorage'dan yükle (SSR-safe)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("stg_reservation");
      if (saved) {
        const parsed = JSON.parse(saved) as ReservationInfo;
        if (parsed?.orderId && parsed.expiresAt > Date.now()) {
          setReservationState(parsed);
        } else {
          localStorage.removeItem("stg_reservation");
        }
      }
    } catch { /* bozuk veri — yoksay */ }
  }, []);

  // Rezervasyon değiştiğinde localStorage'a yaz
  useEffect(() => {
    try {
      if (reservation) {
        localStorage.setItem("stg_reservation", JSON.stringify(reservation));
      } else {
        localStorage.removeItem("stg_reservation");
      }
    } catch { /* yoksay */ }
  }, [reservation]);

  const setReservation = useCallback((info: ReservationInfo) => {
    setReservationState(info);
    setIsExpired(false);
  }, []);

  const clearReservation = useCallback(async () => {
    if (reservation?.orderId) {
      try {
        await fetch("/api/orders/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: reservation.orderId }),
        });
      } catch (e) {
        console.error("Release failed:", e);
      }
    }
    setReservationState(null);
    setTimeLeft(0);
    setIsExpired(false);
  }, [reservation]);

  // Geri sayım (sadece rezervasyon için)
  useEffect(() => {
    if (!reservation) { setTimeLeft(0); return; }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((reservation.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
        if (reservation.orderId) {
          fetch("/api/orders/release", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: reservation.orderId }),
          }).catch(console.error);
        }
        setReservationState(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reservation]);

  // Toplamlar
  const seedTotalPrice = seedItems.reduce((s, i) => s + i.totalPrice, 0);
  const seedTotalItems = seedItems.reduce((s, i) => s + i.quantity, 0);
  const resTotalPrice = reservation ? reservation.items.reduce((s, i) => s + i.totalPrice, 0) : 0;
  const resTotalItems = reservation ? reservation.items.reduce((s, i) => s + i.quantity, 0) : 0;

  return (
    <CartContext.Provider value={{
      seedItems, addSeedItem, removeSeedItem, updateSeedQty, clearSeedCart,
      seedTotalPrice, seedTotalItems,
      reservation, setReservation, clearReservation,
      timeLeft, isExpired, reservationTtlMinutes,
      isSubscription, setIsSubscription,
      totalPrice: seedTotalPrice + resTotalPrice,
      totalItems: seedTotalItems + resTotalItems,
      maintenanceMode,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
