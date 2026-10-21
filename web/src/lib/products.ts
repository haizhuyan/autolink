import "server-only";
import { LISTING_STATUSES, type ListingStatus } from "@/components/listing-badge";
import { ApiError, apiFetch } from "./api";
import { getCurrentUser } from "./dal";
import type { ProductProfile } from "./definitions";

// 产品档案存在后端数据库；后端同时把 product.json 和素材镜像到 data/private/products/<id>/ 供引擎读取。
export const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export type ProductRecord = ProductProfile & {
  creditsUsed: number;
  /** launchDate 由站点排期决定（提交后识别或站点邮件通知），用户不填写 */
  submissions: { domain: string; status: ListingStatus; note: string; updated: string; launchDate?: string }[];
};

export function countByStatus(product: Pick<ProductRecord, "submissions">) {
  const counts = Object.fromEntries(LISTING_STATUSES.map((s) => [s, 0])) as Record<ListingStatus, number>;
  for (const s of product.submissions) counts[s.status]++;
  return counts;
}

type ApiProduct = Omit<ProductProfile, "logo" | "screenshot"> & {
  logo: string | null;
  screenshot: string | null;
  creditsUsed: number;
  submissions: { domain: string; status: ListingStatus; note: string; launchDate: string | null; updatedAt: string }[];
};

function toProfile(p: ApiProduct): ProductProfile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 剔除非档案字段
  const { creditsUsed: _c, submissions: _s, logo, screenshot, ...rest } = p;
  return { ...rest, logo: logo ?? undefined, screenshot: screenshot ?? undefined };
}

function toRecord(p: ApiProduct): ProductRecord {
  return {
    ...toProfile(p),
    creditsUsed: p.creditsUsed,
    submissions: p.submissions.map((s) => ({
      domain: s.domain,
      status: s.status,
      note: s.note,
      updated: s.updatedAt.slice(0, 10),
      launchDate: s.launchDate ?? undefined,
    })),
  };
}

async function fetchOwn() {
  const user = await getCurrentUser();
  return apiFetch<ApiProduct[]>("/products", { token: user.token });
}

export async function listProducts(): Promise<ProductRecord[]> {
  return (await fetchOwn()).map(toRecord);
}

async function fetchOne(id: string): Promise<ApiProduct | null> {
  if (!PRODUCT_ID.test(id)) return null;
  const user = await getCurrentUser();
  try {
    return await apiFetch<ApiProduct>(`/products/${id}`, { token: user.token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getProductRecord(id: string): Promise<ProductRecord | null> {
  const stored = await fetchOne(id);
  return stored ? toRecord(stored) : null;
}

export async function getStoredProduct(id: string) {
  const p = await fetchOne(id);
  return p ? toProfile(p) : null;
}

export async function countStoredProducts() {
  return (await fetchOwn()).length;
}

/** 新建（id 为空）或更新产品；form 含 data（JSON）与可选的 logo / screenshot 文件 */
export async function saveProductToApi(id: string | null, form: FormData) {
  const user = await getCurrentUser();
  return apiFetch<ApiProduct>(id ? `/products/${id}` : "/products", {
    method: id ? "PUT" : "POST",
    token: user.token,
    form,
  });
}
