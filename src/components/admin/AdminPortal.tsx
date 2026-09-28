import QueryStatus from "@/components/ui/QueryStatus";
import SectionLinks from "@/components/ui/SectionLinks";
import Brand from "@/components/ui/Brand";
import Dialog from "@/components/ui/Dialog";
import PageState from "@/components/ui/PageState";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useState, useEffect, lazy, Suspense } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  ShoppingBag,
  Table2,
  Receipt,
  Package,
  Users,
  Gift,
  BarChart3,
  Settings,
  Shield,
  ClipboardList,
  Bell,
  ChevronLeft,
  Menu,
  X,
  Lock,
  LogOut,
  Store,
  MessageSquare,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "@/hooks/useAuth";

import RequirePermission from "@/components/auth/RequirePermission";

const AdminDelivery = lazy(() => import("./AdminDelivery"));
const AdminSetup = lazy(() => import("./AdminSetup"));
const AdminDayClose = lazy(() => import("./AdminDayClose"));
const AdminTips = lazy(() => import("./AdminTips"));
const AdminPurchasing = lazy(() => import("./AdminPurchasing"));
const AdminReservations = lazy(() => import("./AdminReservations"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const AdminReports = lazy(() => import("./AdminReports"));
const AdminMenuManagement = lazy(() => import("./AdminMenuManagement"));
const AdminInventory = lazy(() => import("./AdminInventory"));
const AdminOrders = lazy(() => import("./AdminOrders"));
const AdminTables = lazy(() => import("./AdminTables"));
const AdminQR = lazy(() => import("./AdminQR"));
const AdminBilling = lazy(() => import("./AdminBilling"));
const AdminCustomers = lazy(() => import("./AdminCustomers"));
const AdminFeedback = lazy(() => import("./AdminFeedback"));
const AdminLoyalty = lazy(() => import("./AdminLoyalty"));
const AdminNotifications = lazy(() => import("./AdminNotifications"));
const AdminSettings = lazy(() => import("./AdminSettings"));
const AdminUsers = lazy(() => import("./AdminUsers"));
const AdminAuditLogs = lazy(() => import("./AdminAuditLogs"));

type AdminModule =
  | "delivery"
  | "setup"
  | "day-close"
  | "tips"
  | "purchasing"
  | "reservations"
  | "dashboard"
  | "menu"
  | "qr"
  | "orders"
  | "tables"
  | "billing"
  | "inventory"
  | "customers"
  | "feedback"
  | "loyalty"
  | "reports"
  | "settings"
  | "notifications"
  | "users"
  | "audit";

interface NavItem {
  id: AdminModule;
  label: string;
  icon: React.ElementType;
  built: boolean;
  /** Permission key(s) required to even see this module. Empty = visible to all. */
  perm?: string | string[];
}

// Map each admin module to the backend permission that gates the corresponding API.
// We deliberately use the *:read permission since each page calls list endpoints first.
const MODULE_PERMS: Record<AdminModule, string | string[] | undefined> = {
  delivery: "delivery:read",
  setup: "restaurant:update",
  "day-close": "day:close",
  tips: "tips:read",
  purchasing: "inventory:read",
  reservations: "reservation:read",
  dashboard: "report:read",
  menu: "menu:read",
  qr: "qr:read",
  orders: "order:read",
  tables: "table:read",
  billing: ["billing:read", "payment:read"],
  inventory: "inventory:read",
  customers: "customer:read",
  feedback: "feedback:read",
  loyalty: ["discount:read", "coupon:read", "loyalty:read"],
  reports: "report:read",
  settings: "restaurant:read",
  notifications: "notification:read",
  users: ["user:read", "role:read"],
  audit: "audit:read",
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        built: true,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        id: "menu",
        label: "Menu Management",
        icon: UtensilsCrossed,
        built: true,
      },
      { id: "qr", label: "QR Management", icon: QrCode, built: true },
      {
        id: "orders",
        label: "Order Management",
        icon: ShoppingBag,
        built: true,
      },
      {
        id: "delivery",
        label: "Staff Delivery",
        icon: ShoppingBag,
        built: true,
      },
      {
        id: "reservations",
        label: "Reservations",
        icon: ClipboardList,
        built: true,
      },
      { id: "tables", label: "Table Management", icon: Table2, built: true },
      { id: "day-close", label: "Day Close", icon: ClipboardList, built: true },
      { id: "tips", label: "Tip Payouts", icon: Gift, built: true },
      {
        id: "billing",
        label: "Billing & Payments",
        icon: Receipt,
        built: true,
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        id: "purchasing",
        label: "Purchasing & Suppliers",
        icon: Package,
        built: true,
      },
      { id: "inventory", label: "Inventory", icon: Package, built: true },
      { id: "customers", label: "Customers", icon: Users, built: true },
      { id: "feedback", label: "Feedback", icon: MessageSquare, built: true },
      { id: "loyalty", label: "Loyalty & Coupons", icon: Gift, built: true },
    ],
  },
  {
    title: "Analytics",
    items: [
      {
        id: "reports",
        label: "Reports & Analytics",
        icon: BarChart3,
        built: true,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        id: "setup",
        label: "Restaurant Setup",
        icon: ClipboardList,
        built: true,
      },
      {
        id: "settings",
        label: "Restaurant Settings",
        icon: Settings,
        built: true,
      },
      { id: "notifications", label: "Notifications", icon: Bell, built: true },
      { id: "users", label: "User & Role Mgmt", icon: Shield, built: true },
      { id: "audit", label: "Audit Logs", icon: ClipboardList, built: true },
    ],
  },
];

// Modules that use full-height layout (no internal padding wrapper)
const FULL_HEIGHT_MODULES: AdminModule[] = [
  "menu",
  "orders",
  "customers",
  "settings",
];

function ComingSoon({ module }: { module: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <Lock className="w-7 h-7 text-gray-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">
          {module} — Coming Soon
        </h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          This module is under development.
        </p>
      </div>
      <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">
        Planned for next sprint
      </span>
    </div>
  );
}

function Sidebar({
  active,
  onNavigate,
  collapsed,
  mobileClose,
}: {
  active: AdminModule;
  onNavigate: (m: AdminModule) => void;
  collapsed: boolean;
  mobileClose?: () => void;
}) {
  const has = useAuthStore((s) => s.hasPermission);
  const visible = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const perm = MODULE_PERMS[i.id];
      return !perm || (Array.isArray(perm) ? perm : [perm]).some(has);
    }),
  })).filter((g) => g.items.length);
  return (
    <aside className={`staff-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="staff-sidebar-brand">
        <Brand compact={collapsed} />
        {mobileClose && (
          <button
            className="ui-icon-button staff-navigation-close"
            onClick={mobileClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="staff-sidebar-nav" aria-label="Restaurant management">
        {visible.map((group) => (
          <div className="staff-nav-group" key={group.title}>
            {!collapsed && <p>{group.title}</p>}
            {group.items.map((item) => (
              <Link
                key={item.id}
                to={`/admin/${item.id}`}
                onClick={() => onNavigate(item.id)}
                aria-label={item.label}
                aria-current={active === item.id ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`staff-nav-link ${active === item.id ? "active" : ""}`}
              >
                <item.icon aria-hidden="true" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function TopBar({
  module,
  onExit,
  onToggle,
  onMobileToggle,
  onSignOut,
  collapsed,
}: {
  module: AdminModule;
  onExit: () => void;
  onToggle: () => void;
  onMobileToggle: () => void;
  onSignOut: () => void;
  collapsed: boolean;
}) {
  const has = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);
  const label =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === module)?.label ??
    module;
  return (
    <header className="staff-topbar">
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="ui-icon-button staff-mobile-toggle"
          onClick={onMobileToggle}
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>
        <button
          className="ui-icon-button staff-desktop-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <nav className="staff-breadcrumb" aria-label="Breadcrumb">
            <Link to="/staff/workspace">Workspace</Link>
            <span aria-hidden="true">/</span>
            <span>Management</span>
          </nav>
          <p className="staff-topbar-title">{label}</p>
        </div>
      </div>
      <div className="staff-topbar-actions">
        <div className="staff-date">
          <strong>
            {new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Los_Angeles",
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </strong>
          California · Pacific time
        </div>
        {has("notification:read") && (
          <Link
            to="/admin/notifications"
            className="ui-icon-button"
            aria-label="Notification log"
          >
            <Bell size={18} />
          </Link>
        )}
        <button className="ui-button" onClick={onExit}>
          <Store size={15} />
          View café
        </button>
        <div className="staff-topbar-user">
          <span className="ui-avatar">
            {(user?.name?.[0] ?? "S").toUpperCase()}
          </span>
          <div className="staff-topbar-user-meta">
            <strong className="truncate">{user?.name ?? "Staff"}</strong>
            <small>{user?.role.name ?? "Team member"}</small>
          </div>
          <button
            className="ui-icon-button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default function AdminPortal({ onExit }: { onExit: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const requested = location.pathname.split("/")[2] as AdminModule | undefined;
  const available = NAV_GROUPS.flatMap((group) => group.items).filter(
    (item) => {
      const permission = MODULE_PERMS[item.id];
      return (
        !permission ||
        (Array.isArray(permission) ? permission : [permission]).some(
          hasPermission,
        )
      );
    },
  );
  const activeModule: AdminModule =
    requested && requested in MODULE_PERMS
      ? requested
      : (available[0]?.id ?? "dashboard");
  const setActiveModule = (module: AdminModule) => navigate(`/admin/${module}`);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.title = `${NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeModule)?.label ?? "Workspace"} · Pinky Promise`;
  }, [activeModule]);
  const logoutMutation = useLogout();

  const activeItem = NAV_GROUPS.flatMap((g) => g.items).find(
    (i) => i.id === activeModule,
  );
  const moduleLabel = activeItem?.label || activeModule;
  const isFullHeight = FULL_HEIGHT_MODULES.includes(activeModule);

  function renderModule() {
    let inner: React.ReactNode;
    switch (activeModule) {
      case "delivery":
        inner = <AdminDelivery />;
        break;
      case "setup":
        inner = <AdminSetup />;
        break;
      case "day-close":
        inner = <AdminDayClose />;
        break;
      case "tips":
        inner = <AdminTips />;
        break;
      case "purchasing":
        inner = <AdminPurchasing />;
        break;
      case "reservations":
        inner = <AdminReservations />;
        break;
      case "dashboard":
        inner = <AdminDashboard />;
        break;
      case "reports":
        inner = <AdminReports />;
        break;
      case "menu":
        inner = <AdminMenuManagement />;
        break;
      case "inventory":
        inner = <AdminInventory />;
        break;
      case "orders":
        inner = <AdminOrders />;
        break;
      case "tables":
        inner = <AdminTables />;
        break;
      case "qr":
        inner = <AdminQR />;
        break;
      case "billing":
        inner = <AdminBilling />;
        break;
      case "customers":
        inner = <AdminCustomers />;
        break;
      case "feedback":
        inner = <AdminFeedback />;
        break;
      case "loyalty":
        inner = <AdminLoyalty />;
        break;
      case "settings":
        inner = <AdminSettings />;
        break;
      case "notifications":
        inner = <AdminNotifications />;
        break;
      case "users":
        inner = <AdminUsers />;
        break;
      case "audit":
        inner = <AdminAuditLogs />;
        break;
      default:
        inner = <ComingSoon module={moduleLabel} />;
    }
    const perm = MODULE_PERMS[activeModule];
    if (perm) {
      return <RequirePermission perm={perm}>{inner}</RequirePermission>;
    }
    return inner;
  }

  const sidebar = (mobile = false) => (
    <Sidebar
      active={activeModule}
      onNavigate={setActiveModule}
      collapsed={mobile ? false : sidebarCollapsed}
      mobileClose={mobile ? () => setMobileOpen(false) : undefined}
    />
  );
  return (
    <div className="staff-surface staff-shell">
      <a href="#workspace-content" className="pinky-skip">
        Skip to content
      </a>
      <div className="staff-desktop-sidebar">{sidebar()}</div>
      {mobileOpen && (
        <Dialog
          label="Restaurant navigation"
          onClose={() => setMobileOpen(false)}
          className="staff-navigation-dialog staff-surface"
        >
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          {sidebar(true)}
        </Dialog>
      )}
      <div className="staff-shell-content">
        <TopBar
          module={activeModule}
          onExit={onExit}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          onMobileToggle={() => setMobileOpen(true)}
          onSignOut={() => logoutMutation.mutate()}
          collapsed={sidebarCollapsed}
        />
        <QueryStatus />
        <SectionLinks section={activeModule} />
        <main
          id="workspace-content"
          tabIndex={-1}
          className={`staff-main ${isFullHeight ? "staff-main-full" : ""}`}
          key={activeModule}
        >
          <div className="staff-main-inner">
            <Suspense
              fallback={
                <PageState kind="loading" title="Opening your workspace…" />
              }
            >
              {renderModule()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
