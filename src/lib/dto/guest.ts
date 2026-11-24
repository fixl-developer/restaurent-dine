import type { PizzaBuilderConfig, IngredientArt } from "@/components/pizza/ingredients";
/** Guest-facing (public) DTOs. */

import type {
  OrderChannel,
  OrderStatus,
  OrderItemStatus,
  OrderTotalsDto,
} from "./orders";

export type GuestFoodType = "veg" | "non_veg" | "egg" | "vegan";

export interface PublicVariant {
  id: string;
  name: string;
  priceDelta: number;
  absolutePrice?: number;
}

export interface PublicModifier {
  pizzaArt?: IngredientArt | null;
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: PublicModifier[];
}

export interface PublicMenuItem {
  pizzaBuilder?: PizzaBuilderConfig | null;
  id: string;
  slug: string;
  name: string;
  description?: string;
  categoryId: string;
  basePrice: number;
  foodType: GuestFoodType;
  spiceLevel: number;
  calories?: number;
  allergens: string[];
  tags: string[];
  imageUrl?: string;
  /** Optional transparent artwork and a self-contained glTF binary for menu inspection. */
  cutoutUrl?: string;
  modelUrl?: string;
  prepTimeMinutes: number;
  variants: PublicVariant[];
  modifierGroups: PublicModifierGroup[];
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  iconUrl?: string;
  sortOrder: number;
  items: PublicMenuItem[];
}

export interface PublicComboItemRef {
  itemId: string;
  variantId?: string;
  qty: number;
}

export interface PublicCombo {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  items: PublicComboItemRef[];
}

export interface PublicMenuResponse {
  lang: string;
  categories: PublicCategory[];
  combos: PublicCombo[];
}

// ── Guest cart line (client-side only) ─────────────────────────────────────
export interface GuestCartLine {
  key: string;
  comboId?: string;
  itemId: string;
  variantId?: string;
  variantName?: string;
  name: string;
  imageUrl?: string;
  qty: number;
  basePrice: number;
  modifiers: Array<{
    groupId: string;
    modifierId: string;
    name: string;
    priceDelta: number;
  }>;
  notes?: string;
  lineTotal: number;
}

// ── Guest order placement payloads ─────────────────────────────────────────
export interface GuestOrderItemInput {
  itemId?: string;
  comboId?: string;
  variantId?: string;
  qty: number;
  notes?: string;
  modifiers?: Array<{ groupId: string; modifierId: string }>;
}

export interface PlaceDineInInput {
  maxTotal: number;
  qrSlug?: string;
  tableId?: string;
  guestPhone?: string;
  guestName?: string;
  guestNotes?: string;
  items: GuestOrderItemInput[];
  couponCode?: string;
}

export interface PlaceWindowInput {
  maxTotal: number;
  qrSlug?: string;
  guestName?: string;
  guestNotes?: string;
  pickupAt?: string;
  pickupLocal?: string;
  items: GuestOrderItemInput[];
  couponCode?: string;
}

// ── Guest order response (toGuestDTO from backend) ─────────────────────────
export interface GuestOrderDto {
  qrService?:boolean;
  fulfillment?: "dine_in" | "pickup" | "delivery";
  currency?: string;
  pickupAt?: string;
  paymentStatus?: "unpaid" | "partial" | "paid" | "refunded";
  feedbackSubmitted?: boolean;
  guestRequests?: Array<{ id: string; type: GuestRequestType; resolved: boolean }>;
  delivery?: {
    status:
      | "pending"
      | "assigned"
      | "dispatched"
      | "delivered"
      | "failed"
      | "cancelled";
    deliveredAt?: string;
  };
  id: string;
  orderNumber: string;
  status: OrderStatus;
  channel: OrderChannel;
  windowToken?: string;
  estimatedPrepMinutes: number;
  items: Array<{
    id: string;
    name: string;
    variantName?: string;
    qty: number;
    lineTotal: number;
    status: OrderItemStatus;
    modifiers: string[];
  }>;
  totals: OrderTotalsDto;
}

// ── Guest OTP ──────────────────────────────────────────────────────────────
export interface GuestOtpRequestResult {
  sentTo?: string;
  guestToken?: string;
  expiresInMin?: number;
  isReturning?: boolean;
}

export interface GuestOtpVerifyResult {
  verified: boolean;
  phone: string;
  guestToken: string;
  expiresInMin: number;
}

// ── Guest request (water/bill/call_waiter/other) ───────────────────────────
export type GuestRequestType = "call_waiter" | "water" | "bill" | "other";

export const GUEST_REQUEST_LABELS: Record<GuestRequestType, string> = {
  call_waiter: "Call Waiter",
  water: "Refill Water",
  bill: "Ask for Bill",
  other: "Other",
};
