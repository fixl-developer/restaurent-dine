import type { GuestCartLine } from "./dto/guest";
import { api, ApiError } from "./api";

export interface CheckoutDraft {
  version: 1;
  key: string;
  cart: GuestCartLine[];
  guestName: string;
  guestPhone: string;
  guestNotes: string;
  pickupAt: string;
  pending?: {
    path: string;
    body: unknown;
    principal: string;
    startedAt: string;
  };
}
const prefix = "pinky:checkout:";
const event = "pinky:checkout-change";
const cache = new Map<string, { raw: string | null; draft: CheckoutDraft }>();
const fresh = (): CheckoutDraft => ({
  version: 1,
  key: crypto.randomUUID(),
  cart: [],
  guestName: "",
  guestPhone: "",
  guestNotes: "",
  pickupAt: "",
});

export function readCheckout(scope: string): CheckoutDraft {
  let raw: string | null;
  try {
    raw = localStorage.getItem(prefix + scope);
  } catch {
    return cache.get(scope)?.draft ?? saveCheckout(scope, fresh());
  }
  const cached = cache.get(scope);
  if (cached && cached.raw === raw) return cached.draft;
  if (raw) {
    try {
      const draft = JSON.parse(raw) as CheckoutDraft;
      if (
        draft.version === 1 &&
        typeof draft.key === "string" &&
        Array.isArray(draft.cart) &&
        draft.cart.every(
          (l) =>
            typeof l.name === "string" &&
            typeof l.key === "string" &&
            Number.isInteger(l.qty) &&
            l.qty > 0 &&
            Number.isFinite(l.basePrice) &&
            Number.isFinite(l.lineTotal) &&
            Array.isArray(l.modifiers),
        )
      ) {
        cache.set(scope, { raw, draft });
        return draft;
      }
    } catch {
      /* Invalid local data is never submitted. */
    }
  }
  return saveCheckout(scope, fresh());
}
function saveCheckout(
  scope: string,
  draft: CheckoutDraft,
  required = false,
): CheckoutDraft {
  const raw = JSON.stringify(draft);
  try {
    localStorage.setItem(prefix + scope, raw);
  } catch {
    if (required)
      throw new Error(
        "Your browser cannot save checkout recovery. Allow site storage or ask our team to take your order.",
      );
    cache.set(scope, { raw: null, draft });
    return draft;
  }
  cache.set(scope, { raw, draft });
  return draft;
}
const notify = () => window.dispatchEvent(new Event(event));
const locked = <T>(scope: string, work: () => T | Promise<T>): Promise<T> =>
  navigator.locks
    ? navigator.locks.request(prefix + scope, work)
    : Promise.resolve().then(work);
export function subscribeCheckout(scope: string, listener: () => void) {
  const storage = (e: StorageEvent) => {
    if (e.key === prefix + scope || e.key === null) listener();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(event, listener);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(event, listener);
  };
}
export function changeCheckout<
  K extends "cart" | "guestName" | "guestPhone" | "guestNotes" | "pickupAt",
>(
  scope: string,
  expectedKey: string,
  field: K,
  value: CheckoutDraft[K] | ((previous: CheckoutDraft[K]) => CheckoutDraft[K]),
) {
  void locked(scope, () => {
    const draft = readCheckout(scope);
    // An older tab must never overwrite an unresolved attempt or a newer cart.
    if (draft.pending || draft.key !== expectedKey) return;
    const next = typeof value === "function" ? value(draft[field]) : value;
    saveCheckout(scope, { ...draft, [field]: next });
    notify();
  });
}

export async function submitCheckout<T>(
  scope: string,
  expectedKey: string,
  request: {
    path: string;
    body: unknown;
    principal: string;
    noAuth?: boolean;
    guestToken?: string;
    visitToken?: string;
  },
): Promise<T> {
  const { draft, pending } = await locked(scope, () => {
    const draft = readCheckout(scope);
    if (draft.key !== expectedKey)
      throw new Error(
        "This cart changed in another tab. Review it before continuing.",
      );
    const pending = draft.pending ?? {
      path: request.path,
      body: JSON.parse(JSON.stringify(request.body)),
      principal: request.principal,
      startedAt: new Date().toISOString(),
    };
    if (pending.principal !== request.principal)
      throw new Error(
        "Verify the same phone or staff account used for this order before retrying.",
      );
    // Freeze the exact payload and persist BEFORE any network request.
    saveCheckout(scope, { ...draft, pending }, true);
    notify();
    return { draft, pending };
  });
  try {
    if (!navigator.onLine)
      throw new Error(
        "You are offline. Reconnect, then retry this saved order.",
      );
    const order = await api.post<T>(pending.path, pending.body, {
      noAuth: request.noAuth,
      guestToken: request.guestToken,
      headers: { "Idempotency-Key": draft.key, ...(request.visitToken ? {"X-Visit-Token":request.visitToken} : {}) },
    });
    await locked(scope, () => {
      if (readCheckout(scope).key === draft.key) {
        saveCheckout(scope, fresh());
        notify();
      }
    });
    return order;
  } catch (error) {
    // Only a durable server rejection unlocks editing; a lost response stays recoverable.
    if (
      error instanceof ApiError &&
      (error.details as { orderRequestRejected?: boolean })
        ?.orderRequestRejected
    ) {
      await locked(scope, () => {
        if (readCheckout(scope).key !== draft.key) return;
        saveCheckout(scope, {
          ...draft,
          key: crypto.randomUUID(),
          pending: undefined,
        });
        notify();
      });
    }
    if (error instanceof TypeError && /fetch|network/i.test(error.message))
      throw new Error(
        "We couldn’t confirm the connection. Your checkout is saved; reconnect and retry this order.",
      );
    throw error;
  }
}

export function clearVisitDraft(visitId: string) {
  const scope = "visit:"+visitId;
  cache.delete(scope);
  try {localStorage.removeItem(prefix+scope);localStorage.removeItem("smartdine:lastOrder:"+scope);}catch{}
}
