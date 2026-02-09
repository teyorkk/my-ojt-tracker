import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { SyncProvider } from "@/hooks/use-sync";
import { SidebarProvider } from "@/hooks/use-sidebar";
import ProtectedRoute from "@/components/protected-route";
import AppLayout from "@/components/app-layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import DailyLogPage from "@/pages/daily-log";
import DailyDetailsPage from "@/pages/daily-details";
import EditLogPage from "@/pages/edit-log";
import SettingsPage from "@/pages/settings";
import NotFoundPage from "@/pages/not-found";

/**
 * Root application component.
 * Sets up providers (auth, theme, sync, sidebar) and client-side routing.
 */
function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SyncProvider>
            <SidebarProvider>
              <Routes>
                {/* Public route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/logs" element={<DailyLogPage />} />
                    <Route path="/logs/:date" element={<DailyDetailsPage />} />
                    <Route path="/logs/:date/edit" element={<EditLogPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </SidebarProvider>
          </SyncProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
