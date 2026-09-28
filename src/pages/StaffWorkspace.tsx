import Brand from "@/components/ui/Brand";
import PageState from "@/components/ui/PageState";
import {
  ArrowUpRight,
  CalendarDays,
  ChefHat,
  Table2,
  Receipt,
  Truck,
  Package,
  BarChart3,
  Settings,
  LayoutDashboard,
  Heart,
  Clock3,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "@/hooks/useAuth";
interface Shift {
  _id: string;
  startedAt: string;
  endedAt?: string;
  status: "open" | "closed";
  breaks: { startedAt: string; endedAt?: string }[];
  workedMinutes: number;
  breakMinutes: number;
  userId?: { name: string };
}
const links = [
  {
    title: "Deliveries",
    icon: Truck,
    text: "Assign, dispatch and confirm guest deliveries",
    to: "/admin/delivery",
    perm: "delivery:read",
  },
  {
    title: "Inventory & purchasing",
    icon: Package,
    text: "Receive stock and manage suppliers",
    to: "/admin/purchasing",
    perm: "inventory:read",
  },
  {
    title: "Reports & reconciliation",
    icon: BarChart3,
    text: "Review sales, taxes and payment collections",
    to: "/admin/reports",
    perm: "report:read",
  },
  {
    title: "Restaurant setup",
    icon: Settings,
    text: "Review configuration and connection needs",
    to: "/admin/setup",
    perm: "restaurant:update",
  },
  {
    title: "Kitchen",
    icon: ChefHat,
    text: "Prepare and hand off orders",
    to: "/kds",
    perm: "kds:read",
  },
  {
    title: "Tables & service",
    icon: Table2,
    text: "Seat guests and serve orders",
    to: "/table-ops",
    perm: "table:read",
  },
  {
    title: "Counter & payments",
    icon: Receipt,
    text: "Collect tenders and close your drawer",
    to: "/billing-ops",
    perm: "billing:read",
  },
  {
    title: "Reservations & waitlist",
    icon: CalendarDays,
    text: "Review bookings and welcome walk-ins",
    to: "/admin/reservations",
    perm: "reservation:read",
  },
  {
    title: "Restaurant management",
    icon: LayoutDashboard,
    text: "Your permitted menus, reports and settings",
    to: "/admin",
    perm: "restaurant:read",
  },
];
const when = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const hours = (n: number) => `${Math.floor(n / 60)}h ${n % 60}m`;
export default function StaffWorkspace() {
  const user = useAuthStore((s) => s.user);
  const has = useAuthStore((s) => s.hasPermission);
  const logout = useLogout();
  const qc = useQueryClient();
  const [team, setTeam] = useState(false);
  const shifts = useQuery({
    queryKey: ["my-shifts"],
    queryFn: () => api.get<Shift[]>("/shifts/mine"),
    refetchInterval: 60000,
  });
  const teamShifts = useQuery({
    queryKey: ["team-shifts"],
    queryFn: () => api.get<Shift[]>("/shifts"),
    enabled: team && has("shift:read"),
  });
  const active = shifts.data?.find((s) => s.status === "open");
  const onBreak = active?.breaks.some((b) => !b.endedAt);
  const action = useMutation({
    mutationFn: (name: string) =>
      name === "clock_in"
        ? api.post("/shifts/clock-in")
        : api.post(`/shifts/${active?._id}/action`, { action: name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-shifts"] });
      qc.invalidateQueries({ queryKey: ["team-shifts"] });
    },
  });
  return (
    <div className="staff-surface workspace-page">
      <a href="#staff-tools" className="pinky-skip">
        Skip to staff tools
      </a>
      <header className="workspace-header">
        <Brand />
        <div className="flex gap-3 items-center">
          <span className="hidden sm:block text-xs text-gray-600">
            {user?.role.name}
          </span>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="ui-button"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </header>
      <main className="workspace-content">
        <section className="staff-welcome">
          <div>
            <span className="ui-eyebrow">YOUR STAFF WORKSPACE</span>
            <h1>Hello, {user?.name?.split(" ")[0] || "team"}.</h1>
            <p>
              A little care makes every visit special. Let’s get your day
              started.
            </p>
          </div>
          <Heart
            size={58}
            strokeWidth={1}
            className="text-[#7d9a87]"
            aria-hidden="true"
          />
        </section>
        <section className="rounded-2xl bg-white border p-5 sm:p-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Clock3 size={19} className="text-[#086874]" />
                Your shift
              </h2>
              <p className="mt-2" role="status">
                {shifts.isLoading
                  ? "Checking your shift…"
                  : shifts.isError
                    ? "Shift status unavailable"
                    : active
                      ? onBreak
                        ? "On break"
                        : `Clocked in · ${hours(active.workedMinutes)} worked`
                      : "You are clocked out"}
              </p>
              {active && (
                <p className="text-sm text-gray-600">
                  Started {when(active.startedAt)} PT ·{" "}
                  {hours(active.breakMinutes)} on breaks
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {active ? (
                <>
                  <button
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(onBreak ? "break_end" : "break_start")
                    }
                    className="border rounded-xl px-4 py-3"
                  >
                    {onBreak ? "End break" : "Start break"}
                  </button>
                  <button
                    disabled={action.isPending}
                    onClick={() => action.mutate("clock_out")}
                    className="bg-[#086874] text-white rounded-xl px-4 py-3"
                  >
                    Clock out
                  </button>
                </>
              ) : (
                <button
                  disabled={
                    action.isPending || shifts.isLoading || shifts.isError
                  }
                  onClick={() => action.mutate("clock_in")}
                  className="bg-[var(--promise-berry)] text-white rounded-xl px-4 py-3"
                >
                  Clock in
                </button>
              )}
            </div>
          </div>
          {(action.error || shifts.error) && (
            <p role="alert" className="text-red-700 mt-4">
              {(action.error || shifts.error)?.message}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-4">
            Clocking out ends an active break. These are attendance records;
            payroll calculations and corrections require review.
          </p>
        </section>
        <section id="staff-tools">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Your tools</h2>
            <span className="text-xs text-gray-500">
              Selected for your role
            </span>
          </div>
          <nav
            aria-label="Staff tools"
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {links
              .filter((l) => has(l.perm))
              .map((l) => (
                <Link key={l.to} to={l.to} className="workspace-tool">
                  <div className="workspace-tool-top">
                    <span className="workspace-tool-icon">
                      <l.icon size={21} />
                    </span>
                    <ArrowUpRight size={19} className="text-gray-400" />
                  </div>
                  <h2>{l.title}</h2>
                  <p className="text-sm text-gray-600 mt-2">{l.text}</p>
                </Link>
              ))}
          </nav>
        </section>
        <section>
          <div className="flex justify-between items-center gap-3 mb-4">
            <h2 className="font-bold text-xl">
              {team ? "Team attendance" : "Recent shifts"}
            </h2>
            {has("shift:read") && (
              <button className="underline" onClick={() => setTeam(!team)}>
                {team ? "Show my shifts" : "View team attendance"}
              </button>
            )}
          </div>
          {teamShifts.isError && team && (
            <p role="alert">{teamShifts.error.message}</p>
          )}
          {(team ? teamShifts.isLoading : shifts.isLoading) && (
            <PageState kind="loading" title="Loading attendance…" />
          )}
          {!(team ? teamShifts : shifts).isLoading &&
            !(team ? teamShifts : shifts).isError &&
            !(team ? teamShifts.data : shifts.data)?.length && (
              <div className="bg-white border rounded-2xl">
                <PageState
                  title="A fresh start"
                  description="Completed and active shifts will appear here after you clock in."
                />
              </div>
            )}
          {!!(team ? teamShifts.data : shifts.data)?.length && (
            <div className="overflow-auto bg-white rounded-2xl border">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b">
                    {team && <th className="p-4">Team member</th>}
                    <th className="p-4">Started · PT</th>
                    <th className="p-4">Ended · PT</th>
                    <th className="p-4">Worked</th>
                    <th className="p-4">Breaks</th>
                  </tr>
                </thead>
                <tbody>
                  {(team ? teamShifts.data : shifts.data)?.map((s) => (
                    <tr key={s._id} className="border-b">
                      {team && (
                        <td className="p-4">
                          {s.userId?.name ?? "Staff member"}
                        </td>
                      )}
                      <td className="p-4 whitespace-nowrap">
                        {when(s.startedAt)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {s.endedAt ? when(s.endedAt) : "In progress"}
                      </td>
                      <td className="p-4">{hours(s.workedMinutes)}</td>
                      <td className="p-4">{hours(s.breakMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
