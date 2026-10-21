import type { ReactNode } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { btnSecondary } from "@/components/button-styles";

export const inputClass =
  "block w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm text-fg placeholder:text-muted/70 transition-colors duration-200 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent aria-invalid:border-danger";

export const thClass = "px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted";
export const tdClass = "px-3 py-2.5 align-top";

export function PageHeader({ title, desc, actions }: { title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = "bg-raised text-muted" }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}>
      {children}
    </span>
  );
}

/** GET 表单筛选：提交后改变 URL 查询参数，页码自动回到第 1 页 */
export function FilterBar({ action, q, placeholder, children }: {
  action: string;
  q: string;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-card p-3">
      <label className="min-w-56 flex-1">
        <span className="sr-only">搜索</span>
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} maxLength={100} className={inputClass} />
      </label>
      {children}
      <button type="submit" className={btnSecondary}>
        <MagnifyingGlass size={16} aria-hidden />
        筛选
      </button>
    </form>
  );
}

export function FilterSelect({ name, label, value, options }: {
  name: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value} className={`${inputClass} w-auto`} aria-label={label}>
        <option value="">{label}：全部</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Table({ head, children, empty, colSpan }: {
  head: ReactNode;
  children: ReactNode[];
  empty: string;
  colSpan: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-surface">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {children.length ? (
            children
          ) : (
            <tr>
              <td colSpan={colSpan} className="px-3 py-10 text-center text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton() {
  return <div aria-hidden className="h-96 animate-pulse rounded-lg border border-line bg-card" />;
}

export const labelClass = "mb-1.5 block text-sm font-medium";

export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1 text-sm text-danger-text">
      {errors.join("；")}
    </p>
  );
}

export function FormNotice({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-md border px-3 py-2 text-sm ${
        ok ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger-text"
      }`}
    >
      {message}
    </p>
  );
}
