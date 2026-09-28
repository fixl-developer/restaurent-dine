import { Check } from "lucide-react";
export default function FlowSteps({
  steps,
  current,
  label,
}: {
  steps: string[];
  current: number;
  label: string;
}) {
  return (
    <ol className="flow-steps" aria-label={label}>
      {steps.map((step, i) => (
        <li
          key={step}
          className={i < current ? "complete" : i === current ? "current" : ""}
          aria-current={i === current ? "step" : undefined}
        >
          <span aria-hidden="true">
            {i < current ? <Check size={13} /> : i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}
