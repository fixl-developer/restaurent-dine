import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
const handleError = (err: unknown, fallback: string) =>
  toast.error(err instanceof Error ? err.message : fallback);

export interface PinVerificationResult {
  verified: boolean;
}

export function useVerifyPin() {
  return useMutation({
    mutationFn: (pin: string) =>
      api.post<PinVerificationResult>("/auth/staff/pin/verify", { pin }),
    onError: (err) => handleError(err, "PIN verification failed"),
  });
}
