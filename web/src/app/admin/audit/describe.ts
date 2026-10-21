import type { AuditEntry } from "@/lib/admin-labels";

export const auditActionLabel: Record<string, string> = {
  "user.create": "创建用户",
  "user.update": "修改用户",
  "user.locked": "账号被锁定",
  "product.create": "创建产品",
  "product.update": "修改产品",
  "product.import": "导入产品",
  "site.create": "新增站点",
  "site.update": "修改站点",
  "site.seed": "导入站点种子",
};

/** 一行可读描述：动作 + 目标 */
export function describeAudit(a: AuditEntry) {
  const label = auditActionLabel[a.action] ?? a.action;
  const d = a.detail;
  const target =
    typeof d.domain === "string"
      ? d.domain
      : typeof d.email === "string"
        ? d.email
        : typeof d.name === "string"
          ? d.name
          : a.targetId === "*"
            ? ""
            : `${a.targetType} #${a.targetId}`;
  return target ? `${label} · ${target}` : label;
}

/** 变更明细：[旧值, 新值] 显示为 “旧 → 新” */
export function auditChanges(detail: Record<string, unknown>) {
  return Object.entries(detail)
    .filter(([k]) => k !== "domain")
    .map(([k, v]) => {
      const show = (x: unknown) => (typeof x === "string" ? x || "（空）" : JSON.stringify(x));
      const value = k !== "assets" && Array.isArray(v) && v.length === 2 ? `${show(v[0])} → ${show(v[1])}` : show(v);
      return [k, value] as const;
    });
}
