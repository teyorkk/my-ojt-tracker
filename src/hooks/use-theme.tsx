import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ojt-theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    // Green is the default (no attribute needed)
    if (accentColor === "green") {
      root.removeAttribute("data-accent");
    } else {
      root.setAttribute("data-accent", accentColor);
    }
    localStorage.setItem("ojt-accent", accentColor);
  }, [accentColor]);

  const toggleTheme = () =>
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

  const setTheme = (t: Theme) => setThemeState(t);

  const setAccentColor = (color: AccentColor) => setAccentColorState(color);

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
