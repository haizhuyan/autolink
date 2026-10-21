import "server-only";
import { ApiError, apiFetch } from "./api";
import type { Role, SessionUser } from "./definitions";
import type { PlanId } from "./plans";

export type ApiUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  planId: PlanId;
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt: string | null;
};

export type AuthResult = { user: SessionUser } | { error: "invalid" | "locked" };

/** 调用后端校验账号密码；密码哈希、失败计数与锁定都在后端完成。 */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await apiFetch<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      json: { email, password },
    });
    return { user: { id: String(res.user.id), email: res.user.email, role: res.user.role, token: res.token } };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { error: "invalid" };
    if (err instanceof ApiError && err.status === 429) return { error: "locked" };
    throw err;
  }
}
