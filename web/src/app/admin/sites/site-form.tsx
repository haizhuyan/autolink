"use client";

import { useActionState, useId } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import Link from "next/link";
import { saveSite } from "@/app/actions/admin";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { SITE_STATUSES, siteStatusLabel, type AdminSite } from "@/lib/admin-labels";
import {
  LOGIN_METHODS,
  PRICING,
  SUBMIT_MODES,
  loginLabel,
  pricingLabel,
  submitModeLabel,
} from "@/lib/site-labels";
import { FieldError, FormNotice, inputClass, labelClass } from "../ui";

type TextField = {
  name: "domain" | "submitUrl" | "category" | "adminNote";
  label: string;
  hint?: string;
  maxLength: number;
  required?: boolean;
  type?: "text" | "url" | "textarea";
  wide?: boolean;
  placeholder?: string;
};

type SelectField = {
  name: "pricing" | "loginMethod" | "submitMode" | "status";
  label: string;
  hint?: string;
  fallback: string;
  options: readonly (readonly [string, string])[];
};

const pairs = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((v) => [v, labels[v]] as const);

const selects: SelectField[] = [
  {
    name: "status",
    label: "状态",
    hint: "失效、黑名单站点不对用户展示；待复核会在站点库中标注。",
    fallback: "active",
    options: pairs(SITE_STATUSES, siteStatusLabel),
  },
  { name: "submitMode", label: "提交方式", fallback: "auto", options: pairs(SUBMIT_MODES, submitModeLabel) },
  { name: "pricing", label: "定价", fallback: "unknown", options: pairs(PRICING, pricingLabel) },
  { name: "loginMethod", label: "登录方式", fallback: "none", options: pairs(LOGIN_METHODS, loginLabel) },
];

const flags = [
  { name: "requiresBacklink", label: "需要反链" },
  { name: "requiresVerification", label: "需要验证（邮箱 / 人工）" },
  { name: "supportsLaunch", label: "支持 Launch / 排期发布" },
] as const;

export function SiteForm({ site }: { site: AdminSite | null }) {
  const [state, action, pending] = useActionState(saveSite.bind(null, site?.id ?? null), undefined);
  // 前一个路由会以隐藏形式保留在 DOM 中，固定 id 会与之冲突
  const uid = useId();
  const errors = state?.errors ?? {};
  // 出错时用提交值回填（React 会在 action 结束后重置表单）
  const value = <K extends keyof AdminSite>(key: K) => (state?.values?.[key] ?? site?.[key]) as AdminSite[K] | undefined;

  const top: TextField[] = [
    {
      name: "domain",
      label: "站点",
      hint: "填域名，例如 example.com；粘贴完整网址也可以，会自动去掉 https:// 和 www。",
      maxLength: 253,
      required: true,
      placeholder: "example.com",
    },
    {
      name: "submitUrl",
      label: "提交页地址（选填）",
      hint: "留空则使用 https://站点域名。",
      type: "url",
      maxLength: 500,
      placeholder: "https://",
    },
  ];
  const category: TextField = { name: "category", label: "分类", maxLength: 60, placeholder: "例如 AI 工具目录" };
  const note: TextField = { name: "adminNote", label: "备注", type: "textarea", maxLength: 2000, wide: true };

  const renderText = (f: TextField) => {
    const id = `${uid}-${f.name}`;
    const err = errors[f.name];
    const common = {
      id,
      name: f.name,
      defaultValue: value(f.name) ?? "",
      maxLength: f.maxLength,
      required: f.required,
      placeholder: f.placeholder,
      "aria-invalid": err ? true : undefined,
      "aria-describedby": err ? `${id}-error` : f.hint ? `${id}-hint` : undefined,
      className: inputClass,
    };
    return (
      <div key={f.name} className={f.wide ? "md:col-span-2" : undefined}>
        <label htmlFor={id} className={labelClass}>
          {f.label}
          {f.required && <span className="text-danger-text"> *</span>}
        </label>
        {f.type === "textarea" ? (
          <textarea rows={3} {...common} />
        ) : (
          <input type={f.type ?? "text"} autoComplete="off" {...common} />
        )}
        {f.hint && !err && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
            {f.hint}
          </p>
        )}
        <FieldError id={`${id}-error`} errors={err} />
      </div>
    );
  };

  return (
    <form action={action} className="space-y-6">
      <FormNotice ok={state?.ok} message={state?.message} />

      <div className="grid gap-x-6 gap-y-5 rounded-lg border border-line bg-card p-5 md:grid-cols-2">
        {top.map(renderText)}

        {selects.map((f) => {
          const id = `${uid}-${f.name}`;
          const err = errors[f.name];
          return (
            <div key={f.name}>
              <label htmlFor={id} className={labelClass}>
                {f.label}
              </label>
              {/* React 不会在更新时同步 select 的 defaultValue；用 key 重新挂载，提交后表单重置才会显示保存后的值 */}
              <select
                key={value(f.name) ?? f.fallback}
                id={id}
                name={f.name}
                defaultValue={value(f.name) ?? f.fallback}
                aria-invalid={err ? true : undefined}
                className={inputClass}
              >
                {f.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {f.hint && !err && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
              <FieldError id={`${id}-error`} errors={err} />
            </div>
          );
        })}

        {renderText(category)}

        <fieldset className="md:col-span-2">
          <legend className={labelClass}>提交要求</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {flags.map((f) => (
              <label key={f.name} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={f.name}
                  defaultChecked={value(f.name) ?? false}
                  className="size-4 accent-accent"
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        {renderText(note)}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending && <CircleNotch size={16} className="animate-spin" aria-hidden />}
          {site ? "保存修改" : "创建站点"}
        </button>
        <Link href="/admin/sites" className={btnSecondary}>
          返回列表
        </Link>
      </div>
    </form>
  );
}
