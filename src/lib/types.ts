/* ===== Database Row Types (mirror Supabase PostgreSQL tables) ===== */

/** time_logs table */
export interface TimeLog {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  time_in: string | null; // ISO timestamp or HH:mm
  time_out: string | null;
  hours_rendered: number | null;
  user_id: string;
  created_at: string;
}

/** tasks table */
export interface Task {
  id: string;
  log_id: string;
  description: string;
  created_at: string;
}

/** photos table */
export interface Photo {
  id: string;
  log_id: string;
  image_url: string;
  created_at: string;
}

/** settings table (single row per user) */
export interface Settings {
  id: string;
  user_id: string;
  required_ojt_hours: number;
  accent_color: string;
  theme: string;
}

/* ===== Composite types used in the UI ===== */

/** A daily log entry with its associated tasks and photos */
export interface DailyLogEntry extends TimeLog {
  tasks: Task[];
  photos: Photo[];
}

/** Dashboard summary stats */
export interface DashboardStats {
  totalRequired: number;
  totalCompleted: number;
  remaining: number;
  percentage: number;
}
