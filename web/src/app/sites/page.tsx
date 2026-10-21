import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/ssr";
import { btnPrimary } from "@/components/button-styles";
import { Pagination } from "@/components/pagination";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { siteTitle } from "@/lib/site-labels";
import { getSites } from "@/lib/sites";

export const metadata: Metadata = {
  title: "产品收录站点库",
  description: "免费浏览 500+ 产品收录站点（Product Directory）列表与提交链接。",
};

function siteHref(submitUrl: string, domain: string) {
  return /^https?:\/\//i.test(submitUrl) ? submitUrl : `https://${domain}`;
}

const PAGE_SIZE = 60;

export default function SitesPage({ searchParams }: PageProps<"/sites">) {
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <Suspense fallback={<SiteListSkeleton />}>
          <SiteList searchParams={searchParams} />
        </Suspense>
      </main>
      <PublicFooter />
    </>
  );
}

function SiteListSkeleton() {
  return (
    <div aria-busy="true" aria-label="正在加载站点" className="animate-pulse">
      <div className="h-10 w-72 rounded bg-raised" />
      <div className="mt-4 h-5 w-96 max-w-full rounded bg-raised" />
      <div className="mt-8 h-[640px] rounded-xl border border-line bg-card" />
    </div>
  );
}

async function SiteList({ searchParams }: Pick<PageProps<"/sites">, "searchParams">) {
  const raw = (await searchParams).page;
  const sites = await getSites();
  const pages = Math.max(1, Math.ceil(sites.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(Array.isArray(raw) ? raw[0] : raw)) || 1));
  const visible = sites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">产品收录站点库</h1>
            <p className="mt-3 text-muted">
              共 {sites.length} 个站点，免费浏览。登录后可查看收费模式、登录方式、反链要求等详细标签，并自动提交。
              Product Hunt 等头部平台只提供提交指南，建议亲自精心发布。
            </p>
          </div>
          <Link href="/login" className={btnPrimary}>
            自动提交到这些站点
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </div>

        {visible.length === 0 ? (
          <p className="mt-8 text-sm text-muted">站点库正在整理中，稍后再来看看。</p>
        ) : (
          <p className="mt-8 text-sm text-muted">
            第 <span className="font-mono text-fg">{(page - 1) * PAGE_SIZE + 1}</span>–
            <span className="font-mono text-fg">{(page - 1) * PAGE_SIZE + visible.length}</span> 个，共 {pages} 页
          </p>
        )}
        <ul className="mt-3 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((site) => {
            const href = siteHref(site.submitUrl, site.domain);
            const title = siteTitle(site);
            const shown = href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
            return (
              <li key={site.domain} className="bg-card">
                <a
                  href={href}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="group flex h-full items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium group-hover:text-accent-text">{title}</span>
                      {site.submitMode === "manual" && (
                        <span className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1 text-[11px] text-accent-text">
                          头部平台
                        </span>
                      )}
                    </span>
                    {shown !== title && (
                      <span className="block truncate font-mono text-xs text-muted">{shown}</span>
                    )}
                  </span>
                  <ArrowUpRight size={16} className="shrink-0 text-muted group-hover:text-fg" aria-hidden />
                  <span className="sr-only">（在新窗口打开）</span>
                </a>
              </li>
            );
          })}
        </ul>
        <div className="mt-6">
          <Pagination page={page} pages={pages} href={(n) => (n > 1 ? `/sites?page=${n}` : "/sites")} />
        </div>
    </>
  );
}
