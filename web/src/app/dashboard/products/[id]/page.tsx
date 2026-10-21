import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowSquareOut, CaretRight, CheckCircle, ListMagnifyingGlass, PencilSimple, Plus } from "@phosphor-icons/react/ssr";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { ListingBadge } from "@/components/listing-badge";
import { PRODUCT_PRICING } from "@/lib/definitions";
import { countByStatus, getProductRecord } from "@/lib/products";
import { siteTitle } from "@/lib/site-labels";
import { getSites } from "@/lib/sites";

export async function generateMetadata({ params }: PageProps<"/dashboard/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getProductRecord(id))?.name ?? "产品不存在" };
}

export default function ProductPage({ params, searchParams }: PageProps<"/dashboard/products/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-xl border border-line bg-card" />}>
      <ProductDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductDetail({
  params,
  searchParams,
}: Pick<PageProps<"/dashboard/products/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const saved = (await searchParams).saved === "1";
  const product = await getProductRecord(id);
  if (!product) notFound();

  const sites = new Map((await getSites()).map((s) => [s.domain, s]));
  const c = countByStatus(product);
  const stats = [
    { label: "已用额度", value: product.creditsUsed, className: "" },
    { label: "已收录", value: c.listed, className: "text-success" },
    { label: "审核中", value: c.in_review, className: "text-warn-text" },
    { label: "待人工接管", value: c.needs_manual, className: "text-info-text" },
    { label: "被拒 / 超时", value: c.rejected + c.timed_out, className: "text-danger-text" },
  ];
  const pricing = PRODUCT_PRICING.find((p) => p.value === product.pricing);
  const socials = (
    [
      ["X (Twitter)", product.twitter],
      ["LinkedIn", product.linkedin],
      ["GitHub", product.github],
      ["Discord", product.discord],
      ["演示视频", product.video],
    ] as const
  ).filter(([, href]) => href);
  const profile: { label: string; value: ReactNode }[] = [
    { label: "一段话描述", value: product.summary },
    { label: "详细介绍", value: product.description && <span className="line-clamp-6">{product.description}</span> },
    { label: "主分类", value: product.category },
    { label: "关键词", value: product.keywords.join(", ") },
    { label: "目标受众", value: product.audience },
    {
      label: "主要功能",
      value: product.features.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4">
          {product.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ),
    },
    { label: "对标产品", value: product.alternatives.join(", ") },
    {
      label: "定价",
      value: [pricing ? `${pricing.value} · ${pricing.label}` : product.pricing, product.pricingDetail]
        .filter(Boolean)
        .join("，"),
    },
    { label: "支持平台", value: product.platforms.join(", ") },
    { label: "创始人 / 提交人", value: product.makerName },
    { label: "联系邮箱", value: product.contactEmail },
    { label: "国家 / 地区", value: product.country },
    {
      label: "社交媒体",
      value: socials.length > 0 && (
        <ul className="space-y-0.5">
          {socials.map(([label, href]) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-accent-text">
                {label}
              </a>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: "图片素材",
      value: [product.logo && `Logo（${product.logo}）`, product.screenshot && `截图（${product.screenshot}）`]
        .filter(Boolean)
        .join("、"),
    },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="面包屑" className="flex items-center gap-1 text-sm text-muted">
        <Link href="/dashboard/products" className="hover:text-fg">
          产品档案
        </Link>
        <CaretRight size={12} aria-hidden />
        <span className="text-fg" aria-current="page">
          {product.name}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent/10 font-mono text-xl font-bold text-accent-text">
            {product.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="font-mono text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="mt-1 text-sm text-muted">{product.tagline}</p>
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-fg"
            >
              {product.url.replace(/^https?:\/\//, "")}
              <ArrowSquareOut size={12} aria-hidden />
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/products/${product.id}/edit`} className={btnSecondary}>
            <PencilSimple size={18} aria-hidden />
            编辑资料
          </Link>
          <Link href={`/dashboard/sites?view=product&product=${product.id}`} className={btnSecondary}>
            <ListMagnifyingGlass size={18} aria-hidden />
            在站点库中查看
          </Link>
          <button type="button" className={btnPrimary} disabled title="即将上线">
            <Plus size={18} weight="bold" aria-hidden />
            新建提交任务
          </button>
        </div>
      </div>

      {saved && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
        >
          <CheckCircle size={18} weight="bold" className="shrink-0" aria-hidden />
          已保存。引擎可用 <code className="font-mono">--product {product.id}</code> 读取这份档案。
        </p>
      )}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-card p-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className={`mt-2 font-mono text-3xl font-bold ${s.className}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-12">
        <section aria-labelledby="submissions" className="rounded-xl border border-line bg-card xl:col-span-8">
          <div className="border-b border-line px-5 py-4">
            <h2 id="submissions" className="font-semibold">
              提交记录
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-3 font-medium">站点</th>
                  <th scope="col" className="px-5 py-3 font-medium">状态</th>
                  <th scope="col" className="px-5 py-3 font-medium">备注</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">更新</th>
                </tr>
              </thead>
              <tbody>
                {product.submissions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted">
                      还没有提交记录
                    </td>
                  </tr>
                )}
                {product.submissions.map((s) => {
                  const site = sites.get(s.domain);
                  return (
                    <tr key={s.domain} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">
                        {site ? (
                          <Link href={`/sites/${site.domain}`} className="font-medium hover:text-accent-text">
                            {siteTitle(site)}
                          </Link>
                        ) : (
                          <span className="font-medium">{s.domain}</span>
                        )}
                        <span className="block font-mono text-xs text-muted">{s.domain}</span>
                      </td>
                      <td className="px-5 py-3">
                        <ListingBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {s.launchDate && <span className="block text-fg">发布日 {s.launchDate}</span>}
                        {s.note || (!s.launchDate && "—")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-muted">{s.updated}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6 xl:col-span-4">
          <section aria-labelledby="profile" className="rounded-xl border border-line bg-card p-5">
            <h2 id="profile" className="font-semibold">
              提交资料
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {profile.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="mt-0.5">{row.value || <span className="text-muted">未填写</span>}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="note" className="rounded-xl border border-line bg-card p-5">
            <h2 id="note" className="font-semibold">
              产品备注
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm text-muted">{product.note || "暂无备注"}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
