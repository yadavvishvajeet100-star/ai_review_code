import { useNavigate, useLocation } from "react-router-dom";
import {
  ScanLine, LayoutDashboard, MessageSquareCode, History, Settings,
  FileBarChart, Moon, Sun, LogOut, ChevronLeft, Shield,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { id: "review", label: "New Review", icon: ScanLine },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "chat", label: "AI Chat", icon: MessageSquareCode },
  { id: "history", label: "History", icon: History },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const currentPath = location.pathname.split("/")[1] || "review";

  return (
    <aside className={clsx(
      "fixed left-0 top-0 h-full bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 flex flex-col transition-all duration-300 z-30",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-surface-200 dark:border-surface-800 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-base text-surface-900 dark:text-surface-100 whitespace-nowrap">
            CodeGuard AI
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.id;
          return (
            <div
              key={item.id}
              onClick={() => navigate(`/${item.id}`)}
              className={clsx("sidebar-item", active ? "sidebar-item-active" : "sidebar-item-inactive")}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-surface-200 dark:border-surface-800 p-2 space-y-1">
        <div
          onClick={toggleTheme}
          className="sidebar-item sidebar-item-inactive"
          title={collapsed ? "Toggle theme" : undefined}
        >
          {theme === "dark" ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </div>

        <div
          onClick={() => signOut()}
          className="sidebar-item sidebar-item-inactive"
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </div>

        {/* User info */}
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2 mt-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 text-sm font-semibold shrink-0">
              {(profile?.display_name || user.email || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300 truncate">
                {profile?.display_name || "User"}
              </p>
              <p className="text-xs text-surface-400 truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-700 transition-all shadow-sm"
      >
        <ChevronLeft className={clsx("w-4 h-4 text-surface-500 transition-transform", collapsed && "rotate-180")} />
      </button>
    </aside>
  );
}
