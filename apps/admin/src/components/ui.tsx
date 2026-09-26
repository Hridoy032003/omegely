import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>;
}

export function PanelHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export type Tone = "neutral" | "positive" | "caution" | "critical" | "brand";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={tone === "neutral" ? "badge" : `badge badge--${tone}`}>{children}</span>;
}

/** Shared status vocabulary across reports and feedback. */
export function statusTone(status: string): Tone {
  if (status === "resolved") return "positive";
  if (status === "dismissed") return "neutral";
  if (status === "reviewing") return "caution";
  return "critical";
}

export function Kpi({
  label,
  value,
  hint,
  icon,
  alert = false,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={alert ? "kpi kpi--alert" : "kpi"}>
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <strong className="mono">{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-cell">
        {text}
      </td>
    </tr>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function formatCoins(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function initial(value: string | null | undefined, fallback = "U") {
  return (value || fallback).trim().slice(0, 1).toUpperCase();
}
