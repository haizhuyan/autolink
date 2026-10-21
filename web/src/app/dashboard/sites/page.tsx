import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import { btnSecondary } from "@/components/button-styles";
import { SiteLibrary, SiteLibrarySkeleton, type ProductContext } from "@/components/site-library";
import { listProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "站点库",
};

async function LibraryWithProducts({ searchParams }: Pick<PageProps<"/dashboard/sites">, "searchParams">) {
  const products = await listProducts();
  const context: ProductContext = {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      statuses: Object.fromEntries(p.submissions.map((s) => [s.domain, s.status])),
    })),
  };
  return <SiteLibrary searchParams={searchParams} basePath="/dashboard/sites" context={context} />;
}

export default function DashboardSitesPage({ searchParams }: PageProps<"/dashboard/sites">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">站点库</h1>
          <p className="mt-1 text-sm text-muted">
            「全部站点」查看站点本身的信息；「按产品查看」查看某个产品在每个站点的提交状态。
          </p>
        </div>
        <Link href="/sites" target="_blank" className={btnSecondary}>
          公开页面
          <ArrowSquareOut size={16} aria-hidden />
        </Link>
      </div>
      <Suspense fallback={<SiteLibrarySkeleton />}>
        <LibraryWithProducts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
