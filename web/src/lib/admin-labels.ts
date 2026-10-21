import type { Role } from "./definitions";
import type { PlanId } from "./plans";
import type { LoginMethod, Pricing, SubmitMode } from "./site-labels";

export const ROLES = ["user", "admin"] as const satisfies readonly Role[];
export const USER_STATUSES = ["active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const PLAN_IDS = ["free", "basic", "pro", "max"] as const satisfies readonly PlanId[];

export const SITE_STATUSES = ["active", "needs_review", "dead", "blacklisted"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const roleLabel: Record<Role, string> = { user: "普通用户", admin: "管理员" };
export const userStatusLabel: Record<UserStatus, string> = { active: "正常", disabled: "已停用" };

export const siteStatusLabel: Record<SiteStatus, string> = {
  active: "正常",
  needs_review: "待复核",
  dead: "已失效",
  blacklisted: "黑名单",
};

export const siteStatusTone: Record<SiteStatus, string> = {
  active: "bg-success/10 text-success",
  needs_review: "bg-warn/10 text-warn-text",
  dead: "bg-raised text-muted",
  blacklisted: "bg-danger/10 text-danger-text",
};

export type AdminSite = {
  id: number;
  domain: string;
  name: string;
  submitUrl: string;
  category: string;
  pricing: Pricing;
  loginMethod: LoginMethod;
  requiresBacklink: boolean;
  requiresVerification: boolean;
  supportsLaunch: boolean;
  reviewTimeHint: string;
  submitMode: SubmitMode;
  status: SiteStatus;
  problems: string;
  adminNote: string;
  submitted: number;
  listed: number;
  inReview: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  planId: PlanId;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  productCount: number;
  lockedUntil: string | null;
};

export type AdminProduct = {
  id: string;
  name: string;
  url: string;
  category: string;
  ownerId: number;
  ownerEmail: string;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: number;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type AdminStats = {
  users: Record<string, number>;
  plans: Record<string, number>;
  products: number;
  sites: Record<string, number>;
  siteModes: Record<string, number>;
  submissions: Record<string, number>;
  recent: AuditEntry[];
};

export type ApiPage<T> = { items: T[]; total: number; page: number; pageSize: number };

/** 后台表单 Server Action 的返回状态；values 用于出错时回填（不含密码） */
export type AdminFormState =
  | {
      ok?: boolean;
      message?: string;
      errors?: Record<string, string[]>;
      values?: Record<string, string | boolean>;
    }
  | undefined;

/** 后端返回 UTC 时间（SQLite 下可能不带时区），统一按 UTC 解析 */
function parseTime(value: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

export function formatTime(value: string | null) {
  if (!value) return "—";
  return parseTime(value).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

export function isLocked(user: Pick<AdminUser, "lockedUntil">) {
  return user.lockedUntil !== null && parseTime(user.lockedUntil).getTime() > Date.now();
}
