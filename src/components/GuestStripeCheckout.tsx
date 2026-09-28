import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useInitiateGuestPayment } from "@/hooks/useGuest";
import { usePublicRestaurant } from "@/hooks/useRestaurant";

// Cache the Stripe.js loader per publishable key so it initialises only once.
const stripeLoaders = new Map<string, Promise<Stripe | null>>();
function getStripe(publishableKey: string): Promise<Stripe | null> {
  let loader = stripeLoaders.get(publishableKey);
  if (!loader) {
    loader = loadStripe(publishableKey);
    stripeLoaders.set(publishableKey, loader);
  }
  return loader;
}

type TipChoice = number | "none" | "custom";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Props {
  orderId: string;
  baseAmount: number;
  formatAmount: (n: number) => string;
  onPaid: () => void;
}

/**
 * Guest card payment via Stripe Payment Element. Lets the guest add a tip (server
 * validates and folds it into the PaymentIntent amount), initiates the intent through
 * the backend, collects the card inline, and confirms. The signed webhook is the
 * source of truth for settlement; on confirmation we just refresh the order.
 */
export default function GuestStripeCheckout({
  orderId,
  baseAmount,
  formatAmount,
  onPaid,
}: Props) {
  const initiate = useInitiateGuestPayment();
  const tipping = usePublicRestaurant().data?.tipping;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [tipChoice, setTipChoice] = useState<TipChoice>("none");
  const [customTip, setCustomTip] = useState("");

  const stripePromise = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey],
  );

  const tipEnabled = tipping?.enabled ?? false;
  const tipAmount =
    tipChoice === "none"
      ? 0
      : tipChoice === "custom"
        ? Math.max(0, round2(Number(customTip) || 0))
        : round2((baseAmount * tipChoice) / 100);
  const total = round2(baseAmount + tipAmount);

  const start = () => {
    const tip =
      tipAmount > 0
        ? tipChoice === "custom"
          ? { amount: tipAmount }
          : { percent: tipChoice as number }
        : undefined;
    initiate.mutate(
      { orderId, tip },
      {
        onSuccess: (res) => {
          if (
            res.provider !== "stripe" ||
            !res.clientSecret ||
            !res.publishableKey
          ) {
            toast.error("Card payment is not available for this order.");
            return;
          }
          setPublishableKey(res.publishableKey);
          setClientSecret(res.clientSecret);
        },
      },
    );
  };

  if (!clientSecret || !stripePromise) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">Pay online</h3>
        <p className="text-xs text-gray-500 mb-4">
          Pay securely by card. Your total is {formatAmount(total)}.
        </p>

        {tipEnabled && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Add a tip
            </p>
            <div className="flex flex-wrap gap-2">
              <TipChip
                active={tipChoice === "none"}
                onClick={() => setTipChoice("none")}
              >
                No tip
              </TipChip>
              {(tipping?.suggestedPercents ?? []).map((pct) => (
                <TipChip
                  key={pct}
                  active={tipChoice === pct}
                  onClick={() => setTipChoice(pct)}
                >
                  {pct}%
                  <span className="text-[10px] opacity-70 ml-1">
                    {formatAmount(round2((baseAmount * pct) / 100))}
                  </span>
                </TipChip>
              ))}
              {tipping?.allowCustom && (
                <TipChip
                  active={tipChoice === "custom"}
                  onClick={() => setTipChoice("custom")}
                >
                  Custom
                </TipChip>
              )}
            </div>
            {tipChoice === "custom" && (
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder="Tip amount"
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
              />
            )}
          </div>
        )}

        <button
          onClick={start}
          disabled={initiate.isPending || total <= 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--promise-berry)] text-white rounded-xl font-medium text-sm disabled:opacity-50"
        >
          {initiate.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          Pay {formatAmount(total)}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">
        Card payment · {formatAmount(total)}
        {tipAmount > 0 && (
          <span className="text-gray-500 font-normal">
            {" "}
            (incl. {formatAmount(tipAmount)} tip)
          </span>
        )}
      </h3>
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: { theme: "stripe" } }}
      >
        <PayForm amountLabel={formatAmount(total)} onPaid={onPaid} />
      </Elements>
    </div>
  );
}

function TipChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
        active
          ? "border-[var(--promise-berry)] bg-brand-50 text-[var(--promise-berry)] font-semibold"
          : "border-gray-200 text-gray-700 hover:border-brand-300"
      }`}
    >
      {children}
    </button>
  );
}

function PayForm({
  amountLabel,
  onPaid,
}: {
  amountLabel: string;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Payment could not be completed.");
      return;
    }
    if (paymentIntent && paymentIntent.status === "succeeded") {
      setSucceeded(true);
      toast.success("Payment received. Thank you!");
      onPaid();
    } else if (paymentIntent) {
      // e.g. "processing" — settlement will land via the webhook.
      toast.message("Payment is processing. We'll update your order shortly.");
      onPaid();
    }
  };

  if (succeeded)
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 text-[#086874] py-3"
      >
        <CheckCircle2 className="w-5 h-5" /> Payment received — thank you!
      </p>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--promise-berry)] text-white rounded-xl font-medium text-sm disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        Pay {amountLabel}
      </button>
      <p className="text-[11px] text-center text-gray-400">
        Payments are processed securely by Stripe.
      </p>
    </form>
  );
}
