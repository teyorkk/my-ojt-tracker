import Dexie, { type EntityTable } from "dexie";

/* ===== Offline row types (mirror Supabase but with sync metadata) ===== */

export interface OfflineTimeLog {
  id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  hours_rendered: number | null;
  user_id: string;
  created_at: string;
}

export interface OfflineTask {
  id: string;
  log_id: string;
  description: string;
  created_at: string;
}

export interface OfflinePhoto {
  id: string;
  log_id: string;
  image_url: string;
  created_at: string;
  /** Base64 data stored offline until sync uploads to Supabase Storage */
  offline_blob?: string;
  offline_filename?: string;
}

export interface OfflineSettings {
  id: string;
  user_id: string;
  required_ojt_hours: number;
  accent_color: string;
  theme: string;
}

/** Pending mutations that need to be synced to Supabase */
export interface SyncQueueItem {
  /** Auto-incremented local key */
  queueId?: number;
  /** Which table to sync to */
  table: "time_logs" | "tasks" | "photos" | "settings";
  /** The operation that was performed offline */
  action: "upsert" | "insert" | "update" | "delete";
  /** The row ID affected */
  rowId: string;
  /** Full payload for inserts / upserts / updates */
  payload?: Record<string, unknown>;
  /** Timestamp when queued */
  createdAt: string;
}

/* ===== Database ===== */

const db = new Dexie("OjtTrackerDB") as Dexie & {
  time_logs: EntityTable<OfflineTimeLog, "id">;
  tasks: EntityTable<OfflineTask, "id">;
  photos: EntityTable<OfflinePhoto, "id">;
  settings: EntityTable<OfflineSettings, "id">;
  sync_queue: EntityTable<SyncQueueItem, "queueId">;
};

db.version(1).stores({
  time_logs: "id, date, user_id",
  tasks: "id, log_id",
  photos: "id, log_id",
  settings: "id, user_id",
  sync_queue: "++queueId, table",
});

export { db };
