import { createContext, useContext, useEffect, useState } from "react";
import { usePublicRestaurant } from "@/hooks/useRestaurant";
import type { CurrencyCode } from "@/lib/currencies";

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: restaurant, isLoading } = usePublicRestaurant();
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  useEffect(() => {
    if (restaurant?.currency) {
      setCurrency(restaurant.currency as CurrencyCode);
    }
  }, [restaurant?.currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}
