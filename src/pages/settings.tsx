import { useEffect, useState, type FormEvent } from "react";
import { useTheme, ACCENT_COLORS } from "@/hooks/use-theme";
import { getSettings, updateSettings } from "@/services/sync-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Save,
  Sun,
  Moon,
  RotateCcw,
  Sliders,
  Palette,
} from "lucide-react";
import PageTransition from "@/components/page-transition";

/**
 * Settings page -- configure required OJT hours and theme.
 */
export default function SettingsPage() {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const [requiredHours, setRequiredHours] = useState<number>(600);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const settings = await getSettings();
        setRequiredHours(settings.required_ojt_hours);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load settings"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (requiredHours <= 0 || requiredHours > 10000) {
      setError("Please enter a valid number of hours (1 - 10,000).");
      return;
    }

    try {
      setSaving(true);
      await updateSettings(requiredHours);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  /** Reset local settings (theme, cached data). */
  function handleResetLocal() {
    localStorage.clear();
    setTheme("light");
    setAccentColor("green");
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your OJT Tracker preferences.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Required hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sliders className="h-4 w-4 text-primary" />
            OJT Requirements
          </CardTitle>
          <CardDescription>
            Set the total number of OJT hours you need to complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="required-hours">Total Required Hours</Label>
              <Input
                id="required-hours"
                type="number"
                min={1}
                max={10000}
                value={requiredHours}
                onChange={(e) => setRequiredHours(Number(e.target.value))}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
              {success && (
                <span className="text-sm text-primary">
                  Settings saved.
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {theme === "dark" ? (
              <Moon className="h-4 w-4 text-primary" />
            ) : (
              <Sun className="h-4 w-4 text-primary" />
            )}
            Appearance
          </CardTitle>
          <CardDescription>
            Choose between light and dark mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
              className="gap-2"
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
              className="gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Accent color */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" />
            Accent Color
          </CardTitle>
          <CardDescription>
            Pick a primary color for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setAccentColor(color.value)}
                className={`group flex flex-col items-center gap-1.5`}
              >
                <span
                  className={`block h-8 w-8 rounded-full border-2 transition-all ${
                    accentColor === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.swatch }}
                />
                <span
                  className={`text-xs ${
                    accentColor === color.value
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {color.label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Separator />

      {/* Danger zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <RotateCcw className="h-4 w-4" />
            Reset Local Data
          </CardTitle>
          <CardDescription>
            Clear locally cached data and reset theme to default. This
            does not affect your data stored in Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset local data</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear your theme preference and any locally cached
                  data. Your account and OJT logs in the database will not be
                  affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetLocal}>
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
