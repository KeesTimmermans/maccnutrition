import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isInstalledPWA(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as any).standalone === true) return true;
  return false;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

let vapidKeyCache: string | null = null;

async function fetchVapidKey(): Promise<string | null> {
  if (vapidKeyCache) return vapidKeyCache;
  try {
    const { data, error } = await supabase.functions.invoke("push-vapid-key");
    if (error) throw error;
    vapidKeyCache = data?.publicKey || null;
    return vapidKeyCache;
  } catch (e) {
    console.error("Failed to fetch VAPID key:", e);
    return null;
  }
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const init = async () => {
      const iosDevice = isIOS();
      const pwaMode = isInstalledPWA();
      setIsIOSDevice(iosDevice);
      setIsPWA(pwaMode);

      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
      }

       if (supported && Notification.permission === "granted") {
         try {
           const reg = await navigator.serviceWorker.ready;
           const sub = await (reg as any).pushManager.getSubscription();
           setIsSubscribed(!!sub);
         } catch (e) {
           console.error("Error checking push subscription:", e);
         }
       }

      setIsLoading(false);
    };

    init();
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      const vapidKey = await fetchVapidKey();
      if (!vapidKey) {
        console.error("VAPID key not available");
        return false;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

       const reg = await navigator.serviceWorker.ready;
       let sub = await (reg as any).pushManager.getSubscription();

       if (!sub) {
         sub = await (reg as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });
      }

      const subJson = sub.toJSON();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          keys_p256dh: subJson.keys!.p256dh!,
          keys_auth: subJson.keys!.auth!,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;
      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error("Push subscribe error:", e);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
       const reg = await navigator.serviceWorker.ready;
       const sub = await (reg as any).pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", endpoint);
        }
      }

      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error("Push unsubscribe error:", e);
      return false;
    }
  }, []);

  const sendTest = useCallback(async (): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke("push-send-test");
      return !error;
    } catch (e) {
      console.error("Push test error:", e);
      return false;
    }
  }, []);

  const canEnable = isSupported && (isPWA || !isIOSDevice);
  const showIOSGuidance = isIOSDevice && !isPWA;

  return {
    isSupported,
    isSubscribed,
    isPWA,
    isIOSDevice,
    isLoading,
    permission,
    canEnable,
    showIOSGuidance,
    subscribe,
    unsubscribe,
    sendTest,
  };
}
