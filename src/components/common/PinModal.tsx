import { useState } from "react";
import { X, Lock } from "lucide-react";
import { useVerifyPin } from "@/hooks/useVerifyPin";

interface PinModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PinModal({
  isOpen,
  title,
  description,
  onSuccess,
  onCancel,
}: PinModalProps) {
  const [pin, setPin] = useState("");
  const verifyPin = useVerifyPin();

  const handleSubmit = async () => {
    if (!pin.trim()) return;
    try {
      await verifyPin.mutateAsync(pin);
      onSuccess();
      setPin("");
    } catch {
      setPin("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#E8447A]" />
            <h3 className="text-[14px] font-barlow font-black uppercase text-[#1a1a1a]">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-[#1a1a1a]/40 hover:text-[#1a1a1a] transition"
            disabled={verifyPin.isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {description && (
          <p className="text-[12px] text-[#1a1a1a]/60">{description}</p>
        )}

        <div className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Enter manager PIN"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full px-4 py-2 rounded-lg border border-[rgba(26,26,26,0.15)] text-[14px] font-mono text-center tracking-widest placeholder-[#1a1a1a]/30"
            disabled={verifyPin.isPending}
            autoFocus
          />

          {verifyPin.isError && (
            <p className="text-[11px] text-red-600">
              Invalid PIN. Please try again.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-[rgba(26,26,26,0.15)] text-[12px] font-barlow font-bold uppercase text-[#1a1a1a] hover:bg-[#F7F7F7] transition disabled:opacity-50"
            disabled={verifyPin.isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!pin.trim() || verifyPin.isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-[#E8447A] text-white text-[12px] font-barlow font-bold uppercase hover:bg-[#d63762] transition disabled:opacity-50"
          >
            {verifyPin.isPending ? "Verifying..." : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}
