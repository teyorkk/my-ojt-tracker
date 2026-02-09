import { db } from "@/lib/offline-db";
import { supabase } from "@/lib/supabase";
import type { TimeLog, Task, Photo, Settings, DailyLogEntry } from "@/lib/types";
import { v4 as uuid } from "uuid";

/* ================================================================
   HELPERS
   ================================================================ */

function isOnline(): boolean {
  return navigator.onLine;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function currentUserId(): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/* ================================================================
   INITIAL DATA PULL  (Supabase -> IndexedDB)
   Called once after login while online to seed local cache.
   ================================================================ */

export async function seedOfflineDB(): Promise<void> {
  if (!isOnline()) return;
  const userId = await currentUserId();

  const [logsRes, tasksRes, photosRes, settingsRes] = await Promise.all([
    supabase.from("time_logs").select("*").eq("user_id", userId),
    supabase.from("tasks").select("*, time_logs!inner(user_id)").eq("time_logs.user_id", userId),
    supabase.from("photos").select("*, time_logs!inner(user_id)").eq("time_logs.user_id", userId),
    supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  await db.transaction("rw", [db.time_logs, db.tasks, db.photos, db.settings], async () => {
    // Clear existing data for this user then re-populate
    await db.time_logs.where("user_id").equals(userId).delete();
    if (logsRes.data?.length) {
      await db.time_logs.bulkPut(logsRes.data);
    }

    // Tasks and photos come with a joined user_id -- strip the extra field
    if (tasksRes.data?.length) {
      const tasks = tasksRes.data.map(({ time_logs: _, ...t }) => t) as Task[];
      const logIds = tasks.map((t) => t.log_id);
      await db.tasks.where("log_id").anyOf(logIds).delete();
      await db.tasks.bulkPut(tasks);
    }

    if (photosRes.data?.length) {
      const photos = photosRes.data.map(({ time_logs: _, ...p }) => p) as Photo[];
      const logIds = photos.map((p) => p.log_id);
      await db.photos.where("log_id").anyOf(logIds).delete();
      await db.photos.bulkPut(photos);
    }

    if (settingsRes.data) {
      await db.settings.put(settingsRes.data);
    }
  });
}

/* ================================================================
   TIME LOGS
   ================================================================ */

export async function getTimeLogs(): Promise<TimeLog[]> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      // Update local cache
      const userId = await currentUserId();
      await db.time_logs.where("user_id").equals(userId).delete();
      if (data?.length) await db.time_logs.bulkPut(data);
      return data ?? [];
    } catch {
      // Fall through to offline
    }
  }
  const userId = await currentUserId();
  const all = await db.time_logs.where("user_id").equals(userId).toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTimeLogByDate(date: string): Promise<TimeLog | null> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*")
        .eq("date", date)
        .maybeSingle();
      if (error) throw error;
      if (data) await db.time_logs.put(data);
      return data;
    } catch {
      // Fall through
    }
  }
  const userId = await currentUserId();
  return (
    (await db.time_logs.where({ date, user_id: userId }).first()) ?? null
  );
}

export async function upsertTimeLog(
  log: Partial<TimeLog> & { date: string }
): Promise<TimeLog> {
  const userId = await currentUserId();
  const now = nowISO();

  // Check if a local row already exists for this date
  const existing = await db.time_logs.where({ date: log.date, user_id: userId }).first();
  const id = existing?.id ?? uuid();

  const row: TimeLog = {
    id,
    date: log.date,
    time_in: log.time_in ?? null,
    time_out: log.time_out ?? null,
    hours_rendered: log.hours_rendered ?? null,
    user_id: userId,
    created_at: existing?.created_at ?? now,
  };

  // Always write locally
  await db.time_logs.put(row);

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("time_logs")
        .upsert({ ...row }, { onConflict: "date,user_id" })
        .select()
        .single();
      if (error) throw error;
      // Update local with server-generated ID if different
      if (data.id !== row.id) {
        await db.time_logs.delete(row.id);
        await db.time_logs.put(data);
        // Update any tasks/photos referencing old id
        await db.tasks.where("log_id").equals(row.id).modify({ log_id: data.id });
        await db.photos.where("log_id").equals(row.id).modify({ log_id: data.id });
      }
      return data;
    } catch {
      // Queue for sync
      await db.sync_queue.add({
        table: "time_logs",
        action: "upsert",
        rowId: row.id,
        payload: row as unknown as Record<string, unknown>,
        createdAt: now,
      });
    }
  } else {
    await db.sync_queue.add({
      table: "time_logs",
      action: "upsert",
      rowId: row.id,
      payload: row as unknown as Record<string, unknown>,
      createdAt: now,
    });
  }

  return row;
}

export async function deleteTimeLog(id: string): Promise<void> {
  await db.time_logs.delete(id);
  await db.tasks.where("log_id").equals(id).delete();
  await db.photos.where("log_id").equals(id).delete();

  if (isOnline()) {
    try {
      await supabase.from("time_logs").delete().eq("id", id);
      return;
    } catch {
      // Queue
    }
  }
  await db.sync_queue.add({
    table: "time_logs",
    action: "delete",
    rowId: id,
    createdAt: nowISO(),
  });
}

/* ================================================================
   TASKS
   ================================================================ */

export async function getTasksByLogId(logId: string): Promise<Task[]> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("log_id", logId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      await db.tasks.where("log_id").equals(logId).delete();
      if (data?.length) await db.tasks.bulkPut(data);
      return data ?? [];
    } catch {
      // Fall through
    }
  }
  return db.tasks.where("log_id").equals(logId).sortBy("created_at");
}

export async function createTask(
  logId: string,
  description: string
): Promise<Task> {
  const now = nowISO();
  const row: Task = { id: uuid(), log_id: logId, description, created_at: now };

  await db.tasks.put(row);

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ log_id: logId, description })
        .select()
        .single();
      if (error) throw error;
      if (data.id !== row.id) {
        await db.tasks.delete(row.id);
        await db.tasks.put(data);
      }
      return data;
    } catch {
      await db.sync_queue.add({
        table: "tasks",
        action: "insert",
        rowId: row.id,
        payload: row as unknown as Record<string, unknown>,
        createdAt: now,
      });
    }
  } else {
    await db.sync_queue.add({
      table: "tasks",
      action: "insert",
      rowId: row.id,
      payload: row as unknown as Record<string, unknown>,
      createdAt: now,
    });
  }

  return row;
}

export async function updateTask(
  id: string,
  description: string
): Promise<Task> {
  const existing = await db.tasks.get(id);
  if (!existing) throw new Error("Task not found");

  const updated = { ...existing, description };
  await db.tasks.put(updated);

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({ description })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch {
      await db.sync_queue.add({
        table: "tasks",
        action: "update",
        rowId: id,
        payload: { description },
        createdAt: nowISO(),
      });
    }
  } else {
    await db.sync_queue.add({
      table: "tasks",
      action: "update",
      rowId: id,
      payload: { description },
      createdAt: nowISO(),
    });
  }

  return updated;
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);

  if (isOnline()) {
    try {
      await supabase.from("tasks").delete().eq("id", id);
      return;
    } catch {
      // Queue
    }
  }
  await db.sync_queue.add({
    table: "tasks",
    action: "delete",
    rowId: id,
    createdAt: nowISO(),
  });
}

/* ================================================================
   PHOTOS
   ================================================================ */

export async function getPhotosByLogId(logId: string): Promise<Photo[]> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("log_id", logId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      await db.photos.where("log_id").equals(logId).delete();
      if (data?.length) await db.photos.bulkPut(data);
      return data ?? [];
    } catch {
      // Fall through
    }
  }
  return db.photos.where("log_id").equals(logId).sortBy("created_at");
}

export async function uploadPhoto(
  logId: string,
  file: File
): Promise<Photo> {
  const userId = await currentUserId();
  const now = nowISO();
  const photoId = uuid();

  if (isOnline()) {
    try {
      const filePath = `${userId}/${logId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("ojt-logs")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("ojt-logs")
        .getPublicUrl(filePath);

      const { data, error } = await supabase
        .from("photos")
        .insert({ log_id: logId, image_url: urlData.publicUrl })
        .select()
        .single();
      if (error) throw error;

      await db.photos.put(data);
      return data;
    } catch {
      // Fall through to offline storage
    }
  }

  // Store file as base64 offline
  const base64 = await fileToBase64(file);
  const row: Photo & { offline_blob?: string; offline_filename?: string } = {
    id: photoId,
    log_id: logId,
    image_url: base64, // Use base64 as temporary URL for display
    created_at: now,
    offline_blob: base64,
    offline_filename: file.name,
  };

  await db.photos.put(row);
  await db.sync_queue.add({
    table: "photos",
    action: "insert",
    rowId: photoId,
    payload: { log_id: logId, filename: file.name },
    createdAt: now,
  });

  return { id: photoId, log_id: logId, image_url: base64, created_at: now };
}

export async function deletePhoto(photo: Photo): Promise<void> {
  await db.photos.delete(photo.id);

  if (isOnline()) {
    try {
      // Remove from storage
      const url = new URL(photo.image_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/ojt-logs/");
      if (pathParts[1]) {
        await supabase.storage
          .from("ojt-logs")
          .remove([decodeURIComponent(pathParts[1])]);
      }
      await supabase.from("photos").delete().eq("id", photo.id);
      return;
    } catch {
      // Queue
    }
  }
  await db.sync_queue.add({
    table: "photos",
    action: "delete",
    rowId: photo.id,
    payload: { image_url: photo.image_url },
    createdAt: nowISO(),
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToFile(base64: string, filename: string): File {
  const [header, data] = base64.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new File([array], filename, { type: mime });
}

/* ================================================================
   DAILY LOG (composite)
   ================================================================ */

export async function getDailyLogEntry(
  date: string
): Promise<DailyLogEntry | null> {
  const log = await getTimeLogByDate(date);
  if (!log) return null;

  const [tasks, photos] = await Promise.all([
    getTasksByLogId(log.id),
    getPhotosByLogId(log.id),
  ]);

  return { ...log, tasks, photos };
}

/* ================================================================
   SETTINGS
   ================================================================ */

export async function getSettings(): Promise<Settings> {
  const userId = await currentUserId();

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from("settings")
          .insert({
            user_id: userId,
            required_ojt_hours: 600,
            accent_color: "green",
            theme: "light",
          })
          .select()
          .single();
        if (insertError) throw insertError;
        await db.settings.put(newSettings);
        return newSettings;
      }

      await db.settings.put(data);
      return data;
    } catch {
      // Fall through
    }
  }

  // Offline fallback
  const local = await db.settings.where("user_id").equals(userId).first();
  if (local) return local;

  // Create a default locally
  const defaults: Settings = {
    id: uuid(),
    user_id: userId,
    required_ojt_hours: 600,
    accent_color: "green",
    theme: "light",
  };
  await db.settings.put(defaults);
  return defaults;
}

export async function updateSettings(
  requiredHours: number
): Promise<Settings> {
  const userId = await currentUserId();
  const current = await getSettings();
  const updated = { ...current, required_ojt_hours: requiredHours };

  await db.settings.put(updated);

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("settings")
        .update({ required_ojt_hours: requiredHours })
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      await db.settings.put(data);
      return data;
    } catch {
      await db.sync_queue.add({
        table: "settings",
        action: "update",
        rowId: current.id,
        payload: { required_ojt_hours: requiredHours },
        createdAt: nowISO(),
      });
    }
  } else {
    await db.sync_queue.add({
      table: "settings",
      action: "update",
      rowId: current.id,
      payload: { required_ojt_hours: requiredHours },
      createdAt: nowISO(),
    });
  }

  return updated;
}

export async function updateThemeSettings(
  accentColor: string,
  theme: string
): Promise<Settings> {
  const userId = await currentUserId();
  const current = await getSettings();
  const updated = { ...current, accent_color: accentColor, theme };

  await db.settings.put(updated);

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("settings")
        .upsert(
          {
            user_id: userId,
            accent_color: accentColor,
            theme,
            required_ojt_hours: current.required_ojt_hours,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      await db.settings.put(data);
      return data;
    } catch {
      await db.sync_queue.add({
        table: "settings",
        action: "update",
        rowId: current.id,
        payload: { accent_color: accentColor, theme },
        createdAt: nowISO(),
      });
    }
  } else {
    await db.sync_queue.add({
      table: "settings",
      action: "update",
      rowId: current.id,
      payload: { accent_color: accentColor, theme },
      createdAt: nowISO(),
    });
  }

  return updated;
}

/* ================================================================
   SYNC ENGINE -- replay queued mutations to Supabase
   ================================================================ */

export async function processSyncQueue(): Promise<number> {
  if (!isOnline()) return 0;

  const items = await db.sync_queue.orderBy("queueId").toArray();
  if (items.length === 0) return 0;

  let synced = 0;

  for (const item of items) {
    try {
      switch (item.table) {
        case "time_logs":
          await syncTimeLog(item);
          break;
        case "tasks":
          await syncTask(item);
          break;
        case "photos":
          await syncPhoto(item);
          break;
        case "settings":
          await syncSettings(item);
          break;
      }
      // Remove from queue on success
      await db.sync_queue.delete(item.queueId!);
      synced++;
    } catch (err) {
      console.warn("[sync] Failed to sync item", item, err);
      // Leave in queue for next attempt
    }
  }

  return synced;
}

async function syncTimeLog(item: { action: string; rowId: string; payload?: Record<string, unknown> }) {
  if (item.action === "delete") {
    await supabase.from("time_logs").delete().eq("id", item.rowId);
  } else if (item.action === "upsert" && item.payload) {
    const userId = await currentUserId();
    const { data } = await supabase
      .from("time_logs")
      .upsert({ ...item.payload, user_id: userId }, { onConflict: "date,user_id" })
      .select()
      .single();
    if (data && data.id !== item.rowId) {
      // Server assigned a different ID -- fix local references
      await db.time_logs.delete(item.rowId);
      await db.time_logs.put(data);
      await db.tasks.where("log_id").equals(item.rowId).modify({ log_id: data.id });
      await db.photos.where("log_id").equals(item.rowId).modify({ log_id: data.id });
    }
  }
}

async function syncTask(item: { action: string; rowId: string; payload?: Record<string, unknown> }) {
  if (item.action === "delete") {
    await supabase.from("tasks").delete().eq("id", item.rowId);
  } else if (item.action === "insert" && item.payload) {
    const { data } = await supabase
      .from("tasks")
      .insert({ log_id: item.payload.log_id, description: item.payload.description })
      .select()
      .single();
    if (data && data.id !== item.rowId) {
      await db.tasks.delete(item.rowId);
      await db.tasks.put(data);
    }
  } else if (item.action === "update" && item.payload) {
    await supabase
      .from("tasks")
      .update(item.payload)
      .eq("id", item.rowId);
  }
}

async function syncPhoto(item: { action: string; rowId: string; payload?: Record<string, unknown> }) {
  if (item.action === "delete") {
    // Try to delete from storage too
    if (item.payload?.image_url) {
      try {
        const url = new URL(item.payload.image_url as string);
        const pathParts = url.pathname.split("/storage/v1/object/public/ojt-logs/");
        if (pathParts[1]) {
          await supabase.storage
            .from("ojt-logs")
            .remove([decodeURIComponent(pathParts[1])]);
        }
      } catch {
        // best effort
      }
    }
    await supabase.from("photos").delete().eq("id", item.rowId);
  } else if (item.action === "insert" && item.payload) {
    // Re-upload the file from the offline blob
    const localPhoto = await db.photos.get(item.rowId);
    if (!localPhoto?.offline_blob) return;

    const userId = await currentUserId();
    const filename = (item.payload.filename as string) ?? "photo.jpg";
    const file = base64ToFile(localPhoto.offline_blob, filename);
    const filePath = `${userId}/${item.payload.log_id}/${Date.now()}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("ojt-logs")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("ojt-logs")
      .getPublicUrl(filePath);

    const { data } = await supabase
      .from("photos")
      .insert({ log_id: item.payload.log_id as string, image_url: urlData.publicUrl })
      .select()
      .single();

    if (data) {
      await db.photos.delete(item.rowId);
      await db.photos.put(data);
    }
  }
}

async function syncSettings(item: { action: string; rowId: string; payload?: Record<string, unknown> }) {
  if (item.action === "update" && item.payload) {
    const userId = await currentUserId();
    await supabase
      .from("settings")
      .update(item.payload)
      .eq("user_id", userId);
  }
}
