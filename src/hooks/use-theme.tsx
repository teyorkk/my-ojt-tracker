import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { updateThemeSettings } from "@/services/sync-service";

/* ===== Theme Types ===== */

type Theme = "light" | "dark";

export type AccentColor =
  | "green"
  | "blue"
  | "red"
  | "orange"
  | "purple"
  | "rose"
  | "yellow";

export const ACCENT_COLORS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: "green", label: "Green", swatch: "oklch(0.508 0.16 145.023)" },
  { value: "blue", label: "Blue", swatch: "oklch(0.546 0.205 262.881)" },
  { value: "red", label: "Red", swatch: "oklch(0.577 0.245 27.325)" },
  { value: "orange", label: "Orange", swatch: "oklch(0.705 0.191 47.604)" },
  { value: "purple", label: "Purple", swatch: "oklch(0.553 0.235 303.374)" },
  { value: "rose", label: "Rose", swatch: "oklch(0.585 0.22 350.1)" },
  { value: "yellow", label: "Yellow", swatch: "oklch(0.795 0.184 86.047)" },
];

interface ThemeContextType {
  theme: Theme;
  accentColor: AccentColor;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* ===== helpers ===== */

function applyThemeToDOM(theme: Theme, accent: AccentColor) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  if (accent === "green") {
    root.removeAttribute("data-accent");
  } else {
    root.setAttribute("data-accent", accent);
  }
}

/* ===== Theme Provider ===== */

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("ojt-theme") as Theme | null;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem("ojt-accent") as AccentColor | null;
    return stored ?? "green";
  });

  // Apply to DOM whenever values change
  useEffect(() => {
    applyThemeToDOM(theme, accentColor);
    localStorage.setItem("ojt-theme", theme);
    localStorage.setItem("ojt-accent", accentColor);
  }, [theme, accentColor]);

  // On auth state change (login), load theme prefs from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_IN") {
          try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return;
            const { data } = await supabase
              .from("settings")
              .select("accent_color, theme")
              .eq("user_id", user.id)
              .maybeSingle();
            if (data) {
              const dbTheme = (data.theme === "dark" ? "dark" : "light") as Theme;
              const dbAccent = (data.accent_color ?? "green") as AccentColor;
              setThemeState(dbTheme);
              setAccentColorState(dbAccent);
              applyThemeToDOM(dbTheme, dbAccent);
            }
          } catch {
            // Silently fall back to localStorage values
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Persist to Supabase (debounced-ish: fire-and-forget)
  const persistToSupabase = useCallback(
    (t: Theme, a: AccentColor) => {
      updateThemeSettings(a, t).catch(() => {
        // best-effort -- if offline the local values still apply
      });
    },
    []
  );

  const toggleTheme = () =>
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      persistToSupabase(next, accentColor);
      return next;
    });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    persistToSupabase(t, accentColor);
  };

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    persistToSupabase(theme, color);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, accentColor, toggleTheme, setTheme, setAccentColor }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/* ===== Hook ===== */

/** Access theme context. Must be used within <ThemeProvider>. */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
