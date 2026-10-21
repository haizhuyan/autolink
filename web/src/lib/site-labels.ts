export const PRICING = ["free_with_backlink", "paid", "paid_with_free_window", "unknown"] as const;
export type Pricing = (typeof PRICING)[number];

export const LOGIN_METHODS = ["google", "email_password", "none"] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

export const VERIFICATION = ["listed", "submitted", "unverified"] as const;
export type Verification = (typeof VERIFICATION)[number];

// manual = 头部平台（Product Hunt 等），不做自动化提交，由用户亲自精发
export const SUBMIT_MODES = ["auto", "manual"] as const;
export type SubmitMode = (typeof SUBMIT_MODES)[number];

export const submitModeLabel: Record<SubmitMode, string> = {
  auto: "自动提交",
  manual: "头部平台 · 手动精发",
};

export type Site = {
  domain: string;
  name: string;
  submitUrl: string;
  category: string;
  pricing: Pricing;
  loginMethod: LoginMethod;
  requiresBacklink: boolean;
  requiresVerification: boolean;
  supportsLaunch: boolean;
  submitMode: SubmitMode;
  reviewTime: string;
  needsReview: boolean;
  verification: Verification;
};

export const pricingLabel: Record<Pricing, string> = {
  free_with_backlink: "反链免费",
  paid: "付费",
  paid_with_free_window: "付费（有免费窗口）",
  unknown: "未标注",
};

export const loginLabel: Record<LoginMethod, string> = {
  google: "谷歌登录",
  email_password: "邮箱 + 密码",
  none: "不需要登录",
};

export const verificationLabel: Record<Verification, string> = {
  listed: "已验证收录",
  submitted: "已提交过",
  unverified: "未验证",
};

export function siteTitle(site: Pick<Site, "name" | "domain">) {
  return site.name || site.domain;
}
