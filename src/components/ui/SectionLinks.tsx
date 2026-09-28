import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
const destinations: Record<
  string,
  { label: string; to: string; perm: string }
> = {
  orders: { label: "Orders", to: "/admin/orders", perm: "order:read" },
  floor: { label: "Floor service", to: "/table-ops", perm: "table:read" },
  counter: {
    label: "Counter & payments",
    to: "/billing-ops",
    perm: "billing:read",
  },
  kitchen: { label: "Kitchen", to: "/kds", perm: "kds:read" },
  menu: { label: "Menu", to: "/admin/menu", perm: "menu:read" },
  purchasing: {
    label: "Purchasing",
    to: "/admin/purchasing",
    perm: "inventory:read",
  },
  inventory: {
    label: "Inventory & recipes",
    to: "/admin/inventory",
    perm: "inventory:read",
  },
  reports: { label: "Reports", to: "/admin/reports", perm: "report:read" },
  customers: {
    label: "Customers",
    to: "/admin/customers",
    perm: "customer:read",
  },
  feedback: {
    label: "Guest feedback",
    to: "/admin/feedback",
    perm: "feedback:read",
  },
  reservations: {
    label: "Reservations",
    to: "/admin/reservations",
    perm: "reservation:read",
  },
  close: { label: "Day close", to: "/admin/day-close", perm: "day:close" },
  settings: {
    label: "Restaurant settings",
    to: "/admin/settings",
    perm: "restaurant:read",
  },
  setup: {
    label: "Setup checks",
    to: "/admin/setup",
    perm: "restaurant:update",
  },
  audit: { label: "Audit history", to: "/admin/audit", perm: "audit:read" },
  users: { label: "Staff & roles", to: "/admin/users", perm: "user:read" },
};
const related: Record<string, string[]> = {
  dashboard: ["orders", "floor", "close"],
  menu: ["inventory", "orders"],
  qr: ["floor", "menu"],
  orders: ["kitchen", "counter", "floor"],
  tables: ["floor", "reservations"],
  billing: ["counter", "close"],
  reservations: ["floor", "customers"],
  inventory: ["purchasing", "menu"],
  purchasing: ["inventory", "reports"],
  customers: ["feedback", "orders"],
  feedback: ["customers", "orders"],
  loyalty: ["customers", "counter"],
  reports: ["close", "audit"],
  notifications: ["reservations", "settings"],
  users: ["audit", "setup"],
  audit: ["users", "reports"],
  "day-close": ["counter", "reports"],
  delivery: ["orders", "settings"],
  settings: ["setup", "menu"],
  setup: ["settings", "users"],
};
export default function SectionLinks({ section }: { section: string }) {
  const has = useAuthStore((s) => s.hasPermission);
  const links = (related[section] ?? [])
    .map((key) => destinations[key])
    .filter((link) => has(link.perm));
  if (!links.length) return null;
  return (
    <nav className="section-links" aria-label="Related work">
      <span>Continue to</span>
      {links.map((link) => (
        <Link key={link.to} to={link.to}>
          {link.label}
          <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}
