import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSupport = () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window;
      setIsSupported(supported);
    };
    checkSupport();
  }, []);

  const register = async () => {
    if (!isSupported) return;
    setLoading(true);

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
        {
          scope: "/",
        },
      );

      // Get VAPID public key
      const vapidResponse = await api.get<{ publicKey: string }>(
        "/notifications/vapid-key",
      );
      const publicKey = vapidResponse.publicKey;

      // Create push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send to backend
      await api.post("/notifications/subscribe", {
        subscription: subscription.toJSON(),
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push registration failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const unregister = async () => {
    if (!isSupported) return;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await api.post("/notifications/unsubscribe", {
            endpoint: subscription.endpoint,
          });
          await subscription.unsubscribe();
          setIsSubscribed(false);
        }
      }
    } catch (err) {
      console.error("Push unregistration failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return { isSupported, isSubscribed, loading, register, unregister };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
