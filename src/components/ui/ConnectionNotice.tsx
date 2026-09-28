import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
const subscribe = (fn: () => void) => {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
};
export default function ConnectionNotice() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  return online ? null : (
    <div className="connection-notice" role="alert">
      <WifiOff size={18} aria-hidden="true" />
      <p>
        <strong>You’re offline.</strong> Displayed information may be out of
        date. Reconnect before saving changes. Saved checkouts can be retried
        after reconnecting.
      </p>
    </div>
  );
}
