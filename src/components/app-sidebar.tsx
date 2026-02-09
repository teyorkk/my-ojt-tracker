import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useSync } from "@/hooks/use-sync";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  LayoutDashboard,
  CalendarDays,
  Settings,
  LogOut,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Menu,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/logs", label: "Daily Logs", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings },
];

const SIDEBAR_WIDTH_EXPANDED = "w-60";
const SIDEBAR_WIDTH_COLLAPSED = "w-[68px]";

/* ================================================================
   Desktop sidebar
   ================================================================ */

function DesktopSidebar() {
  const { collapsed, setCollapsed } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { online, isSyncing, pendingCount, triggerSync } = useSync();

  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={`hidden md:flex fixed inset-y-0 left-0 z-40 flex-col border-r bg-background transition-all duration-300 ${width}`}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-3">
          {!collapsed && (
            <Link to="/" className="text-lg font-semibold tracking-tight truncate">
              OJT Tracker
            </Link>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto shrink-0"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand" : "Collapse"}
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);

            const btn = (
              <Link key={to} to={to} className="block">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full gap-3 ${collapsed ? "justify-center px-0" : "justify-start"}`}
                  size={collapsed ? "icon" : "default"}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Button>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto space-y-1 px-2 py-3">
          {/* Online status + sync */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full"
                  onClick={online && pendingCount > 0 ? triggerSync : undefined}
                >
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : online ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isSyncing
                  ? "Syncing…"
                  : online
                    ? pendingCount > 0
                      ? `Online · ${pendingCount} pending`
                      : "Online"
                    : `Offline · ${pendingCount} pending`}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={online && pendingCount > 0 ? triggerSync : undefined}
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
              ) : online ? (
                <Wifi className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <span className="truncate text-sm">
                {isSyncing
                  ? "Syncing…"
                  : online
                    ? "Online"
                    : "Offline"}
              </span>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {pendingCount}
                </Badge>
              )}
            </Button>
          )}

          <Separator />

          {/* Theme toggle */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full"
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 shrink-0" />
              ) : (
                <Moon className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate text-sm">
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </Button>
          )}

          {/* Sign out */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full text-muted-foreground"
                  onClick={signOut}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm">Sign out</span>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

/* ================================================================
   Mobile sidebar (Sheet drawer)
   ================================================================ */

function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { online, isSyncing, pendingCount, triggerSync } = useSync();

  // Close sheet on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="md:hidden">
      {/* Top bar with hamburger */}
      <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background/80 backdrop-blur-sm px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {/* Header */}
            <div className="flex h-14 items-center px-4">
              <Link
                to="/"
                className="text-lg font-semibold tracking-tight"
                onClick={() => setOpen(false)}
              >
                OJT Tracker
              </Link>
            </div>

            <Separator />

            {/* Nav */}
            <nav className="flex-1 space-y-1 px-3 py-3">
              {navItems.map(({ to, label, icon: Icon }) => {
                const isActive =
                  to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to);

                return (
                  <Link key={to} to={to} className="block">
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start gap-3"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <Separator />

            {/* Footer */}
            <div className="space-y-1 px-3 py-3">
              {/* Sync status */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={online && pendingCount > 0 ? triggerSync : undefined}
              >
                {isSyncing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : online ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  {isSyncing
                    ? "Syncing…"
                    : online
                      ? "Online"
                      : "Offline"}
                </span>
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {pendingCount}
                  </Badge>
                )}
              </Button>

              <Separator />

              {/* Theme */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              </Button>

              {/* Sign out */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Sign out</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <span className="ml-3 text-lg font-semibold tracking-tight">
          OJT Tracker
        </span>

        {/* Online indicator on mobile header */}
        <div className="ml-auto flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : online ? (
            <Wifi className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
      </header>
    </div>
  );
}

/* ================================================================
   Combined export
   ================================================================ */

export default function AppSidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}
