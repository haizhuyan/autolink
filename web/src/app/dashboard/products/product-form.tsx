"use client";

import { useActionState, type ReactNode } from "react";
import { CircleNotch, Info, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { saveProduct } from "@/app/actions/products";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { PRODUCT_PLATFORMS, PRODUCT_PRICING, type ProductAssetKey, type ProductFormValues } from "@/lib/definitions";

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line-strong bg-card px-3 py-2.5 text-sm text-fg placeholder:text-muted/70 transition-colors duration-200 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent aria-invalid:border-danger";

const CATEGORY_SUGGESTIONS = [
  "AI",
  "Productivity",
  "Developer Tools",
  "Marketing",
  "Design",
  "SaaS",
  "Analytics",
  "Writing",
  "Video",
  "Education",
  "Finance",
  "E-commerce",
  "Social Media",
  "Health",
  "Games",
  "Other",
];

type TextKey = Exclude<keyof ProductFormValues, "platforms">;

type Field =
  | {
      name: TextKey;
      label: string;
      hint?: string;
      type?: "text" | "url" | "email" | "textarea";
      rows?: number;
      required?: boolean;
      placeholder?: string;
      autoComplete?: string;
      list?: string;
      wide?: boolean;
    }
  | { name: "pricing"; label: string; type: "pricing"; required: true; hint?: string }
  | { name: "platforms"; label: string; type: "platforms"; hint?: string; wide: true }
  | { name: ProductAssetKey; label: string; type: "file"; hint: string };

const sections: { title: string; desc: string; fields: Field[] }[] = [
  {
    title: "基本信息",
    desc: "几乎每个收录站都会要求的字段。",
    fields: [
      { name: "name", label: "产品名称", required: true, placeholder: "MyProduct", autoComplete: "off" },
      { name: "url", label: "产品网址", type: "url", required: true, placeholder: "https://", autoComplete: "url" },
      {
        name: "tagline",
        label: "一句话描述",
        required: true,
        hint: "建议 60 个字符以内，最多 100。显示在标题下方，很多站点有长度限制。",
        placeholder: "Turn meeting recordings into action items",
        wide: true,
      },
      {
        name: "summary",
        label: "一段话描述",
        type: "textarea",
        rows: 3,
        required: true,
        hint: "2–3 句，最多 500 字符。用于“Short description”类字段。",
        wide: true,
      },
      {
        name: "description",
        label: "详细介绍",
        type: "textarea",
        rows: 7,
        hint: "建议 150–300 词，最多 5000 字符。没填时用一段话描述代替；遇到字数限制会自动改用更短的描述。",
        wide: true,
      },
    ],
  },
  {
    title: "分类与定位",
    desc: "用于匹配站点的分类下拉框、标签和受众字段。",
    fields: [
      {
        name: "category",
        label: "主分类",
        required: true,
        list: "category-suggestions",
        placeholder: "Productivity",
        hint: "可从建议中选，也可以自己填。",
      },
      {
        name: "keywords",
        label: "关键词 / 标签",
        placeholder: "AI, meeting notes, transcription",
        hint: "逗号分隔，最多 10 个。",
      },
      {
        name: "audience",
        label: "目标受众",
        placeholder: "Remote teams, project managers",
        hint: "最多 200 字符。",
        wide: true,
      },
      {
        name: "features",
        label: "主要功能",
        type: "textarea",
        rows: 5,
        placeholder: "Automatic transcription\nExtract decisions and to-dos\nSync to Notion and Jira",
        hint: "每行一条，最多 8 条。",
        wide: true,
      },
      {
        name: "alternatives",
        label: "对标 / 替代产品",
        placeholder: "Otter.ai, Fireflies",
        hint: "逗号分隔，最多 5 个。AlternativeTo 类站点会用到。",
        wide: true,
      },
    ],
  },
  {
    title: "定价与平台",
    desc: "大多数站点会让你选定价模式，部分会让你勾选支持的平台。",
    fields: [
      { name: "pricing", label: "定价模式", type: "pricing", required: true },
      {
        name: "pricingDetail",
        label: "价格说明",
        placeholder: "From $9/month",
        hint: "可选，最多 80 字符。",
      },
      { name: "platforms", label: "支持平台", type: "platforms", hint: "可多选。", wide: true },
    ],
  },
  {
    title: "团队与联系",
    desc: "很多站点要求填写提交人信息，审核结果也会发到联系邮箱。",
    fields: [
      { name: "makerName", label: "创始人 / 提交人姓名", placeholder: "Alex Chen", autoComplete: "name" },
      {
        name: "contactEmail",
        label: "联系邮箱",
        type: "email",
        required: true,
        autoComplete: "email",
        hint: "建议用产品域名的邮箱，部分站点会拒绝免费邮箱。",
      },
      { name: "country", label: "国家 / 地区", placeholder: "China", hint: "用英文填写。" },
    ],
  },
  {
    title: "社交媒体与链接",
    desc: "可选，填写完整链接。站点要求账号名时会从链接里提取。",
    fields: [
      { name: "twitter", label: "X (Twitter)", type: "url", placeholder: "https://x.com/yourname" },
      { name: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://www.linkedin.com/company/…" },
      { name: "github", label: "GitHub", type: "url", placeholder: "https://github.com/…" },
      { name: "discord", label: "Discord", type: "url", placeholder: "https://discord.gg/…" },
      { name: "video", label: "演示视频", type: "url", placeholder: "https://www.youtube.com/watch?v=…", wide: true },
    ],
  },
  {
    title: "图片素材",
    desc: "多数站点要求上传 Logo，部分要求产品截图。",
    fields: [
      { name: "logo", label: "Logo", type: "file", hint: "正方形，建议 256×256 以上；PNG / JPG / WebP，不超过 1 MB。" },
      {
        name: "screenshot",
        label: "产品截图",
        type: "file",
        hint: "建议 1270×760 或 16:9；PNG / JPG / WebP，不超过 3 MB。",
      },
    ],
  },
  {
    title: "产品备注",
    desc: "只有你能看到，不会提交到站点，会显示在该产品的每个提交任务里。",
    fields: [
      {
        name: "note",
        label: "备注",
        type: "textarea",
        rows: 3,
        hint: "不要在这里写密码，站点账号请放进账号库。",
        wide: true,
      },
    ],
  },
];

export function ProductForm({
  productId,
  initial,
  assets,
  submitLabel,
  cancelHref,
}: {
  productId?: string;
  initial?: ProductFormValues;
  /** 已上传的素材文件名 */
  assets?: Partial<Record<ProductAssetKey, string>>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const values = state?.values ?? initial;

  return (
    <form action={action} className="space-y-6" noValidate>
      {productId && <input type="hidden" name="id" value={productId} />}
      <datalist id="category-suggestions">
        {CATEGORY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <p className="flex items-start gap-2 rounded-md border border-line bg-raised px-3 py-2.5 text-sm text-muted">
        <Info size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
        收录站绝大多数是英文站，档案内容请用英文填写，提交时原样使用。
      </p>

      {state?.message && !state.warning && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger-text">
          {state.message}
        </p>
      )}

      {sections.map((section) => (
        <fieldset key={section.title} className="rounded-lg border border-line bg-card p-5">
          <legend className="sr-only">{section.title}</legend>
          <h2 className="font-mono text-base font-semibold">{section.title}</h2>
          <p className="mt-1 text-sm text-muted">{section.desc}</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {section.fields.map((f) => {
              const error = state?.errors?.[f.name]?.[0];
              const describedBy = [f.hint && `${f.name}-hint`, error && `${f.name}-error`]
                .filter(Boolean)
                .join(" ");
              const aria = {
                "aria-invalid": error ? true : undefined,
                "aria-describedby": describedBy || undefined,
              } as const;
              const required = "required" in f && f.required;
              const wide = "wide" in f && f.wide;

              let control: ReactNode;
              if (f.type === "platforms") {
                const checked = new Set(values?.platforms ?? []);
                control = (
                  <div role="group" aria-labelledby="platforms-label" {...aria} className="mt-2 flex flex-wrap gap-2">
                    {PRODUCT_PLATFORMS.map((p) => (
                      <label
                        key={p}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-line-strong px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent/10"
                      >
                        <input
                          type="checkbox"
                          name="platforms"
                          value={p}
                          defaultChecked={checked.has(p)}
                          className="accent-accent"
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                );
              } else if (f.type === "pricing") {
                control = (
                  <select
                    id="pricing"
                    name="pricing"
                    required
                    defaultValue={values?.pricing ?? ""}
                    {...aria}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      请选择
                    </option>
                    {PRODUCT_PRICING.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.value} · {p.label}
                      </option>
                    ))}
                  </select>
                );
              } else if (f.type === "file") {
                control = (
                  <>
                    <input
                      id={f.name}
                      name={f.name}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      {...aria}
                      className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-fg`}
                    />
                    {assets?.[f.name] && (
                      <p className="mt-1.5 text-xs text-muted">已上传 {assets[f.name]}，重新选择会替换。</p>
                    )}
                  </>
                );
              } else {
                const common = {
                  id: f.name,
                  name: f.name,
                  required: f.required,
                  defaultValue: values?.[f.name] ?? "",
                  placeholder: f.placeholder,
                  autoComplete: f.autoComplete,
                  ...aria,
                  className: inputClass,
                };
                control =
                  f.type === "textarea" ? (
                    <textarea rows={f.rows ?? 5} {...common} />
                  ) : (
                    <input type={f.type ?? "text"} list={f.list} {...common} />
                  );
              }

              return (
                <div key={f.name} className={wide ? "sm:col-span-2" : undefined}>
                  {f.type === "platforms" ? (
                    <span id="platforms-label" className="text-sm font-medium">
                      {f.label}
                    </span>
                  ) : (
                    <label htmlFor={f.name} className="text-sm font-medium">
                      {f.label}
                      {required && <span className="ml-1 text-danger-text">*</span>}
                    </label>
                  )}
                  {control}
                  {f.hint && (
                    <p id={`${f.name}-hint`} className="mt-1.5 text-xs text-muted">
                      {f.hint}
                    </p>
                  )}
                  {error && (
                    <p id={`${f.name}-error`} className="mt-1.5 text-sm text-danger-text">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      {state?.warning && (
        <div role="alert" className="rounded-md border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-warn-text">
          <p className="flex items-center gap-2 font-medium">
            <Warning size={18} weight="bold" aria-hidden />
            {state.warning}
          </p>
          <p className="mt-1 text-warn-text/80">修改备注后重新保存，或确认后仍然保存。上传的图片需要重新选择。</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={cancelHref} className={btnSecondary}>
          取消
        </Link>
        {state?.warning && (
          <button type="submit" name="ackSecret" value="1" disabled={pending} className={btnSecondary}>
            仍然保存
          </button>
        )}
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending && <CircleNotch size={18} weight="bold" className="animate-spin" aria-hidden />}
          {pending ? "保存中…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
