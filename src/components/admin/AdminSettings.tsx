import { useAuthStore } from "@/stores/auth.store";
import { Can } from "@/components/auth/Can";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Store,
  FileText,
  Clock,
  Globe,
  CreditCard,
  Printer,
  Palette,
  Check,
  AlertCircle,
  ToggleRight,
  ToggleLeft,
  ChevronRight,
  Loader2,
  DollarSign,
} from "lucide-react";
import {
  useRestaurant,
  useUpdateRestaurant,
  useUploadLogo,
} from "@/hooks/useRestaurant";
import {
  DAY_NAMES,
  RestaurantPatch,
  RestaurantDto,
} from "@/lib/dto/restaurant";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";

type SettingsSection =
  | "profile"
  | "branding"
  | "gst"
  | "hours"
  | "languages"
  | "payments"
  | "receipt"
  | "currency";

const NAV: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Restaurant Profile", icon: Store },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "currency", label: "Currency", icon: DollarSign },
  { id: "gst", label: "Sales tax & service", icon: FileText },
  { id: "hours", label: "Opening Hours", icon: Clock },
  { id: "languages", label: "Languages", icon: Globe },
  { id: "payments", label: "Payment Methods", icon: CreditCard },
  { id: "receipt", label: "Receipt Settings", icon: Printer },
];

const LANG_OPTIONS = ["en", "es", "hi", "kn", "ta", "te", "mr", "gu", "bn"];
const LANG_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  hi: "Hindi",
  kn: "Kannada",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  bn: "Bengali",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 mb-1">
      {children}
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label?: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      aria-label={label ?? placeholder}
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-400 text-gray-800"
    />
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-label={label}
      aria-checked={checked}
      type="button"
      onClick={onChange}
    >
      {checked ? (
        <ToggleRight className="w-7 h-7 text-emerald-500" />
      ) : (
        <ToggleLeft className="w-7 h-7 text-gray-300" />
      )}
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function ensureFullWeek(hours: RestaurantDto["brand"]["openingHours"]) {
  const map = new Map(hours.map((h) => [h.dayOfWeek, h]));
  return DAY_NAMES.map(
    (_, dow) =>
      map.get(dow) ?? {
        dayOfWeek: dow,
        open: "09:00",
        close: "17:00",
        isClosed: true,
      },
  );
}

interface FormState {
  brand: {
    name: string;
    contactPhone: string;
    contactEmail: string;
    address: string;
    brandColor: string;
    location: {
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    openingHours: RestaurantDto["brand"]["openingHours"];
  };
  tax: {
    gstin: string;
    taxes: RestaurantDto["tax"]["taxes"];
    serviceChargePercent: number;
    roundingRule: RestaurantDto["tax"]["roundingRule"];
    taxInclusive: boolean;
  };
  tipping: { enabled: boolean; suggestedPercents: number[]; allowCustom: boolean };
  refundPolicy: { approvalLimit: number };
  languages: { primary: string; supported: string[] };
  paymentMethods: RestaurantDto["paymentMethods"];
  operatingModes: RestaurantDto["operatingModes"];
  receipt: {
    headerLines: string[];
    footerLines: string[];
    fssaiLicense: string;
    returnPolicy: string;
    showLogo: boolean;
    showGstin: boolean;
  };
  currency: string;
  timeZone: string;
}

function buildFormFromDto(r: RestaurantDto): FormState {
  return {
    brand: {
      name: r.brand.name ?? "",
      contactPhone: r.brand.contactPhone ?? "",
      contactEmail: r.brand.contactEmail ?? "",
      address: r.brand.address ?? "",
      brandColor: r.brand.brandColor ?? "#ec4899",
      location: {
        city: r.brand.location?.city ?? "",
        state: r.brand.location?.state ?? "",
        country: r.brand.location?.country ?? "United States",
        postalCode: r.brand.location?.postalCode ?? "",
      },
      openingHours: ensureFullWeek(r.brand.openingHours ?? []),
    },
    tax: {
      gstin: r.tax.gstin ?? "",
      taxes: r.tax.taxes.map((t) => ({ ...t })),
      serviceChargePercent: r.tax.serviceChargePercent ?? 0,
      roundingRule: r.tax.roundingRule ?? "none",
      taxInclusive: r.tax.taxInclusive ?? false,
    },
    tipping: {
      enabled: r.tipping?.enabled ?? true,
      suggestedPercents: r.tipping?.suggestedPercents ?? [15, 18, 20],
      allowCustom: r.tipping?.allowCustom ?? true,
    },
    refundPolicy: {
      approvalLimit: r.refundPolicy?.approvalLimit ?? 0,
    },
    languages: {
      primary: r.languages.primary ?? "en",
      supported: r.languages.supported ?? ["en"],
    },
    paymentMethods: r.paymentMethods,
    operatingModes: r.operatingModes,
    receipt: {
      headerLines: r.receipt.headerLines ?? [],
      footerLines: r.receipt.footerLines ?? [],
      fssaiLicense: r.receipt.fssaiLicense ?? "",
      returnPolicy: r.receipt.returnPolicy ?? "",
      showLogo: r.receipt.showLogo ?? true,
      showGstin: r.receipt.showGstin ?? false,
    },
    currency: r.currency,
    timeZone: r.timeZone,
  };
}

function buildPatchFromForm(form: FormState): RestaurantPatch {
  return {
    brand: {
      name: form.brand.name,
      contactPhone: form.brand.contactPhone || undefined,
      contactEmail: form.brand.contactEmail || undefined,
      address: form.brand.address || undefined,
      brandColor: form.brand.brandColor,
      location: form.brand.location,
      openingHours: form.brand.openingHours,
    },
    tax: {
      gstin: form.tax.gstin || undefined,
      taxes: form.tax.taxes,
      serviceChargePercent: form.tax.serviceChargePercent,
      roundingRule: form.tax.roundingRule,
      taxInclusive: form.tax.taxInclusive,
    },
    tipping: {
      enabled: form.tipping.enabled,
      suggestedPercents: form.tipping.suggestedPercents,
      allowCustom: form.tipping.allowCustom,
    },
    refundPolicy: { approvalLimit: form.refundPolicy.approvalLimit },
    languages: form.languages,
    paymentMethods: form.paymentMethods,
    operatingModes: form.operatingModes,
    receipt: {
      headerLines: form.receipt.headerLines,
      footerLines: form.receipt.footerLines,
      fssaiLicense: form.receipt.fssaiLicense || undefined,
      returnPolicy: form.receipt.returnPolicy || undefined,
      showLogo: form.receipt.showLogo,
      showGstin: form.receipt.showGstin,
    },
    currency: form.currency,
    timeZone: form.timeZone,
  };
}

export default function AdminSettings() {
  const canEdit = useAuthStore((s) => s.hasPermission("restaurant:update"));
  const [active, setActive] = useState<SettingsSection>("profile");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: restaurant, isLoading } = useRestaurant();
  const updateMutation = useUpdateRestaurant();
  const uploadMutation = useUploadLogo();

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (restaurant) setForm(buildFormFromDto(restaurant));
  }, [restaurant]);

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center h-96 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading restaurant
        settings…
      </div>
    );
  }

  const f = form;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => (s ? { ...s, [key]: value } : s));

  function handleSave() {
    updateMutation.mutate(buildPatchFromForm(f));
  }

  function handleLogoSelect(file: File | null) {
    if (file) uploadMutation.mutate(file);
  }

  function renderSection() {
    switch (active) {
      case "profile":
        return (
          <div className="space-y-5">
            <SectionCard
              title="Basic Information"
              subtitle="Public-facing restaurant details"
            >
              <Label>Restaurant Name</Label>
              <Input
                label="Restaurant Name"
                value={f.brand.name}
                onChange={(v) => update("brand", { ...f.brand, name: v })}
              />
            </SectionCard>
            <SectionCard
              title="Contact & Location"
              subtitle="Address and contact information"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Full Address</Label>
                  <Input
                    label="Full Address"
                    value={f.brand.address}
                    onChange={(v) =>
                      update("brand", { ...f.brand, address: v })
                    }
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    label="City"
                    value={f.brand.location.city}
                    onChange={(v) =>
                      update("brand", {
                        ...f.brand,
                        location: { ...f.brand.location, city: v },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    label="State"
                    value={f.brand.location.state}
                    onChange={(v) =>
                      update("brand", {
                        ...f.brand,
                        location: { ...f.brand.location, state: v },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <Input
                    label="Postal Code"
                    value={f.brand.location.postalCode}
                    onChange={(v) =>
                      update("brand", {
                        ...f.brand,
                        location: { ...f.brand.location, postalCode: v },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    label="Country"
                    value={f.brand.location.country}
                    onChange={(v) =>
                      update("brand", {
                        ...f.brand,
                        location: { ...f.brand.location, country: v },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    label="Phone"
                    value={f.brand.contactPhone}
                    onChange={(v) =>
                      update("brand", { ...f.brand, contactPhone: v })
                    }
                    placeholder="+13105550123"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    label="Email"
                    type="email"
                    value={f.brand.contactEmail}
                    onChange={(v) =>
                      update("brand", { ...f.brand, contactEmail: v })
                    }
                  />
                </div>
              </div>
            </SectionCard>
            <SectionCard
              title="Operating Modes"
              subtitle="Which channels are open right now"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ToggleRow
                  label="Dine-in"
                  checked={f.operatingModes.dineIn}
                  onChange={() =>
                    update("operatingModes", {
                      ...f.operatingModes,
                      dineIn: !f.operatingModes.dineIn,
                    })
                  }
                />
                <ToggleRow
                  label="Takeaway"
                  checked={f.operatingModes.takeaway}
                  onChange={() =>
                    update("operatingModes", {
                      ...f.operatingModes,
                      takeaway: !f.operatingModes.takeaway,
                    })
                  }
                />
                <ToggleRow
                  label="Online Prepay"
                  checked={f.operatingModes.onlinePrepay}
                  onChange={() =>
                    update("operatingModes", {
                      ...f.operatingModes,
                      onlinePrepay: !f.operatingModes.onlinePrepay,
                    })
                  }
                />
              </div>
            </SectionCard>
          </div>
        );

      case "branding":
        return (
          <div className="space-y-5">
            <SectionCard
              title="Logo"
              subtitle="Upload your restaurant logo (Cloudinary)"
            >
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                  {restaurant?.brand.logoUrl ? (
                    <img
                      src={restaurant.brand.logoUrl}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-10 h-10 text-gray-300" />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) =>
                      handleLogoSelect(e.target.files?.[0] ?? null)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    className="px-4 py-2 bg-[var(--promise-berry)] text-white rounded-xl text-sm font-medium hover:bg-[var(--promise-berry-dark)] disabled:bg-brand-200 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                  >
                    {uploadMutation.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {uploadMutation.isPending
                      ? "Uploading…"
                      : restaurant?.brand.logoUrl
                        ? "Replace Logo"
                        : "Upload Logo"}
                  </button>
                  <p className="text-xs text-gray-500">
                    PNG / JPG / SVG / WebP. Recommended 512×512px.
                  </p>
                </div>
              </div>
            </SectionCard>
            <SectionCard
              title="Brand Color"
              subtitle="Used as accent across the platform and receipts"
            >
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={f.brand.brandColor}
                  onChange={(e) =>
                    update("brand", { ...f.brand, brandColor: e.target.value })
                  }
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                />
                <Input
                  label="Primary Color"
                  value={f.brand.brandColor}
                  onChange={(v) =>
                    update("brand", { ...f.brand, brandColor: v })
                  }
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[
                  "#ec4899",
                  "#8b5cf6",
                  "#10b981",
                  "#f59e0b",
                  "#3b82f6",
                  "#ef4444",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      update("brand", { ...f.brand, brandColor: c })
                    }
                    className={`w-7 h-7 rounded-full border-2 transition-all ${f.brand.brandColor === c ? "border-gray-700 scale-110" : "border-white"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </SectionCard>
          </div>
        );

      case "currency":
        return (
          <SectionCard
            title="Currency Settings"
            subtitle="Choose the currency for all pricing, payments, and reports"
          >
            <div className="space-y-5">
              <div>
                <Label>Restaurant Currency</Label>
                <select
                  value={f.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-400"
                >
                  {Object.entries(SUPPORTED_CURRENCIES).map(
                    ([code, { symbol, name }]) => (
                      <option key={code} value={code}>
                        {code} • {symbol} • {name}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">
                    💡 This change will affect:
                  </p>
                  <ul className="text-xs space-y-1 ml-2 list-disc">
                    <li>All menu prices across guest & staff apps</li>
                    <li>Order totals and billing calculations</li>
                    <li>Reports and financial records</li>
                    <li>All users and roles in your restaurant</li>
                  </ul>
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> Changing currency doesn't convert
                  existing prices. You may need to manually update menu items if
                  switching to a significantly different value currency.
                </p>
              </div>
            </div>
          </SectionCard>
        );

      case "gst":
        return (
          <SectionCard
            title="Sales tax & service charge"
            subtitle="Enter the restaurant’s approved rates and pricing policy. All configured taxes are preserved when other settings are saved."
          >
            <div className="space-y-4">
              {f.tax.taxes.map((tax, i) => (
                <div
                  key={i}
                  className="grid sm:grid-cols-4 gap-3 border rounded-xl p-3"
                >
                  <div>
                    <Label>Tax name</Label>
                    <Input
                      label="Tax name"
                      value={tax.name}
                      onChange={(v) =>
                        update("tax", {
                          ...f.tax,
                          taxes: f.tax.taxes.map((t, j) =>
                            j === i ? { ...t, name: v } : t,
                          ),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Rate (%)</Label>
                    <Input
                      label="Rate (%)"
                      type="number"
                      value={tax.rate}
                      onChange={(v) =>
                        update("tax", {
                          ...f.tax,
                          taxes: f.tax.taxes.map((t, j) =>
                            j === i ? { ...t, rate: Number(v) } : t,
                          ),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <p className="text-sm py-3">
                      {tax.type === "other"
                        ? "Sales tax"
                        : tax.type.toUpperCase()}
                    </p>
                  </div>
                  <button
                    className="text-sm underline self-end p-3"
                    onClick={() =>
                      update("tax", {
                        ...f.tax,
                        taxes: f.tax.taxes.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove tax
                  </button>
                </div>
              ))}
              <button
                className="text-sm text-brand-700 underline"
                onClick={() =>
                  update("tax", {
                    ...f.tax,
                    taxes: [
                      ...f.tax.taxes,
                      {
                        name: "Sales tax",
                        rate: 0,
                        type: "other",
                        applyOn: "subtotal",
                      },
                    ],
                  })
                }
              >
                Add tax rate
              </button>
              <p className="text-xs text-gray-600">
                A zero rate must be configured explicitly if applicable. Item
                exemptions and channel-specific tax rules need operational
                review.
              </p>
              <div>
                <Label>Service charge (%)</Label>
                <Input
                  label="Service charge (%)"
                  type="number"
                  value={f.tax.serviceChargePercent}
                  onChange={(v) =>
                    update("tax", { ...f.tax, serviceChargePercent: Number(v) })
                  }
                />
              </div>
              <div>
                <Label>Rounding</Label>
                <select
                  className="border rounded-xl p-3 w-full"
                  value={f.tax.roundingRule}
                  onChange={(e) =>
                    update("tax", {
                      ...f.tax,
                      roundingRule: e.target
                        .value as FormState["tax"]["roundingRule"],
                    })
                  }
                >
                  <option value="none">
                    Currency precision · no extra rounding
                  </option>
                  {f.currency === "INR" && (
                    <>
                      <option value="nearest_rupee">
                        Nearest rupee (legacy)
                      </option>
                      <option value="nearest_50_paise">
                        Nearest 50 paise (legacy)
                      </option>
                    </>
                  )}
                </select>
              </div>
              <ToggleRow
                label="Tax-inclusive prices"
                sub="Menu prices already include the configured tax"
                checked={f.tax.taxInclusive}
                onChange={() =>
                  update("tax", { ...f.tax, taxInclusive: !f.tax.taxInclusive })
                }
              />

              <div className="pt-4 mt-2 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">
                  Tipping
                </h4>
                <ToggleRow
                  label="Enable guest tipping"
                  sub="Show tip options at guest card checkout"
                  checked={f.tipping.enabled}
                  onChange={() =>
                    update("tipping", {
                      ...f.tipping,
                      enabled: !f.tipping.enabled,
                    })
                  }
                />
                {f.tipping.enabled && (
                  <>
                    <div className="mt-3">
                      <Label>Suggested tip percentages</Label>
                      <Input
                        label="Suggested tip percentages"
                        value={f.tipping.suggestedPercents.join(", ")}
                        placeholder="15, 18, 20"
                        onChange={(v) =>
                          update("tipping", {
                            ...f.tipping,
                            suggestedPercents: v
                              .split(",")
                              .map((s) => parseInt(s.trim(), 10))
                              .filter(
                                (n) => Number.isFinite(n) && n >= 0 && n <= 100,
                              ),
                          })
                        }
                      />
                    </div>
                    <ToggleRow
                      label="Allow a custom tip amount"
                      sub="Let guests enter their own tip"
                      checked={f.tipping.allowCustom}
                      onChange={() =>
                        update("tipping", {
                          ...f.tipping,
                          allowCustom: !f.tipping.allowCustom,
                        })
                      }
                    />
                  </>
                )}
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">
                  Refund approval
                </h4>
                <Label>Approval limit ({f.currency})</Label>
                <Input
                  label="Refund approval limit"
                  type="number"
                  value={f.refundPolicy.approvalLimit}
                  onChange={(v) =>
                    update("refundPolicy", { approvalLimit: Number(v) })
                  }
                />
                <p className="text-xs text-gray-600 mt-1">
                  Refunds above this amount require a manager with the
                  refund-approval permission. Set 0 to disable the cap.
                </p>
              </div>
            </div>
          </SectionCard>
        );

      case "hours":
        return (
          <SectionCard
            title="Opening Hours"
            subtitle="Set operating hours for each day of the week"
          >
            <div className="space-y-3">
              {f.brand.openingHours.map((h, i) => (
                <div
                  key={h.dayOfWeek}
                  className="flex flex-wrap items-center gap-4"
                >
                  <p className="text-sm font-medium text-gray-700 w-24 shrink-0">
                    {DAY_NAMES[h.dayOfWeek]}
                  </p>
                  <Toggle
                    label={`${DAY_NAMES[h.dayOfWeek]} open`}
                    checked={!h.isClosed}
                    onChange={() => {
                      const next = [...f.brand.openingHours];
                      next[i] = { ...h, isClosed: !h.isClosed };
                      update("brand", { ...f.brand, openingHours: next });
                    }}
                  />
                  {h.isClosed ? (
                    <span className="text-xs text-gray-500 italic">Closed</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        aria-label={`${DAY_NAMES[h.dayOfWeek]} opening time`}
                        value={h.open}
                        onChange={(e) => {
                          const next = [...f.brand.openingHours];
                          next[i] = { ...h, open: e.target.value };
                          update("brand", { ...f.brand, openingHours: next });
                        }}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                      />
                      <span className="text-gray-500 text-sm">—</span>
                      <input
                        type="time"
                        aria-label={`${DAY_NAMES[h.dayOfWeek]} closing time`}
                        value={h.close}
                        onChange={(e) => {
                          const next = [...f.brand.openingHours];
                          next[i] = { ...h, close: e.target.value };
                          update("brand", { ...f.brand, openingHours: next });
                        }}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        );

      case "languages":
        return (
          <SectionCard
            title="Language Settings"
            subtitle="Display language across guest and staff interfaces"
          >
            <div className="space-y-5">
              <div>
                <Label>Primary Language</Label>
                <select
                  value={f.languages.primary}
                  onChange={(e) =>
                    update("languages", {
                      ...f.languages,
                      primary: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-400"
                >
                  {LANG_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {LANG_LABELS[l] ?? l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Supported Languages (Guest Menu)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {LANG_OPTIONS.map((l) => {
                    const enabled = f.languages.supported.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() =>
                          update("languages", {
                            ...f.languages,
                            supported: enabled
                              ? f.languages.supported.filter((s) => s !== l)
                              : [...f.languages.supported, l],
                          })
                        }
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${enabled ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}
                      >
                        {enabled && <Check className="w-3.5 h-3.5" />}
                        {LANG_LABELS[l] ?? l}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>
        );

      case "payments":
        return (
          <SectionCard
            title="Accepted Payment Methods"
            subtitle="Toggles propagate to the cashier billing screen"
          >
            <div className="space-y-3">
              {(
                [
                  {
                    key: "cash",
                    label: "Cash",
                    sub: "Physical currency payments",
                  },
                  {
                    key: "upi",
                    label: "UPI / QR",
                    sub: "GPay, PhonePe, Paytm, BHIM via Razorpay",
                  },
                  {
                    key: "card",
                    label: "Credit / Debit",
                    sub: "Visa, Mastercard, RuPay, Amex",
                  },
                  {
                    key: "wallet",
                    label: "Digital Wallets",
                    sub: "Paytm, Amazon Pay, Freecharge",
                  },
                  {
                    key: "onlinePrepay",
                    label: "Online Prepay",
                    sub: "Required for window/takeaway flow",
                  },
                ] as {
                  key: keyof FormState["paymentMethods"];
                  label: string;
                  sub: string;
                }[]
              ).map((m) => (
                <div
                  key={m.key}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    f.paymentMethods[m.key]
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {m.label}
                    </p>
                    <p className="text-xs text-gray-500">{m.sub}</p>
                  </div>
                  <Toggle
                    label={m.label}
                    checked={f.paymentMethods[m.key]}
                    onChange={() =>
                      update("paymentMethods", {
                        ...f.paymentMethods,
                        [m.key]: !f.paymentMethods[m.key],
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        );

      case "receipt":
        return (
          <div className="space-y-5">
            <SectionCard
              title="Receipt Header & Footer"
              subtitle="Text printed on every customer receipt"
            >
              <div className="space-y-4">
                <div>
                  <Label>Header Lines (one per line)</Label>
                  <textarea
                    rows={3}
                    value={f.receipt.headerLines.join("\n")}
                    onChange={(e) =>
                      update("receipt", {
                        ...f.receipt,
                        headerLines: e.target.value.split("\n"),
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-400 resize-none"
                  />
                </div>
                <div>
                  <Label>Footer Lines (one per line)</Label>
                  <textarea
                    rows={3}
                    value={f.receipt.footerLines.join("\n")}
                    onChange={(e) =>
                      update("receipt", {
                        ...f.receipt,
                        footerLines: e.target.value.split("\n"),
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-400 resize-none"
                  />
                </div>
                {f.currency === "INR" && (
                  <div>
                    <Label>FSSAI License (legacy)</Label>
                    <Input
                      label="FSSAI License (legacy)"
                      value={f.receipt.fssaiLicense}
                      onChange={(v) =>
                        update("receipt", { ...f.receipt, fssaiLicense: v })
                      }
                    />
                  </div>
                )}
                <div>
                  <Label>Return Policy</Label>
                  <textarea
                    rows={2}
                    value={f.receipt.returnPolicy}
                    onChange={(e) =>
                      update("receipt", {
                        ...f.receipt,
                        returnPolicy: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-400 resize-none"
                  />
                </div>
              </div>
            </SectionCard>
            <SectionCard
              title="Display Options"
              subtitle="Choose what information to show on receipts"
            >
              <div className="space-y-3">
                <ToggleRow
                  label="Show Restaurant Logo"
                  sub="Print logo at top of receipt"
                  checked={f.receipt.showLogo}
                  onChange={() =>
                    update("receipt", {
                      ...f.receipt,
                      showLogo: !f.receipt.showLogo,
                    })
                  }
                />
                {f.currency === "INR" && (
                  <ToggleRow
                    label="Show GSTIN"
                    sub="Display GSTIN line on the receipt"
                    checked={f.receipt.showGstin}
                    onChange={() =>
                      update("receipt", {
                        ...f.receipt,
                        showGstin: !f.receipt.showGstin,
                      })
                    }
                  />
                )}
              </div>
            </SectionCard>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="module-layout module-settings">
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="px-4 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Restaurant configuration
          </p>
        </div>
        <nav className="p-2 flex-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setActive(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5 ${active === n.id ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <n.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{n.label}</span>
              {active === n.id && (
                <ChevronRight className="w-3.5 h-3.5 text-brand-400" />
              )}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-5">
          <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
            {!canEdit && (
              <p className="text-sm text-[#086874] bg-[#e5efed] p-3 rounded-xl">
                View-only access. Ask your manager to change restaurant
                settings.
              </p>
            )}
            {renderSection()}
          </fieldset>

          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm sticky bottom-0">
            <p className="text-xs text-gray-500">
              Review your changes, then save.
            </p>
            <Can perm="restaurant:update">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${updateMutation.isSuccess ? "bg-emerald-600 text-white" : "bg-[var(--promise-berry)] text-white hover:bg-[var(--promise-berry-dark)] disabled:bg-brand-200"}`}
              >
                {updateMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {updateMutation.isPending ? (
                  "Saving…"
                ) : updateMutation.isSuccess ? (
                  <>
                    <Check className="w-4 h-4" /> Saved
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </Can>
          </div>
        </div>
      </div>
    </div>
  );
}
