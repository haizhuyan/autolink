import {
  CheckCircle,
  CircleNotch,
  Clock,
  HandPointing,
  XCircle,
} from "@phosphor-icons/react/ssr";

export type SubmissionStatus = "success" | "failed" | "manual" | "queued" | "running";

const config: Record<
  SubmissionStatus,
  { label: string; className: string; Icon: typeof CheckCircle }
> = {
  success: { label: "成功", className: "border-success/30 bg-success/10 text-success", Icon: CheckCircle },
  running: { label: "运行中", className: "border-accent/30 bg-accent/10 text-accent-text", Icon: CircleNotch },
  failed: { label: "失败", className: "border-danger/50 bg-danger/10 text-danger-text", Icon: XCircle },
  manual: { label: "待接管", className: "border-info-text/40 bg-info-text/10 text-info-text", Icon: HandPointing },
  queued: { label: "排队中", className: "border-warn/40 bg-warn/10 text-warn-text", Icon: Clock },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const { label, className, Icon } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon size={14} weight="bold" aria-hidden />
      {label}
    </span>
  );
}
