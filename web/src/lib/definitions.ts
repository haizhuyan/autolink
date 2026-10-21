import { z } from "zod";

export const LoginFormSchema = z.object({
  email: z.email({ error: "请输入有效的邮箱地址" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "请输入密码" }).max(256),
});

export type LoginState =
  | {
      errors?: { email?: string[]; password?: string[] };
      message?: string;
      email?: string;
    }
  | undefined;

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, { error: `${label}不超过 ${max} 字` });

const requiredText = (max: number, label: string, missing: string) =>
  z.string().trim().min(1, { error: missing }).max(max, { error: `${label}不超过 ${max} 字` });

/** 逗号分隔（中英文逗号）的短列表 */
const commaList = (maxItems: number, itemMax: number, label: string) =>
  z
    .string()
    .trim()
    .max(maxItems * (itemMax + 2))
    .transform((s) =>
      s
        .split(/[,，]/)
        .map((k) => k.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(itemMax, { error: `单个${label}不超过 ${itemMax} 字` }))
        .max(maxItems, { error: `${label}最多 ${maxItems} 个` }),
    );

/** 每行一条的列表 */
const lineList = (maxItems: number, itemMax: number, label: string) =>
  z
    .string()
    .trim()
    .max(maxItems * (itemMax + 4))
    .transform((s) =>
      s
        .split(/\r?\n/)
        .map((k) => k.replace(/^\s*[-*•\d.]+\s*/, "").trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(itemMax, { error: `每条${label}不超过 ${itemMax} 字` }))
        .max(maxItems, { error: `${label}最多 ${maxItems} 条` }),
    );

const optionalUrl = (label: string) =>
  z.union([
    z.literal(""),
    z
      .url({ protocol: /^https?$/, error: `${label}请填写以 https:// 开头的完整链接` })
      .trim()
      .max(300),
  ]);

/** 与引擎的平台多选值一致，按英文提交 */
export const PRODUCT_PLATFORMS = [
  "Web",
  "iOS",
  "Android",
  "macOS",
  "Windows",
  "Linux",
  "Browser Extension",
  "API",
  "CLI",
] as const;

export const PRODUCT_PRICING = [
  { value: "Free", label: "免费" },
  { value: "Freemium", label: "免费 + 付费（Freemium）" },
  { value: "Free Trial", label: "付费，有免费试用" },
  { value: "Paid", label: "付费" },
  { value: "Open Source", label: "开源" },
] as const;

const PRICING_VALUES = PRODUCT_PRICING.map((p) => p.value) as [string, ...string[]];

export const ProductFormSchema = z.object({
  // 基本信息
  name: requiredText(60, "产品名称", "请填写产品名称"),
  url: z
    .url({ protocol: /^https?$/, error: "请输入以 http:// 或 https:// 开头的网址" })
    .trim()
    .max(300),
  tagline: requiredText(100, "一句话描述", "请填写一句话描述"),
  summary: requiredText(500, "一段话描述", "请填写一段话描述"),
  description: optionalText(5000, "详细介绍"),
  // 分类与定位
  category: requiredText(40, "分类", "请填写分类"),
  keywords: commaList(10, 30, "关键词"),
  audience: optionalText(200, "目标受众"),
  features: lineList(8, 150, "主要功能"),
  alternatives: commaList(5, 40, "对标产品"),
  // 定价与平台
  pricing: z.enum(PRICING_VALUES, { error: "请选择定价模式" }),
  pricingDetail: optionalText(80, "价格说明"),
  platforms: z.array(z.enum(PRODUCT_PLATFORMS, { error: "平台选项无效" })).max(PRODUCT_PLATFORMS.length),
  // 团队与联系
  makerName: optionalText(60, "创始人姓名"),
  contactEmail: z.email({ error: "请输入有效的联系邮箱" }).trim().max(120),
  country: optionalText(40, "国家 / 地区"),
  // 社交媒体与链接
  twitter: optionalUrl("X (Twitter)"),
  linkedin: optionalUrl("LinkedIn"),
  github: optionalUrl("GitHub"),
  discord: optionalUrl("Discord"),
  video: optionalUrl("演示视频"),
  // 备注
  note: optionalText(2000, "备注"),
});

type ProductFormInput = z.input<typeof ProductFormSchema>;

/** 表单回填用的原始值：列表字段（关键词、功能等）保持用户输入的文本，平台为多选数组 */
export type ProductFormValues = {
  [K in keyof ProductFormInput]: ProductFormInput[K] extends readonly string[] ? string[] : string;
};

export type ProductProfile = z.output<typeof ProductFormSchema> & {
  id: string;
  /** 产品目录下的素材文件名，如 logo.png */
  logo?: string;
  screenshot?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductAssetKey = "logo" | "screenshot";

export function toFormValues(p: z.output<typeof ProductFormSchema>): ProductFormValues {
  return {
    name: p.name,
    url: p.url,
    tagline: p.tagline,
    summary: p.summary,
    description: p.description,
    category: p.category,
    keywords: p.keywords.join(", "),
    audience: p.audience,
    features: p.features.join("\n"),
    alternatives: p.alternatives.join(", "),
    pricing: p.pricing,
    pricingDetail: p.pricingDetail,
    platforms: p.platforms,
    makerName: p.makerName,
    contactEmail: p.contactEmail,
    country: p.country,
    twitter: p.twitter,
    linkedin: p.linkedin,
    github: p.github,
    discord: p.discord,
    video: p.video,
    note: p.note,
  };
}

export type ProductFormState =
  | {
      errors?: Partial<Record<keyof ProductFormValues | ProductAssetKey, string[]>>;
      warning?: string;
      message?: string;
      ok?: boolean;
      values?: ProductFormValues;
    }
  | undefined;

export type Role = "user" | "admin";

/** 写入会话 cookie 的最小信息；token 是后端签发的访问令牌 */
export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  token: string;
};
