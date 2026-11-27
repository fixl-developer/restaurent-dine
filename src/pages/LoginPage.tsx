import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  Heart,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useStaffLogin, useStaffVerify2fa } from "@/hooks/useAuth";
import Brand from "@/components/ui/Brand";

// Local demo accounts — only rendered in development (never in a production build).
const DEMO_ACCOUNTS: { role: string; email: string; password: string }[] = [
  { role: "Owner", email: "owner@pinky.local", password: "PinkyLocal-1Yu536rFGEZq" },
  { role: "Manager", email: "manager@pinky.local", password: "PinkyStaff@2026" },
  { role: "Cashier", email: "cashier@pinky.local", password: "PinkyStaff@2026" },
  { role: "Accountant", email: "accountant@pinky.local", password: "PinkyStaff@2026" },
  { role: "Inventory", email: "inventory@pinky.local", password: "PinkyStaff@2026" },
  { role: "Host", email: "host@pinky.local", password: "PinkyStaff@2026" },
  { role: "Read Only", email: "readonly@pinky.local", password: "PinkyStaff@2026" },
  { role: "Waiter", email: "waiter@pinky.local", password: "PinkyStaff@2026" },
  { role: "Kitchen", email: "kitchen@pinky.local", password: "PinkyStaff@2026" },
  { role: "Expo", email: "expo@pinky.local", password: "PinkyStaff@2026" },
  { role: "Driver", email: "driver@pinky.local", password: "PinkyStaff@2026" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useStaffLogin();
  const verify = useStaffVerify2fa();
  const [visible, setVisible] = useState(false);
  const [mfa, setMfa] = useState<{
    userId: string;
    maskedPhone: string;
  } | null>(null);
  const form = useForm<{ email: string; password: string }>({
    defaultValues: { email: "", password: "" },
  });
  const otp = useForm<{ code: string }>({ defaultValues: { code: "" } });
  useEffect(() => {
    document.title = "Staff sign in · Pinky Promise";
    if (!accessToken) return;
    const from = (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname;
    navigate(
      from &&
        /^\/(admin|kds|table-ops|billing-ops|staff\/workspace)(\/|$)/.test(from)
        ? from
        : "/staff/workspace",
      { replace: true },
    );
  }, [accessToken, navigate, location.state]);
  const field =
    "w-full pl-11 pr-12 py-3 text-sm rounded-xl border border-[#dcd0d0] bg-white";
  const doLogin = (values: { email: string; password: string }) =>
    login.mutate(values, {
      onSuccess: (data) => {
        if (data.mfaRequired)
          setMfa({ userId: data.userId, maskedPhone: data.maskedPhone });
      },
    });
  const fillAndLogin = (account: { email: string; password: string }) => {
    form.setValue("email", account.email);
    form.setValue("password", account.password);
    doLogin(account);
  };
  return (
    <div className="login-page">
      <aside className="login-story">
        <Brand />
        <div>
          <span className="ui-eyebrow">A LITTLE EXTRA HEART</span>
          <h2>
            Good days start
            <br />
            with a <em>great team.</em>
          </h2>
          <p>
            Behind every favorite order and happy guest is a little care from
            you.
          </p>
        </div>
        <div className="login-art">
          <img
            src="/brand/logo.png"
            alt="Pinky Promise Café & Restaurant"
            width="280"
            height="224"
          />
        </div>
        <p className="flex gap-2 items-center">
          <Heart size={15} />
          Made with care. Served with a smile.
        </p>
      </aside>
      <main className="login-panel">
        <div>
          <div className="login-mobile-brand">
            <Brand />
          </div>
          <span className="ui-eyebrow">STAFF PORTAL</span>
          <h1>{mfa ? "One more little step." : "Welcome back."}</h1>
          <p className="text-sm text-[#79666e] leading-7 mb-8">
            {mfa
              ? `Enter the verification code sent to ${mfa.maskedPhone}.`
              : "Sign in to your Pinky Promise workspace."}
          </p>
          {!mfa ? (
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(doLogin)}
            >
              <div>
                <label
                  htmlFor="staff-email"
                  className="block font-semibold mb-2"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-4 top-4 text-[#927982]"
                  />
                  <input
                    id="staff-email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    placeholder="you@example.com"
                    className={field}
                    aria-invalid={!!form.formState.errors.email}
                    aria-describedby={
                      form.formState.errors.email ? "email-error" : undefined
                    }
                    {...form.register("email", {
                      required: "Enter your email address",
                    })}
                  />
                </div>
                {form.formState.errors.email && (
                  <p id="email-error" className="text-xs text-red-700 mt-2">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="staff-password"
                  className="block font-semibold mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={17}
                    className="absolute left-4 top-4 text-[#927982]"
                  />
                  <input
                    id="staff-password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Your password"
                    className={field}
                    aria-invalid={!!form.formState.errors.password}
                    aria-describedby={
                      form.formState.errors.password
                        ? "password-error"
                        : undefined
                    }
                    {...form.register("password", {
                      required: "Enter your password",
                      minLength: {
                        value: 8,
                        message: "Use at least 8 characters",
                      },
                    })}
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 w-10 h-10 grid place-items-center text-[#79666e]"
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    onClick={() => setVisible((v) => !v)}
                  >
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p id="password-error" className="text-xs text-red-700 mt-2">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              {Boolean(login.error) && (
                <p
                  role="alert"
                  className="rounded-xl p-3 text-sm text-red-800 bg-red-50"
                >
                  {login.error instanceof Error
                    ? login.error.message
                    : "We couldn’t sign you in. Please try again."}
                </p>
              )}
              <button
                type="submit"
                disabled={login.isPending}
                className="ui-button ui-button-primary w-full"
              >
                {login.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight size={16} />
                  </>
                )}
              </button>
              <p className="text-xs text-[#79666e] text-center leading-6">
                Need access or a password reset? Ask your restaurant manager.
              </p>
            </form>
          ) : (
            <form
              className="space-y-5"
              onSubmit={otp.handleSubmit((values) =>
                verify.mutate({ userId: mfa.userId, code: values.code }),
              )}
            >
              <div>
                <label
                  htmlFor="staff-code"
                  className="block font-semibold mb-2"
                >
                  Verification code
                </label>
                <div className="relative">
                  <ShieldCheck
                    size={17}
                    className="absolute left-4 top-4 text-[#927982]"
                  />
                  <input
                    id="staff-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={8}
                    className={field}
                    {...otp.register("code", {
                      required: "Enter the code",
                      pattern: {
                        value: /^\d{4,8}$/,
                        message: "Enter the 4–8 digit code",
                      },
                    })}
                  />
                </div>
                {otp.formState.errors.code && (
                  <p className="text-xs text-red-700 mt-2">
                    {otp.formState.errors.code.message}
                  </p>
                )}
              </div>
              {Boolean(verify.error) && (
                <p
                  role="alert"
                  className="rounded-xl p-3 text-sm text-red-800 bg-red-50"
                >
                  {verify.error instanceof Error
                    ? verify.error.message
                    : "We couldn’t verify that code. Please try again."}
                </p>
              )}
              <button
                type="submit"
                disabled={verify.isPending}
                className="ui-button ui-button-primary w-full"
              >
                {verify.isPending ? "Verifying…" : "Verify & continue"}
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="ui-button w-full"
                onClick={() => {
                  setMfa(null);
                  otp.reset();
                  verify.reset();
                }}
              >
                Use a different account
              </button>
            </form>
          )}
          {!mfa && (import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGINS === "true") && (
            <div className="mt-6 rounded-xl border border-dashed border-[#e0b3c2] bg-[#fdf3f6] p-3">
              <p className="text-[11px] font-semibold text-[var(--promise-berry)] mb-2">
                Demo accounts (dev only) — click to sign in as a role
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    disabled={login.isPending}
                    onClick={() => fillAndLogin(account)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-[#e6cdd6] bg-white text-[#79666e] hover:border-brand-400 hover:text-[var(--promise-berry)] disabled:opacity-50 transition-colors"
                  >
                    {account.role}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-[#eadbdc] mt-8 pt-6 flex justify-between text-xs text-[#79666e]">
            <Link to="/">← Back to the café</Link>
            <span>Staff access only</span>
          </div>
        </div>
      </main>
    </div>
  );
}
