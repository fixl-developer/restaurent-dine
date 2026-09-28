import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import Dialog from "./Dialog";

export default function ReasonDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (reason.trim().length < 3) {
      setError("Enter a reason with at least 3 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "This action could not be saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      label={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      closeOnEscape={!busy}
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
    >
      <form onSubmit={submit} className="staff-surface reason-panel">
        <AlertTriangle className="text-[var(--promise-berry)]" aria-hidden="true" />
        <h2 className="text-xl font-bold mt-4">{title}</h2>
        <p className="text-sm text-gray-600 mt-3 leading-6">{description}</p>
        <label htmlFor={id} className="block font-semibold text-sm mt-5">
          Reason
        </label>
        <textarea
          id={id}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={3}
          maxLength={300}
          required
          disabled={busy}
          rows={3}
          className="w-full border rounded-xl p-3 mt-2"
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm text-red-700 mt-3"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3 mt-5">
          <button
            type="button"
            className="ui-button"
            disabled={busy}
            onClick={onClose}
          >
            Keep unchanged
          </button>
          <button
            type="submit"
            className="ui-button ui-button-danger"
            disabled={busy}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
