import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ApiError, apiFetch } from "./api";
import type { ApiUser } from "./auth";
import { getSession } from "./session";

export type CurrentUser = Omit<ApiUser, "id"> & { id: string; token: string };

/** 已过期的会话交给 proxy 清理 cookie 后再去登录页，避免 /login 与 /dashboard 互相重定向 */
const EXPIRED = "/login?expired=1";

/**
 * 读取会话并向后端确认账号仍有效（停用、改密后立即失效）；
 * 必须在 <Suspense> 内调用（cacheComponents 要求）。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // JWT 过期校验依赖当前时间，只能在真实请求中进行，不能进入运行时预取
  await connection();
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    const user = await apiFetch<ApiUser>("/auth/me", { token: session.token });
    return { ...user, id: String(user.id), token: session.token };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect(EXPIRED);
    throw err;
  }
});

/** 非管理员访问后台时返回 404，不暴露后台入口 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role !== "admin") notFound();
  return user;
}
