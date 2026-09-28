import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  GuestOrderDto,
  GuestOtpRequestResult,
  GuestOtpVerifyResult,
  GuestRequestType,
  PlaceDineInInput,
  PlaceWindowInput,
  PublicMenuResponse,
} from "@/lib/dto/guest";

function handleError(err: unknown, fallback: string) {
  toast.error(err instanceof ApiError ? err.message : fallback);
}

// ── Menu ─────────────────────────────────────────────────────────────────────
export function usePublicMenu(
  opts: { lang?: string; channel?: "dine_in" | "window" } = {},
) {
  return useQuery({
    queryKey: ["public-menu", opts],
    queryFn: () =>
      api.get<PublicMenuResponse>("/menu/public", {
        noAuth: true,
        query: { lang: opts.lang, channel: opts.channel },
      }),
    staleTime: 60_000,
  });
}

// ── Place orders ─────────────────────────────────────────────────────────────
export function usePlaceDineInOrder() {
  return useMutation({
    mutationFn: ({
      idempotencyKey,
      ...input
    }: PlaceDineInInput & { idempotencyKey: string }) =>
      api.post<GuestOrderDto>("/guest/orders/dine-in", input, {
        noAuth: true,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    onError: (err) => handleError(err, "Place order failed"),
  });
}

export function usePlaceWindowOrder(guestToken: string | null) {
  return useMutation({
    mutationFn: ({
      idempotencyKey,
      ...input
    }: PlaceWindowInput & { idempotencyKey: string }) => {
      if (!guestToken)
        throw new ApiError(401, "NO_TOKEN", "Verify phone first");
      return api.post<GuestOrderDto>("/guest/orders/window", input, {
        noAuth: true,
        guestToken,
        headers: { "Idempotency-Key": idempotencyKey },
      });
    },
    onError: (err) => handleError(err, "Place order failed"),
  });
}

// ── Order status (guest tracker) ─────────────────────────────────────────────
export function useGuestOrder(orderId: string | null, refetchMs = 10_000) {
  return useQuery({
    queryKey: ["guest-order", orderId],
    enabled: Boolean(orderId),
    queryFn: () =>
      api.get<GuestOrderDto>(`/guest/orders/${orderId}`, { noAuth: true }),
    refetchInterval: refetchMs,
    staleTime: 5_000,
  });
}

// ── Add items to existing order ─────────────────────────────────────────────
export function useAddItemsToGuestOrder() {
  return useMutation({
    mutationFn: ({
      orderId,
      items,
      maxTotal,
      idempotencyKey,
    }: {
      maxTotal: number;
      idempotencyKey: string;
      orderId: string;
      items: PlaceDineInInput["items"];
    }) =>
      api.post<GuestOrderDto>(
        `/guest/orders/${orderId}/items`,
        { items, maxTotal },
        { noAuth: true, headers: { "Idempotency-Key": idempotencyKey } },
      ),
    onError: (err) => handleError(err, "Add items failed"),
  });
}

// ── Order lookup by order number ────────────────────────────────────────────
export function useGuestOrderByNumber() {
  return useMutation({
    mutationFn: (orderNumber: string) =>
      api.get<GuestOrderDto>(
        `/guest/orders/by-number/${encodeURIComponent(orderNumber)}`,
        { noAuth: true },
      ),
    onError: (err) => handleError(err, "Order not found"),
  });
}

// ── Guest request (water/bill/call_waiter) ──────────────────────────────────
export function useSendGuestRequest() {
  return useMutation({
    mutationFn: ({
      orderId,
      type,
      message,
    }: {
      orderId: string;
      type: GuestRequestType;
      message?: string;
    }) =>
      api.post(
        `/guest/orders/${orderId}/requests`,
        { type, message },
        { noAuth: true },
      ),
    onSuccess: () => toast.success("Request sent to staff"),
    onError: (err) => handleError(err, "Request failed"),
  });
}

// ── Guest OTP ───────────────────────────────────────────────────────────────
export function useRequestGuestOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      api.post<GuestOtpRequestResult>(
        "/auth/guest/otp/request",
        { phone },
        { noAuth: true },
      ),
    onError: (err) => handleError(err, "OTP request failed"),
  });
}

export function useVerifyGuestOtp() {
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      api.post<GuestOtpVerifyResult>(
        "/auth/guest/otp/verify",
        { phone, code },
        { noAuth: true },
      ),
    onError: (err) => handleError(err, "OTP verify failed"),
  });
}

// ── Guest feedback (post-served) ────────────────────────────────────────────
export interface SubmitGuestFeedbackInput {
  rating: number;
  text?: string;
  tagChips?: string[];
}

export function useSubmitGuestFeedback() {
  return useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: SubmitGuestFeedbackInput;
    }) =>
      api.post(`/guest/orders/${orderId}/feedback`, input, { noAuth: true }),
    onSuccess: () => toast.success("Thank you for your feedback!"),
    onError: (err) => handleError(err, "Submit feedback failed"),
  });
}

// ── Guest payment (online UPI) ──────────────────────────────────────────────
export interface GuestPaymentResult {
  invoiceId: string;
  invoiceNumber: string;
  amountDue: number;
  paymentId: string;
  provider?: "stripe" | "razorpay";
  amount: number;
  currency: string;
  // Stripe (USD card)
  clientSecret?: string | null;
  publishableKey?: string | null;
  // Razorpay (legacy INR UPI)
  gatewayOrderId?: string;
  mocked?: boolean;
  upiDeeplink?: string;
  razorpayKeyId?: string;
}

export function useInitiateGuestPayment() {
  return useMutation({
    mutationFn: ({
      orderId,
      tip,
    }: {
      orderId: string;
      tip?: { amount?: number; percent?: number };
    }) =>
      api.post<GuestPaymentResult>(
        `/guest/orders/${orderId}/pay-online`,
        { tip },
        { noAuth: true },
      ),
    onError: (err) => handleError(err, "Payment initiation failed"),
  });
}
