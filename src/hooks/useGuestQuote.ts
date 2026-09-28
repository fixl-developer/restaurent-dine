import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { GuestCartLine, GuestOrderItemInput } from "@/lib/dto/guest";
import type { OrderTotalsDto } from "@/lib/dto/orders";

export function cartItems(cart: GuestCartLine[]): GuestOrderItemInput[] {
  return cart.map((line) => ({
    itemId: line.itemId || undefined,
    comboId: line.comboId,
    variantId: line.variantId,
    qty: line.qty,
    notes: line.notes,
    modifiers: line.modifiers.map((modifier) => ({
      groupId: modifier.groupId,
      modifierId: modifier.modifierId,
    })),
  }));
}
export function useGuestQuote(cart: GuestCartLine[]) {
  const items = cartItems(cart);
  return useQuery({
    queryKey: ["guest-quote", items],
    enabled: items.length > 0,
    queryFn: () =>
      api.post<{
        currency: string;
        taxInclusive: boolean;
        totals: OrderTotalsDto;
      }>("/guest/orders/quote", { items }, { noAuth: true }),
    staleTime: 15_000,
    retry: false,
  });
}
