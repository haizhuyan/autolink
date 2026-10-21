import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarBlank, Lock, Plus } from "@phosphor-icons/react/ssr";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { getCurrentUser } from "@/lib/dal";
import { getPlan } from "@/lib/plans";
import { countByStatus, listProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "产品档案",
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-xl border border-line bg-card" />}>
      <ProductList />
    </Suspense>
  );
}

async function ProductList() {
  const products = await listProducts();
  const plan = getPlan((await getCurrentUser()).planId);
  const owned = products.length;
  const canCreate = owned < plan.products;
  const used = products.reduce((sum, p) => sum + p.creditsUsed, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">产品档案</h1>
          <p className="mt-1 text-sm text-muted">
            {plan.name} 套餐：产品 {owned} / {plan.products}，提交额度{" "}
            {plan.credits ? `${used} / ${plan.credits}（产品间共享）` : "不限"}
          </p>
        </div>
        {canCreate ? (
          <Link href="/dashboard/products/new" className={btnPrimary}>
            <Plus size={18} weight="bold" aria-hidden />
            新建产品
          </Link>
        ) : (
          <Link href="/#pricing" className={btnSecondary}>
            <Lock size={18} aria-hidden />
            升级以添加更多产品
          </Link>
        )}
      </div>

      {products.length === 0 && (
        <p className="text-sm text-muted">还没有产品档案。新建一个产品，填好提交资料后就能开始提交。</p>
      )}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const c = countByStatus(p);
          const next = p.submissions
            .filter((s): s is typeof s & { launchDate: string } => Boolean(s.launchDate && s.launchDate >= today))
            .sort((a, b) => a.launchDate.localeCompare(b.launchDate))[0];
          return (
            <li key={p.id}>
              <Link
                href={`/dashboard/products/${p.id}`}
                className="group flex h-full flex-col rounded-xl border border-line bg-card p-5 transition-colors duration-200 hover:border-accent/50"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/10 font-mono text-lg font-bold text-accent-text">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    <p className="truncate font-mono text-xs text-muted">{p.url.replace(/^https?:\/\//, "")}</p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="ml-auto shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg"
                    aria-hidden
                  />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted">{p.tagline}</p>
                <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div>
                    <dt className="text-xs text-muted">已收录</dt>
                    <dd className="font-mono text-lg font-semibold text-success">{c.listed}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">审核中</dt>
                    <dd className="font-mono text-lg font-semibold text-warn-text">{c.in_review}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">已用额度</dt>
                    <dd className="font-mono text-lg font-semibold">{p.creditsUsed}</dd>
                  </div>
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                  <CalendarBlank size={14} aria-hidden />
                  {next ? `下一个发布 ${next.domain} · ${next.launchDate}` : "暂无站点发布排期"}
                </p>
              </Link>
            </li>
          );
        })}
        {canCreate && (
          <li>
            <Link
              href="/dashboard/products/new"
              className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line p-5 text-sm text-muted transition-colors duration-200 hover:border-accent/50 hover:text-fg"
            >
              <Plus size={24} aria-hidden />
              新建产品
              <span className="text-xs">还可添加 {plan.products - owned} 个</span>
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
