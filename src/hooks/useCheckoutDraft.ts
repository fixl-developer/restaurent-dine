import { useSyncExternalStore } from "react";
import {
  changeCheckout,
  readCheckout,
  subscribeCheckout,
  type CheckoutDraft,
} from "@/lib/checkoutDraft";

export function useCheckoutDraft(scope: string) {
  const draft = useSyncExternalStore(
    (listener) => subscribeCheckout(scope, listener),
    () => readCheckout(scope),
  );
  const field =
    <K extends "cart" | "guestName" | "guestPhone" | "guestNotes" | "pickupAt">(
      name: K,
    ) =>
    (
      value:
        | CheckoutDraft[K]
        | ((previous: CheckoutDraft[K]) => CheckoutDraft[K]),
    ) =>
      changeCheckout(scope, draft.key, name, value);
  return { draft, field };
}
