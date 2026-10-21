import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { apiFetch } from "./api";
import {
  LOGIN_METHODS,
  PRICING,
  SUBMIT_MODES,
  VERIFICATION,
  type LoginMethod,
  type Pricing,
  type Site,
  type SubmitMode,
  type Verification,
} from "./site-labels";

/** 后台修改站点后用 updateTag(SITES_TAG) 让公开站点库立即更新 */
export const SITES_TAG = "sites";

type ApiSite = {
  domain: string;
  name: string;
  submitUrl: string;
  category: string;
  pricing: Pricing;
  loginMethod: LoginMethod;
  requiresBacklink: boolean;
  requiresVerification: boolean;
  supportsLaunch: boolean;
  reviewTimeHint: string;
  submitMode: SubmitMode;
  status: "active" | "needs_review";
  submitted: number;
  listed: number;
};

function oneOf<T extends string>(values: readonly T[], value: string | undefined, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

/** 公开站点库（后端已排除失效与黑名单站点）。构建与运行时都需要后端可访问。 */
export async function getSites(): Promise<Site[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(SITES_TAG);

  const rows = await apiFetch<ApiSite[]>("/sites");
  return rows
    .map((s) => {
      const verification: Verification = s.listed > 0 ? "listed" : s.submitted > 0 ? "submitted" : "unverified";
      return {
        domain: s.domain,
        name: s.name,
        submitUrl: s.submitUrl,
        category: s.category,
        pricing: s.pricing,
        loginMethod: s.loginMethod,
        requiresBacklink: s.requiresBacklink,
        requiresVerification: s.requiresVerification,
        supportsLaunch: s.supportsLaunch,
        submitMode: s.submitMode,
        reviewTime: s.reviewTimeHint,
        needsReview: s.status === "needs_review",
        verification,
      } satisfies Site;
    })
    .sort((a, b) => VERIFICATION.indexOf(a.verification) - VERIFICATION.indexOf(b.verification));
}

export async function getSite(domain: string) {
  const sites = await getSites();
  return sites.find((s) => s.domain === domain) ?? null;
}

export type SiteQuery = {
  q: string;
  pricing: Pricing | "";
  login: LoginMethod | "";
  verification: Verification | "";
  launch: boolean;
  backlink: "" | "yes" | "no";
  mode: SubmitMode | "";
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

export function parseSiteQuery(params: RawParams): SiteQuery {
  const first = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const backlink = first("backlink");
  return {
    q: first("q").slice(0, 100),
    pricing: oneOf([...PRICING, ""], first("pricing"), ""),
    login: oneOf([...LOGIN_METHODS, ""], first("login"), ""),
    verification: oneOf([...VERIFICATION, ""], first("verification"), ""),
    launch: first("launch") === "1",
    backlink: backlink === "yes" || backlink === "no" ? backlink : "",
    mode: oneOf([...SUBMIT_MODES, ""], first("mode"), ""),
    page: Math.max(1, Math.floor(Number(first("page"))) || 1),
  };
}

export function filterSites(sites: Site[], query: SiteQuery) {
  const q = query.q.toLowerCase();
  return sites.filter(
    (s) =>
      (!q || s.domain.includes(q) || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)) &&
      (!query.pricing || s.pricing === query.pricing) &&
      (!query.login || s.loginMethod === query.login) &&
      (!query.verification || s.verification === query.verification) &&
      (!query.launch || s.supportsLaunch) &&
      (!query.mode || s.submitMode === query.mode) &&
      (query.backlink === "" || s.requiresBacklink === (query.backlink === "yes")),
  );
}
