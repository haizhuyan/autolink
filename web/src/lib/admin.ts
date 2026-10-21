import "server-only";
import { notFound } from "next/navigation";
import { ApiError, apiFetch } from "./api";
import type { AdminProduct, AdminSite, AdminStats, AdminUser, ApiPage, AuditEntry } from "./admin-labels";
import { requireAdmin } from "./dal";

type Query = Record<string, string | number | undefined>;

async function adminGet<T>(path: string, query?: Query): Promise<T> {
  const { token } = await requireAdmin();
  try {
    return await apiFetch<T>(`/admin${path}`, { token, query });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export const PAGE_SIZE = 20;

export const getAdminStats = () => adminGet<AdminStats>("/stats");

export const listAdminUsers = (query: { q: string; role: string; status: string; page: number }) =>
  adminGet<ApiPage<AdminUser>>("/users", { ...query, pageSize: PAGE_SIZE });

export const getAdminUser = (id: number) => adminGet<AdminUser>(`/users/${id}`);

export const listAdminProducts = (query: { q: string; page: number }) =>
  adminGet<ApiPage<AdminProduct>>("/products", { ...query, pageSize: PAGE_SIZE });

export const listAdminSites = (query: { q: string; status: string; mode: string; page: number }) =>
  adminGet<ApiPage<AdminSite>>("/sites", { ...query, pageSize: PAGE_SIZE });

export const getAdminSite = (id: number) => adminGet<AdminSite>(`/sites/${id}`);

export const listAudit = (query: { action: string; page: number }) =>
  adminGet<ApiPage<AuditEntry>>("/audit", { ...query, pageSize: 50 });

type RawParams = Record<string, string | string[] | undefined>;

/** 读取单个查询参数，限制长度；只接受白名单内的取值时传 allowed */
export function param(params: RawParams, key: string, allowed?: readonly string[]) {
  const raw = params[key];
  const value = ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim().slice(0, 100);
  return allowed && !allowed.includes(value) ? "" : value;
}

export function pageParam(params: RawParams) {
  return Math.min(10_000, Math.max(1, Math.floor(Number(param(params, "page"))) || 1));
}

/** 路由里的数字 id；非法时 404 */
export function idParam(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  return id;
}

/** 保留现有筛选条件，生成分页链接 */
export function pageHref(base: string, filters: Record<string, string>) {
  return (page: number) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
}
