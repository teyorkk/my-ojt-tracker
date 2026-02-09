import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/app-sidebar";
import { useSidebar } from "@/hooks/use-sidebar";

/**
 * Main layout wrapper. Renders the sidebar and page content.
 * On desktop the main area is offset by the sidebar width.
 */
export default function AppLayout() {
  const { collapsed } = useSidebar();

  // Sidebar is hidden on mobile (md:hidden), so we only apply margin on md+.
  // Use a CSS media query approach via a wrapper that gets margin on md screens.
  const sidebarOffset = collapsed ? 68 : 240;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <SidebarOffset offset={sidebarOffset}>
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </SidebarOffset>
    </div>
  );
}

/** Applies left margin only on md+ screens via inline media query workaround. */
function SidebarOffset({
  offset,
  children,
}: {
  offset: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          .sidebar-offset {
            margin-left: ${offset}px;
            transition: margin-left 300ms;
          }
        }
      `}</style>
      <main className="sidebar-offset">{children}</main>
    </>
  );
}
