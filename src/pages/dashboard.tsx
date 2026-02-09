import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getTimeLogs, upsertTimeLog, getSettings } from "@/services/sync-service";
import type { TimeLog, DashboardStats } from "@/lib/types";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CalendarCheck,
  Hourglass,
  TrendingUp,
  LogIn,
  LogOut,
  Loader2,
  AlertCircle,
} from "lucide-react";
import PageTransition, { StaggerItem } from "@/components/page-transition";

/**
 * Dashboard page -- overview of OJT progress with time-in/out controls.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRequired: 0,
    totalCompleted: 0,
    remaining: 0,
    percentage: 0,
  });
  const [todayLog, setTodayLog] = useState<TimeLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [logs, settings] = await Promise.all([
        getTimeLogs(),
        getSettings(),
      ]);

      // Calculate total completed hours
      const totalCompleted = logs.reduce(
        (sum, log) => sum + (log.hours_rendered ?? 0),
        0
      );
      const totalRequired = settings.required_ojt_hours;
      const remaining = Math.max(0, totalRequired - totalCompleted);
      const percentage =
        totalRequired > 0
          ? Math.min(100, (totalCompleted / totalRequired) * 100)
          : 0;

      setStats({ totalRequired, totalCompleted, remaining, percentage });

      // Find today's log
      const todayEntry = logs.find((l) => l.date === today) ?? null;
      setTodayLog(todayEntry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  /** Record the current time as "time in" for today. */
  async function handleTimeIn() {
    try {
      setActionLoading(true);
      const now = format(new Date(), "HH:mm");
      const log = await upsertTimeLog({
        date: today,
        time_in: now,
        time_out: null,
        hours_rendered: null,
      });
      setTodayLog(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to time in");
    } finally {
      setActionLoading(false);
    }
  }

  /** Record the current time as "time out" for today and calculate hours. */
  async function handleTimeOut() {
    if (!todayLog?.time_in) return;

    try {
      setActionLoading(true);
      const now = format(new Date(), "HH:mm");

      // Calculate hours rendered
      const [inH, inM] = todayLog.time_in.split(":").map(Number);
      const [outH, outM] = now.split(":").map(Number);
      const hoursRendered = Math.max(
        0,
        parseFloat(((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(2))
      );

      const log = await upsertTimeLog({
        date: today,
        time_in: todayLog.time_in,
        time_out: now,
        hours_rendered: hoursRendered,
      });
      setTodayLog(log);

      // Refresh stats
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to time out");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const timedIn = todayLog?.time_in && !todayLog?.time_out;
  const timedOut = todayLog?.time_out;

  return (
    <PageTransition className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}.
          Here is your OJT progress.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem index={0}>
          <SummaryCard
            title="Required Hours"
            value={`${stats.totalRequired}`}
            icon={CalendarCheck}
          />
        </StaggerItem>
        <StaggerItem index={1}>
          <SummaryCard
            title="Completed"
            value={`${stats.totalCompleted.toFixed(1)}`}
            icon={Clock}
          />
        </StaggerItem>
        <StaggerItem index={2}>
          <SummaryCard
            title="Remaining"
            value={`${stats.remaining.toFixed(1)}`}
            icon={Hourglass}
          />
        </StaggerItem>
        <StaggerItem index={3}>
          <SummaryCard
            title="Progress"
            value={`${stats.percentage.toFixed(1)}%`}
            icon={TrendingUp}
          />
        </StaggerItem>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall completion</span>
            <span className="font-medium">{stats.percentage.toFixed(1)}%</span>
          </div>
          <Progress value={stats.percentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Today's status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Today &mdash; {format(new Date(), "MMMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status text */}
          <div className="text-sm text-muted-foreground">
            {!todayLog && "You have not timed in today."}
            {timedIn && (
              <span>
                Timed in at <strong className="text-foreground">{todayLog.time_in}</strong>. Session is ongoing.
              </span>
            )}
            {timedOut && (
              <span>
                Timed in at <strong className="text-foreground">{todayLog.time_in}</strong>,
                timed out at <strong className="text-foreground">{todayLog.time_out}</strong>.
                You logged <strong className="text-foreground">{todayLog.hours_rendered} hrs</strong> today.
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleTimeIn}
              disabled={actionLoading || !!todayLog?.time_in}
              className="gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Time In
            </Button>
            <Button
              onClick={handleTimeOut}
              disabled={actionLoading || !timedIn}
              variant="outline"
              className="gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Time Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}

/* ===== Sub-component ===== */

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
