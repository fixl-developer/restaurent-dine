import { RefreshCw } from "lucide-react";

export default function CheckoutRecovery({
  busy,
  error,
  onRetry,
  verify = false,
}: {
  busy: boolean;
  error?: Error | null;
  onRetry: () => void;
  verify?: boolean;
}) {
  return (
    <section className="max-w-lg mx-auto my-10 p-6 sm:p-8 rounded-2xl border bg-white shadow-sm">
      <RefreshCw
        className={`text-[#086874] mb-5 ${busy ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <h1 className="text-2xl font-bold mb-3">
        {busy ? "Confirming your order…" : "Your checkout is saved."}
      </h1>
      <p className="text-sm text-gray-600 leading-6">
        {busy
          ? "Please wait while we confirm it with the café."
          : "The last attempt needs confirmation. Retry the saved order to recover its result. If it did not reach the café, this will submit it once."}
      </p>
      <p className="text-sm text-gray-600 mt-3">
        Your items and reviewed total stay the same. Please keep this browser’s
        saved data until the order is confirmed.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700 mt-4">
          {error.message}
        </p>
      )}
      <button
        className="ui-button ui-button-primary mt-6 w-full"
        disabled={busy}
        onClick={onRetry}
      >
        {busy
          ? "Confirming…"
          : verify
            ? "Verify phone to recover order"
            : "Retry saved order"}
      </button>
      <p className="text-xs text-gray-500 mt-4">
        Need to change or cancel this attempt? Ask the café to confirm its
        status first.
      </p>
    </section>
  );
}
