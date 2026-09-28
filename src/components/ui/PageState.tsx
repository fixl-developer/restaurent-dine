import { Coffee, CircleAlert, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export default function PageState({
  title,
  description,
  kind = "empty",
  action,
}: {
  title: string;
  description?: string;
  kind?: "empty" | "error" | "loading";
  action?: ReactNode;
}) {
  const Icon =
    kind === "error" ? CircleAlert : kind === "loading" ? Loader2 : Coffee;
  return (
    <div
      className={`promise-state promise-state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span className="promise-state-icon">
        <Icon size={26} className={kind === "loading" ? "animate-spin" : ""} />
      </span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="promise-state-actions">{action}</div>}
    </div>
  );
}
