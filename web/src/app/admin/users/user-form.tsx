"use client";

import { useActionState, useId } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import Link from "next/link";
import { saveUser } from "@/app/actions/admin";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { PLAN_IDS, ROLES, USER_STATUSES, roleLabel, userStatusLabel, type AdminUser } from "@/lib/admin-labels";
import { getPlan } from "@/lib/plans";
import { FieldError, FormNotice, inputClass, labelClass } from "../ui";

type Props = {
  user: AdminUser | null;
  /** 当前登录的管理员本人：不能取消自己的管理员权限或停用自己 */
  isSelf?: boolean;
  locked?: boolean;
};

type SelectField = {
  name: "role" | "planId" | "status";
  label: string;
  options: readonly (readonly [string, string])[];
  fallback: string;
  /** 管理员本人不可修改 */
  self: boolean;
};

export function UserForm({ user, isSelf = false, locked = false }: Props) {
  const [state, action, pending] = useActionState(saveUser.bind(null, user?.id ?? null), undefined);
  // 前一个路由会以隐藏形式保留在 DOM 中，固定 id 会与之冲突
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const errors = state?.errors ?? {};
  const value = (key: "email" | "name" | "role" | "planId" | "status") =>
    String(state?.values?.[key] ?? user?.[key] ?? "");

  const selects: SelectField[] = [
    { name: "role", label: "角色", options: ROLES.map((r) => [r, roleLabel[r]] as const), fallback: "user", self: true },
    {
      name: "planId",
      label: "套餐",
      options: PLAN_IDS.map((p) => [p, `${getPlan(p).name}（${getPlan(p).products} 个产品）`] as const),
      fallback: "free",
      self: false,
    },
    ...(user
      ? [
          {
            name: "status",
            label: "状态",
            options: USER_STATUSES.map((s) => [s, userStatusLabel[s]] as const),
            fallback: "active",
            self: true,
          } satisfies SelectField,
        ]
      : []),
  ];

  const field = (name: string) => ({
    id: fid(name),
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? fid(`${name}-error`) : undefined,
    className: inputClass,
  });

  return (
    <form action={action} className="space-y-6">
      <FormNotice ok={state?.ok} message={state?.message} />

      <div className="grid gap-x-6 gap-y-5 rounded-lg border border-line bg-card p-5 md:grid-cols-2">
        {!user && (
          <div>
            <label htmlFor={fid("email")} className={labelClass}>
              邮箱 <span className="text-danger-text">*</span>
            </label>
            <input type="email" required maxLength={254} autoComplete="off" defaultValue={value("email")} {...field("email")} />
            <FieldError id={fid("email-error")} errors={errors.email} />
          </div>
        )}
        <div>
          <label htmlFor={fid("name")} className={labelClass}>
            姓名
          </label>
          <input type="text" maxLength={80} autoComplete="off" defaultValue={value("name")} {...field("name")} />
          <FieldError id={fid("name-error")} errors={errors.name} />
        </div>

        {selects.map((s) => {
          const disabled = isSelf && s.self;
          return (
            <div key={s.name}>
              <label htmlFor={fid(s.name)} className={labelClass}>
                {s.label}
              </label>
              {/* 用 key 在默认值变化时重新挂载，见 site-form */}
              <select
                key={value(s.name) || s.fallback}
                defaultValue={value(s.name) || s.fallback}
                disabled={disabled}
                {...field(s.name)}
              >
                {s.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {/* 被禁用的 select 不会提交，用隐藏字段保留当前值 */}
              {disabled && <input type="hidden" name={s.name} value={value(s.name)} />}
              {disabled && <p className="mt-1 text-xs text-muted">不能修改自己的角色或状态。</p>}
              <FieldError id={fid(`${s.name}-error`)} errors={errors[s.name]} />
            </div>
          );
        })}

        <div>
          <label htmlFor={fid("password")} className={labelClass}>
            {user ? "重置密码" : "初始密码"}
            {!user && <span className="text-danger-text"> *</span>}
          </label>
          <input
            type="password"
            required={!user}
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            {...field("password")}
          />
          {errors.password ? (
            <FieldError id={fid("password-error")} errors={errors.password} />
          ) : (
            <p className="mt-1 text-xs text-muted">
              {user ? "留空则不修改。" : ""}10–128 个字符。请通过安全渠道告知用户。
            </p>
          )}
        </div>

        {locked && (
          <label className="inline-flex cursor-pointer items-center gap-2 self-end text-sm md:col-span-2">
            <input type="checkbox" name="unlock" className="size-4 accent-accent" />
            解除登录锁定（连续输错密码导致）
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending && <CircleNotch size={16} className="animate-spin" aria-hidden />}
          {user ? "保存修改" : "创建用户"}
        </button>
        <Link href="/admin/users" className={btnSecondary}>
          返回列表
        </Link>
      </div>
    </form>
  );
}
