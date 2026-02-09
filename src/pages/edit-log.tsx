import { useEffect, useState, useRef, type FormEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getDailyLogEntry,
  upsertTimeLog,
  createTask,
  updateTask,
  deleteTask,
  uploadPhoto,
  deletePhoto,
} from "@/services/supabase-service";
import type { Task, Photo } from "@/lib/types";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Upload,
  X,
  Clock,
  ClipboardList,
  Image,
} from "lucide-react";
import PageTransition from "@/components/page-transition";

/**
 * Add / Edit Log page -- allows creating or editing a day's time entry,
 * tasks, and photos.
 */
export default function EditLogPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time fields
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");

  // Photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);

  // Existing log ID (if editing)
  const [logId, setLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    loadEntry();
  }, [date]);

  async function loadEntry() {
    try {
      setLoading(true);
      setError(null);
      const entry = await getDailyLogEntry(date!);
      if (entry) {
        setLogId(entry.id);
        setTimeIn(entry.time_in ?? "");
        setTimeOut(entry.time_out ?? "");
        setTasks(entry.tasks);
        setPhotos(entry.photos);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entry");
    } finally {
      setLoading(false);
    }
  }

  /** Validate and save the time entry. */
  async function handleSaveTime(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (timeIn && timeOut) {
      const [inH, inM] = timeIn.split(":").map(Number);
      const [outH, outM] = timeOut.split(":").map(Number);
      if (outH * 60 + outM <= inH * 60 + inM) {
        setError("Time out must be after time in.");
        return;
      }
    }

    try {
      setSaving(true);

      let hoursRendered: number | null = null;
      if (timeIn && timeOut) {
        const [inH, inM] = timeIn.split(":").map(Number);
        const [outH, outM] = timeOut.split(":").map(Number);
        hoursRendered = parseFloat(
          ((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(2)
        );
      }

      const log = await upsertTimeLog({
        date: date!,
        time_in: timeIn || null,
        time_out: timeOut || null,
        hours_rendered: hoursRendered,
      });
      setLogId(log.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save time");
    } finally {
      setSaving(false);
    }
  }

  /** Add a new task to the current log. */
  async function handleAddTask() {
    if (!newTaskText.trim()) return;

    // Ensure we have a log first
    let currentLogId = logId;
    if (!currentLogId) {
      try {
        const log = await upsertTimeLog({
          date: date!,
          time_in: timeIn || null,
          time_out: timeOut || null,
          hours_rendered: null,
        });
        currentLogId = log.id;
        setLogId(log.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create log");
        return;
      }
    }

    try {
      const task = await createTask(currentLogId, newTaskText.trim());
      setTasks((prev) => [...prev, task]);
      setNewTaskText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    }
  }

  /** Save an edited task. */
  async function handleSaveTask(id: string) {
    if (!editingTaskText.trim()) return;
    try {
      const updated = await updateTask(id, editingTaskText.trim());
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingTaskId(null);
      setEditingTaskText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  /** Delete a task. */
  async function handleDeleteTask(id: string) {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  /** Handle file selection for photo upload. */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Ensure we have a log first
    let currentLogId = logId;
    if (!currentLogId) {
      try {
        const log = await upsertTimeLog({
          date: date!,
          time_in: timeIn || null,
          time_out: timeOut || null,
          hours_rendered: null,
        });
        currentLogId = log.id;
        setLogId(log.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create log");
        return;
      }
    }

    try {
      setUploading(true);
      for (const file of Array.from(files)) {
        const photo = await uploadPhoto(currentLogId, file);
        setPhotos((prev) => [...prev, photo]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      // Reset the input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Delete a photo. */
  async function handleDeletePhoto(photo: Photo) {
    try {
      await deletePhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
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
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/logs/${date}`}>
          <Button variant="ghost" size="icon" aria-label="Back to details">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {logId ? "Edit Entry" : "New Entry"}
          </h1>
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6"
            onClick={() => setError(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Time entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Time Record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveTime} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time-in">Time In</Label>
                <Input
                  id="time-in"
                  type="time"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-out">Time Out</Label>
                <Input
                  id="time-out"
                  type="time"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                />
              </div>
            </div>

            {timeIn && timeOut && (
              <p className="text-sm text-muted-foreground">
                Hours rendered:{" "}
                <strong className="text-foreground">
                  {(() => {
                    const [inH, inM] = timeIn.split(":").map(Number);
                    const [outH, outM] = timeOut.split(":").map(Number);
                    const hrs = (outH * 60 + outM - (inH * 60 + inM)) / 60;
                    return hrs > 0 ? hrs.toFixed(2) : "Invalid";
                  })()}
                </strong>
              </p>
            )}

            <Button type="submit" disabled={saving} size="sm" className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Time
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Tasks Accomplished
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing tasks */}
          {tasks.map((task, i) => (
            <div key={task.id} className="flex items-start gap-2">
              <span className="mt-2 shrink-0 text-xs text-muted-foreground">
                {i + 1}.
              </span>
              {editingTaskId === task.id ? (
                <div className="flex flex-1 gap-2">
                  <Textarea
                    value={editingTaskText}
                    onChange={(e) => setEditingTaskText(e.target.value)}
                    className="min-h-[60px] flex-1"
                  />
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleSaveTask(task.id)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingTaskId(null);
                        setEditingTaskText("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-start justify-between gap-2">
                  <p className="mt-1 text-sm">{task.description}</p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditingTaskText(task.description);
                      }}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete task</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this task.
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
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new task */}
          <div className="flex gap-2 pt-2">
            <Textarea
              placeholder="Describe what you worked on..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              className="min-h-[60px] flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddTask();
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleAddTask}
              disabled={!newTaskText.trim()}
              className="gap-1 self-end"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Image className="h-4 w-4 text-primary" />
            Photos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing photos */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <img
                    src={photo.image_url}
                    alt="OJT photo"
                    className="aspect-square w-full rounded-md border object-cover"
                    loading="lazy"
                  />
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
                          This will permanently remove this photo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeletePhoto(photo)}
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

          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload Photos"}
          </Button>
        </CardContent>
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-end gap-3 pb-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/logs/${date}`)}
        >
          Done
        </Button>
      </div>
    </PageTransition>
  );
}
