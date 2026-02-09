import { supabase } from "@/lib/supabase";
import type { TimeLog, Task, Photo, Settings, DailyLogEntry } from "@/lib/types";

/* ================================================================
   TIME LOGS
   ================================================================ */

/** Fetch all time logs for the current user, ordered by date descending. */
export async function getTimeLogs(): Promise<TimeLog[]> {
  const { data, error } = await supabase
    .from("time_logs")
    .select("*")
    .order("date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Fetch a single time log by date. */
export async function getTimeLogByDate(date: string): Promise<TimeLog | null> {
  const { data, error } = await supabase
    .from("time_logs")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Create or update (upsert) a time log for a given date. */
export async function upsertTimeLog(
  log: Partial<TimeLog> & { date: string }
): Promise<TimeLog> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("time_logs")
    .upsert(
      { ...log, user_id: user.id },
      { onConflict: "date,user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Delete a time log by its ID. */
export async function deleteTimeLog(id: string): Promise<void> {
  const { error } = await supabase.from("time_logs").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================
   TASKS
   ================================================================ */

/** Fetch tasks for a given log ID. */
export async function getTasksByLogId(logId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("log_id", logId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Create a new task for a log. */
export async function createTask(
  logId: string,
  description: string
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ log_id: logId, description })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Update a task's description. */
export async function updateTask(
  id: string,
  description: string
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({ description })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Delete a task by its ID. */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================
   PHOTOS
   ================================================================ */

/** Fetch photos for a given log ID. */
export async function getPhotosByLogId(logId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("log_id", logId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Upload a photo file to Supabase Storage and insert a row into photos table. */
export async function uploadPhoto(
  logId: string,
  file: File
): Promise<Photo> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  // Generate a unique path: user_id/log_id/timestamp-filename
  const filePath = `${user.id}/${logId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("ojt-logs")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("ojt-logs")
    .getPublicUrl(filePath);

  // Insert photo record
  const { data, error } = await supabase
    .from("photos")
    .insert({ log_id: logId, image_url: urlData.publicUrl })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Delete a photo (removes from storage and DB). */
export async function deletePhoto(photo: Photo): Promise<void> {
  // Extract storage path from URL
  const url = new URL(photo.image_url);
  const pathParts = url.pathname.split("/storage/v1/object/public/ojt-logs/");
  if (pathParts[1]) {
    await supabase.storage
      .from("ojt-logs")
      .remove([decodeURIComponent(pathParts[1])]);
  }

  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;
}

/* ================================================================
   DAILY LOG (composite)
   ================================================================ */

/** Fetch a full daily log entry (log + tasks + photos) for a given date. */
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

/** Get the user's settings. Creates a default row if none exists. */
export async function getSettings(): Promise<Settings> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  // If no settings row exists, create one with a default of 600 hours
  if (!data) {
    const { data: newSettings, error: insertError } = await supabase
      .from("settings")
      .insert({ user_id: user.id, required_ojt_hours: 600 })
      .select()
      .single();

    if (insertError) throw insertError;
    return newSettings;
  }

  return data;
}

/** Update the required OJT hours. */
export async function updateSettings(
  requiredHours: number
): Promise<Settings> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("settings")
    .update({ required_ojt_hours: requiredHours })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
