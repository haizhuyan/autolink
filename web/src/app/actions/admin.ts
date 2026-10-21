"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import type { AdminFormState, AdminSite, AdminUser } from "@/lib/admin-labels";
import { requireAdmin } from "@/lib/dal";
import { SITES_TAG } from "@/lib/sites";

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const checked = (form: FormData, key: string) => form.get(key) === "on";

/** 把 pydantic 的英文校验信息转成简短中文 */
function translate(msg: string) {
  const max = msg.match(/at most (\d+) (character|item)/);
  if (max) return `最多 ${max[1]} 个${max[2] === "item" ? "条目" : "字符"}`;
  const min = msg.match(/at least (\d+) character/);
  if (min) return `至少 ${min[1]} 个字符`;
  if (/http\(s\) URL/.test(msg)) return "需要以 http:// 或 https:// 开头的网址";
  if (/invalid domain/.test(msg)) return "域名格式不正确，例如 example.com";
  if (/invalid email/.test(msg)) return "邮箱格式不正确";
  if (/Input should be/.test(msg)) return "取值无效";
  return "格式不正确";
}

/** 统一处理后端错误；未知异常（如后端未启动）给出通用提示 */
function toState(err: unknown): AdminFormState {
  if (err instanceof ApiError) {
    if (err.status === 401) redirect("/login?expired=1");
    if (err.status === 422) {
      const errors = Object.fromEntries(
        Object.entries(err.fieldErrors()).map(([k, msgs]) => [k, msgs.map(translate)]),
      );
      return { errors, message: "请检查标红的字段。" };
    }
    if (typeof err.detail === "string") return { message: err.detail };
    return { message: `操作失败（${err.status}）` };
  }
  console.error(err);
  return { message: "后台服务暂时不可用，请稍后再试。" };
}

// ---------- 站点 ----------

function siteBody(form: FormData) {
  return {
    domain: text(form, "domain"),
    submitUrl: text(form, "submitUrl"),
    category: text(form, "category"),
    pricing: text(form, "pricing"),
    loginMethod: text(form, "loginMethod"),
    requiresBacklink: checked(form, "requiresBacklink"),
    requiresVerification: checked(form, "requiresVerification"),
    supportsLaunch: checked(form, "supportsLaunch"),
    submitMode: text(form, "submitMode"),
    status: text(form, "status"),
    adminNote: text(form, "adminNote"),
  };
}

export async function saveSite(siteId: number | null, _prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const { token } = await requireAdmin();
  const body = siteBody(form);
  let site: AdminSite;
  try {
    site = siteId
      ? await apiFetch<AdminSite>(`/admin/sites/${siteId}`, { method: "PATCH", token, json: body })
      : await apiFetch<AdminSite>("/admin/sites", { method: "POST", token, json: body });
  } catch (err) {
    return { ...toState(err), values: body };
  }
  // 公开站点库与控制台站点库立即使用新数据
  updateTag(SITES_TAG);
  if (!siteId) redirect(`/admin/sites/${site.id}`);
  // 重新渲染当前页，让表单默认值与保存后的数据一致（表单提交后会重置为默认值）
  refresh();
  return { ok: true, message: "已保存。" };
}

/** backToList：在编辑页删除后回到列表；在列表中删除则原地刷新 */
export async function deleteSite(siteId: number, backToList: boolean): Promise<AdminFormState> {
  const { token } = await requireAdmin();
  try {
    await apiFetch<void>(`/admin/sites/${siteId}`, { method: "DELETE", token });
  } catch (err) {
    return toState(err);
  }
  updateTag(SITES_TAG);
  if (backToList) redirect("/admin/sites");
  refresh();
  return { ok: true, message: "已删除。" };
}

// ---------- 用户 ----------

export async function saveUser(userId: number | null, _prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const { token } = await requireAdmin();
  const password = typeof form.get("password") === "string" ? (form.get("password") as string) : "";
  const values = {
    email: text(form, "email"),
    name: text(form, "name"),
    role: text(form, "role"),
    planId: text(form, "planId"),
    status: text(form, "status"),
  };
  let user: AdminUser;
  try {
    if (userId) {
      user = await apiFetch<AdminUser>(`/admin/users/${userId}`, {
        method: "PATCH",
        token,
        json: {
          name: values.name,
          role: values.role,
          planId: values.planId,
          status: values.status,
          password: password || undefined,
          unlock: checked(form, "unlock"),
        },
      });
    } else {
      user = await apiFetch<AdminUser>("/admin/users", {
        method: "POST",
        token,
        json: { email: values.email, name: values.name, password, role: values.role, planId: values.planId },
      });
    }
  } catch (err) {
    return { ...toState(err), values };
  }
  if (!userId) redirect(`/admin/users/${user.id}`);
  refresh();
  return { ok: true, message: password ? "已保存，新密码已生效，该用户需重新登录。" : "已保存。" };
}
