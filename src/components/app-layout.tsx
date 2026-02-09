import { Outlet } from "react-router-dom";
import AppHeader from "@/components/app-header";

/**
 * Main layout wrapper. Renders the header and page content
 * with consistent max-width and padding. Adds bottom padding
 * on mobile to account for the fixed bottom nav.
 */
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-20 md:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
