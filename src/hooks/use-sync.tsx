import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { processSyncQueue, seedOfflineDB } from "@/services/sync-service";
import { db } from "@/lib/offline-db";
import { useLiveQuery } from "dexie-react-hooks";
import { supabase } from "@/lib/supabase";

/* ================================================================
   Online status hook
   ================================================================ */

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/* ================================================================
   Sync context
   ================================================================ */

interface SyncContextValue {
  online: boolean;
  isSyncing: boolean;
  pendingCount: number;
  triggerSync: () => Promise<void>;
  seedLocal: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  // Live count of pending sync items
  const pendingCount = useLiveQuery(() => db.sync_queue.count(), [], 0);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      await processSyncQueue();
    } catch (err) {
      console.error("[SyncProvider] sync error", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const seedLocal = useCallback(async () => {
    try {
      await seedOfflineDB();
    } catch (err) {
      console.error("[SyncProvider] seed error", err);
    }
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && pendingCount > 0) {
      triggerSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Seed local DB once after sign-in (while online)
  const seeded = useRef(false);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN" && !seeded.current) {
          seeded.current = true;
          seedLocal();
        }
        if (event === "SIGNED_OUT") {
          seeded.current = false;
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [seedLocal]);

  return (
    <SyncContext.Provider
      value={{ online, isSyncing, pendingCount, triggerSync, seedLocal }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within <SyncProvider>");
  return ctx;
}
