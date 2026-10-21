import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { listAdminProducts, pageHref, pageParam, param } from "@/lib/admin";
import { formatTime } from "@/lib/admin-labels";
import { FilterBar, PageHeader, Table, TableSkeleton, tdClass, thClass } from "../ui";

export const metadata: Metadata = {
  title: "产品",
};

async function ProductsTable({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  const params = await searchParams;
  const filters = { q: param(params, "q") };
  const page = pageParam(params);
  const data = await listAdminProducts({ ...filters, page });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <FilterBar action="/admin/products" q={filters.q} placeholder="搜索产品名、网址或所有者邮箱" />
      <p className="text-sm text-muted">共 {data.total} 个产品</p>
      <Table
        colSpan={6}
        empty="没有符合条件的产品"
        head={
          <>
            <th className={thClass}>产品</th>
            <th className={thClass}>分类</th>
            <th className={thClass}>所有者</th>
            <th className={`${thClass} text-right`}>提交记录</th>
            <th className={thClass}>创建时间</th>
            <th className={thClass}>更新时间</th>
          </>
        }
      >
        {data.items.map((p) => (
          <tr key={p.id} className="hover:bg-surface/60">
            <td className={tdClass}>
              <div className="font-medium">{p.name}</div>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-xs break-all text-muted hover:text-accent-text hover:underline"
              >
                {p.url}
              </a>
            </td>
            <td className={tdClass}>{p.category}</td>
            <td className={tdClass}>
              <Link href={`/admin/users/${p.ownerId}`} className="text-accent-text hover:underline">
                {p.ownerEmail}
              </Link>
            </td>
            <td className={`${tdClass} text-right font-mono`}>{p.submissionCount}</td>
            <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatTime(p.createdAt)}</td>
            <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatTime(p.updatedAt)}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={pages} href={pageHref("/admin/products", filters)} />
    </>
  );
}

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <div className="space-y-4">
      <PageHeader title="产品" desc="所有用户的产品档案（只读）。产品内容由用户在控制台中维护。" />
      <Suspense fallback={<TableSkeleton />}>
        <ProductsTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
