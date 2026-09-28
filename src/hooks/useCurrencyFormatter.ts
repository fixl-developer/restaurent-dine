import { useCurrency } from "@/context/CurrencyContext";
import { formatCurrency as formatCurrencyStatic } from "@/lib/currencies";

/**
 * Hook that returns a currency-aware formatter based on restaurant settings
 * Usage: const fmt = useCurrencyFormatter(); fmt(340.00)
 */
export function useCurrencyFormatter(override?: string) {
  const { currency } = useCurrency();

  return (amount: number): string => {
    return formatCurrencyStatic(amount, override ?? currency);
  };
}
