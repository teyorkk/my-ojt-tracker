import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTimeLogs } from "@/services/supabase-service";
import type { TimeLog } from "@/lib/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  getDay,
  subMonths,
  addMonths,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  Plus,
} from "lucide-react";
import PageTransition from "@/components/page-transition";

/**
 * Daily logs page -- calendar view showing days with logged hours.
 * Clicking a date navigates to the daily details page.
 */
export default function DailyLogPage() {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTimeLogs();
        setLogs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Build a lookup map: date string -> TimeLog
  const logsByDate = new Map<string, TimeLog>();
  for (const log of logs) {
    logsByDate.set(log.date, log);
  }

  // Calendar grid for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the beginning of the grid so the first day lands on the right weekday
  const startPadding = getDay(monthStart); // 0 = Sunday

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Logs</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your daily OJT time entries.
          </p>
        </div>
        <Link to={`/logs/${format(new Date(), "yyyy-MM-dd")}/edit`}>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Entry</span>
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Calendar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">
            {format(currentMonth, "MMMM yyyy")}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Day-of-week headers */}
          <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for padding */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const log = logsByDate.get(dateStr);
              const hasLog = !!log;
              const hasHours = (log?.hours_rendered ?? 0) > 0;
              const today = isToday(day);

              return (
                <Link
                  key={dateStr}
                  to={`/logs/${dateStr}`}
                  className={`relative flex flex-col items-center rounded-md p-2 text-sm transition-colors hover:bg-accent ${
                    today ? "ring-1 ring-primary" : ""
                  } ${
                    !isSameMonth(day, currentMonth)
                      ? "text-muted-foreground/50"
                      : ""
                  }`}
                >
                  <span
                    className={
                      today ? "font-semibold text-primary" : ""
                    }
                  >
                    {format(day, "d")}
                  </span>

                  {hasLog && (
                    <div className="mt-0.5 flex items-center gap-0.5">
                      {hasHours ? (
                        <Badge
                          variant="secondary"
                          className="h-auto px-1 py-0 text-[10px] leading-tight"
                        >
                          {log.hours_rendered}h
                        </Badge>
                      ) : (
                        <Clock className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent entries list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No entries yet. Tap "New Entry" or use the Time In button on the dashboard.
            </p>
          )}
          {logs.slice(0, 10).map((log) => (
            <Link
              key={log.id}
              to={`/logs/${log.date}`}
              className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent"
            >
              <div>
                <p className="text-sm font-medium">
                  {format(new Date(log.date + "T00:00:00"), "EEEE, MMM d")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {log.time_in ?? "--"} &ndash; {log.time_out ?? "--"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {log.hours_rendered != null
                    ? `${log.hours_rendered} hrs`
                    : "In progress"}
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
