import QueryStatus from "./components/ui/QueryStatus";
import ConnectionNotice from "./components/ui/ConnectionNotice";
import Brand from "./components/ui/Brand";
import { useAuthStore } from "./stores/auth.store";
import { NavLink } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import {
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import RequirePermission from "./components/auth/RequirePermission";
import { CurrencyProvider } from "./context/CurrencyContext";
import { useMe } from "./hooks/useAuth";
import { useBrandTheme } from "./hooks/useBrandTheme";
import PinkyHome from "./pages/PinkyHome";

const StaffWorkspace = lazy(() => import("./pages/StaffWorkspace"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminPortal = lazy(() => import("./components/admin/AdminPortal"));
const KitchenDisplaySystem = lazy(
  () => import("./components/operations/KitchenDisplaySystem"),
);
const TableOperations = lazy(
  () => import("./components/operations/TableOperations"),
);
const BillingPayments = lazy(
  () => import("./components/operations/BillingPayments"),
);
const GuestOrderPage = lazy(() => import("./pages/guest/GuestOrderPage"));
const GuestWindowPage = lazy(() => import("./pages/guest/GuestWindowPage"));
const GuestTrackPage = lazy(() => import("./pages/guest/GuestTrackPage"));
const NowServingPage = lazy(() => import("./pages/guest/NowServingPage"));
const ManageReservation = lazy(() => import("./pages/ManageReservation"));
const PinkyReservation = lazy(() => import("./pages/PinkyReservation"));

function StaffScreen({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const has = useAuthStore((s) => s.hasPermission);
  return (
    <RequireAuth>
      <RequirePermission perm={permission}>
        <div className="staff-surface operations-wrapper">
          <nav className="operations-nav" aria-label="Staff navigation">
            <Brand />
            <div className="operations-links">
              <NavLink to="/staff/workspace">← Workspace</NavLink>
              {has("kds:read") && <NavLink to="/kds">Kitchen</NavLink>}
              {has("table:read") && (
                <NavLink to="/table-ops">Tables & service</NavLink>
              )}
              {has("billing:read") && (
                <NavLink to="/billing-ops">Counter & payments</NavLink>
              )}
            </div>
          </nav>
          <QueryStatus />
          {children}
        </div>
      </RequirePermission>
    </RequireAuth>
  );
}
function LegacyQrRedirect() {
  const location = useLocation();
  return <Navigate to={`/order${location.search}`} replace />;
}
export default function App() {
  useMe();
  useBrandTheme();
  const navigate = useNavigate();
  return (
    <CurrencyProvider>
      <ConnectionNotice />
      <Suspense
        fallback={
          <div
            role="status"
            className="min-h-screen grid place-items-center bg-[#fff8ef] text-[var(--promise-berry)]"
          >
            Getting things ready…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<PinkyHome />} />
          <Route path="/menu" element={<GuestWindowPage />} />
          <Route path="/combos" element={<Navigate to="/menu" replace />} />
          <Route path="/reserve" element={<PinkyReservation />} />
          <Route path="/reserve/manage/:id" element={<ManageReservation />} />
          <Route
            path="/staff/workspace"
            element={
              <RequireAuth>
                <StaffWorkspace />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/staff" element={<LoginPage />} />
          <Route
            path="/admin/*"
            element={
              <RequireAuth>
                <AdminPortal onExit={() => navigate("/")} />
              </RequireAuth>
            }
          />
          <Route
            path="/kds"
            element={
              <StaffScreen permission="kds:read">
                <KitchenDisplaySystem
                  onExit={() => navigate("/staff/workspace")}
                />
              </StaffScreen>
            }
          />
          <Route
            path="/table-ops"
            element={
              <StaffScreen permission="table:read">
                <TableOperations onExit={() => navigate("/staff/workspace")} />
              </StaffScreen>
            }
          />
          <Route
            path="/billing-ops"
            element={
              <StaffScreen permission="billing:read">
                <BillingPayments onExit={() => navigate("/staff/workspace")} />
              </StaffScreen>
            }
          />
          <Route path="/order" element={<GuestOrderPage />} />
          <Route path="/qr-order" element={<LegacyQrRedirect />} />
          <Route path="/window" element={<GuestWindowPage />} />
          <Route path="/track/:orderId" element={<GuestTrackPage />} />
          <Route path="/now-serving" element={<NowServingPage />} />
          <Route path="/vendor" element={<Navigate to="/admin" replace />} />
          <Route path="/order-tracker" element={<Navigate to="/" replace />} />
          <Route
            path="*"
            element={
              <div className="min-h-screen grid place-content-center gap-4 text-center bg-[#fff8ef]">
                <h1 className="text-3xl font-bold">
                  That page isn’t on the menu.
                </h1>
                <Link to="/" className="text-[var(--promise-berry)] underline">
                  Back to Pinky Promise
                </Link>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </CurrencyProvider>
  );
}
