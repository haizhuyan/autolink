"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/dal";
import {
  ProductFormSchema,
  type ProductAssetKey,
  type ProductFormState,
  type ProductFormValues,
} from "@/lib/definitions";
import { getPlan } from "@/lib/plans";
import { PRODUCT_ID, countStoredProducts, getStoredProduct, saveProductToApi } from "@/lib/products";

const TEXT_FIELDS = [
  "name",
  "url",
  "tagline",
  "summary",
  "description",
  "category",
  "keywords",
  "audience",
  "features",
  "alternatives",
  "pricing",
  "pricingDetail",
  "makerName",
  "contactEmail",
  "country",
  "twitter",
  "linkedin",
  "github",
  "discord",
  "video",
  "note",
] as const satisfies readonly Exclude<keyof ProductFormValues, "platforms">[];

const ASSET_LIMITS: Record<ProductAssetKey, { label: string; maxBytes: number }> = {
  logo: { label: "Logo", maxBytes: 1024 * 1024 },
  screenshot: { label: "产品截图", maxBytes: 3 * 1024 * 1024 },
};

const SECRET_AFTER_KEYWORD =
  /(?:密码|密钥|password|passwd|pwd|token)\s*[:：=]\s*[!-~]{4,}|(?:密码|密钥)\s*[!-~]{4,}/i;
const ASCII_RUN = /[!-~]{8,}/g;

// 与 scripts/clean_links.py 的脱敏规则一致（PRD N-3）
function looksLikeSecret(text: string) {
  if (SECRET_AFTER_KEYWORD.test(text)) return true;
  return (text.match(ASCII_RUN) ?? []).some((token) => {
    if (/^https?:/i.test(token) || /@[^@]+\.[^@]+$/.test(token)) return false;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(token)).length;
    return classes >= 3;
  });
}

/** 按文件头识别图片类型，不信任浏览器给的 MIME 和扩展名。 */
function imageExt(b: Uint8Array) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

async function readAsset(key: ProductAssetKey, entry: FormDataEntryValue | null) {
  if (!(entry instanceof File) || entry.size === 0) return { asset: undefined };
  const { label, maxBytes } = ASSET_LIMITS[key];
  if (entry.size > maxBytes) return { error: `${label}不超过 ${maxBytes / 1024 / 1024} MB` };
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const ext = imageExt(bytes);
  if (!ext) return { error: `${label}仅支持 PNG、JPG、WebP 图片` };
  return { asset: new File([bytes], `${key}.${ext}`, { type: ext === "jpg" ? "image/jpeg" : `image/${ext}` }) };
}

export async function saveProduct(_: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const user = await getCurrentUser();

  const values: ProductFormValues = {
    ...(Object.fromEntries(TEXT_FIELDS.map((key) => [key, String(formData.get(key) ?? "")])) as Omit<
      ProductFormValues,
      "platforms"
    >),
    platforms: formData.getAll("platforms").map(String),
  };
  const idParam = String(formData.get("id") ?? "");
  if (idParam && !PRODUCT_ID.test(idParam)) return { values, message: "产品 id 无效" };

  const parsed = ProductFormSchema.safeParse(values);
  const errors: NonNullable<NonNullable<ProductFormState>["errors"]> = parsed.success
    ? {}
    : { ...z.flattenError(parsed.error).fieldErrors };
  const assets: Partial<Record<ProductAssetKey, File>> = {};
  for (const key of ["logo", "screenshot"] as const) {
    const r = await readAsset(key, formData.get(key));
    if ("error" in r && r.error) errors[key] = [r.error];
    else if (r.asset) assets[key] = r.asset;
  }
  if (!parsed.success || Object.keys(errors).length) {
    return { errors, values, message: "有字段需要修改，请检查标红的项。上传的图片需要重新选择。" };
  }

  if (looksLikeSecret(parsed.data.note) && formData.get("ackSecret") !== "1") {
    return {
      values,
      warning: "备注里像是包含密码或密钥。备注会明文显示在任务详情里，建议改用账号库保存凭据。",
    };
  }

  const existing = idParam ? await getStoredProduct(idParam) : null;
  const plan = getPlan(user.planId);
  if (!existing && (await countStoredProducts()) >= plan.products) {
    return { values, message: `已达到 ${plan.name} 套餐的产品上限（${plan.products} 个）` };
  }

  const body = new FormData();
  body.set("data", JSON.stringify(parsed.data));
  for (const [key, file] of Object.entries(assets)) body.set(key, file);

  let id: string;
  try {
    id = (await saveProductToApi(existing?.id ?? null, body)).id;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (err.status === 409) return { values, message: err.message };
    if (err.status === 422) {
      return { values, errors: err.fieldErrors(), message: "服务端校验未通过，请检查标红的项。上传的图片需要重新选择。" };
    }
    if (err.status === 404) return { values, message: "产品不存在或已被删除" };
    throw err;
  }
  redirect(`/dashboard/products/${id}?saved=1`);
}
