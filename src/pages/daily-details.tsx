import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getDailyLogEntry, deleteTask, deletePhoto } from "@/services/supabase-service";
import type { DailyLogEntry } from "@/lib/types";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  AlertCircle,
  Pencil,
  Clock,
  ClipboardList,
  Image,
  Trash2,
  ArrowLeft,
} from "lucide-react";

/**
 * Daily details page -- shows time info, tasks, and photos for a single day.
 */
export default function DailyDetailsPage() {
  const { date } = useParams<{ date: string }>();
  const [entry, setEntry] = useState<DailyLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    loadEntry();
  }, [date]);

  async function loadEntry() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDailyLogEntry(date!);
      setEntry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entry");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId);
      await loadEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  async function handleDeletePhoto(photoId: string) {
    const photo = entry?.photos.find((p) => p.id === photoId);
    if (!photo) return;
    try {
      await deletePhoto(photo);
      await loadEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const formattedDate = date
    ? format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy")
    : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/logs">
            <Button variant="ghost" size="icon" aria-label="Back to logs">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {formattedDate}
            </h1>
            <p className="text-sm text-muted-foreground">
              Daily log details
            </p>
          </div>
        </div>
        <Link to={`/logs/${date}/edit`}>
          <Button size="sm" variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!entry ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              No log found for this date.
            </p>
            <Link to={`/logs/${date}/edit`}>
              <Button className="mt-4 gap-2">
                <Pencil className="h-4 w-4" />
                Create Entry
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Time card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Time Record
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Time In</p>
                  <p className="text-lg font-semibold">
                    {entry.time_in ?? "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time Out</p>
                  <p className="text-lg font-semibold">
                    {entry.time_out ?? "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hours</p>
                  <p className="text-lg font-semibold">
                    {entry.hours_rendered != null
                      ? `${entry.hours_rendered}`
                      : "--"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-primary" />
                Tasks Accomplished
                <Badge variant="secondary" className="ml-auto">
                  {entry.tasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entry.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks recorded for this day.
                </p>
              ) : (
                <ul className="space-y-2">
                  {entry.tasks.map((task, i) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="flex gap-2">
                        <span className="mt-0.5 shrink-0 text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span>{task.description}</span>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete task</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the task. Continue?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Photos card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Image className="h-4 w-4 text-primary" />
                Photos
                <Badge variant="secondary" className="ml-auto">
                  {entry.photos.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entry.photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No photos uploaded for this day.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {entry.photos.map((photo) => (
                    <div key={photo.id} className="group relative">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="block w-full overflow-hidden rounded-md border">
                            <img
                              src={photo.image_url}
                              alt="OJT photo"
                              className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                              loading="lazy"
                            />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl p-2">
                          <img
                            src={photo.image_url}
                            alt="OJT photo full"
                            className="w-full rounded-md"
                          />
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute right-1.5 top-1.5 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete photo</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this photo. Continue?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePhoto(photo.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
