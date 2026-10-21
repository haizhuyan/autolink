import { CheckCircle, Clock, HandPointing, Minus, Prohibit, XCircle } from "@phosphor-icons/react/ssr";

export const LISTING_STATUSES = ["not_submitted", "needs_manual", "in_review", "listed", "rejected", "timed_out"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

const config: Record<ListingStatus, { label: string; className: string; Icon: typeof CheckCircle }> = {
  needs_manual: { label: "待人工接管", className: "border-info-text/40 bg-info-text/10 text-info-text", Icon: HandPointing },
  listed: { label: "已收录", className: "border-success/30 bg-success/10 text-success", Icon: CheckCircle },
  in_review: { label: "审核中", className: "border-warn/40 bg-warn/10 text-warn-text", Icon: Clock },
  rejected: { label: "被拒", className: "border-danger/50 bg-danger/10 text-danger-text", Icon: XCircle },
  timed_out: { label: "已超时", className: "border-line bg-raised text-muted", Icon: Prohibit },
  not_submitted: { label: "未提交", className: "border-line text-muted", Icon: Minus },
};

export function listingLabel(status: ListingStatus) {
  return config[status].label;
}

export function ListingBadge({ status }: { status: ListingStatus }) {
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
