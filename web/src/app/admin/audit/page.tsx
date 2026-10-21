import type { Metadata } from "next";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { listAudit, pageHref, pageParam, param } from "@/lib/admin";
import { formatTime } from "@/lib/admin-labels";
import { FilterBar, PageHeader, Table, TableSkeleton, tdClass, thClass } from "../ui";
import { auditActionLabel, auditChanges, describeAudit } from "./describe";

export const metadata: Metadata = {
  title: "审计日志",
};

async function AuditTable({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const params = await searchParams;
  const filters = { q: param(params, "q") };
  const page = pageParam(params);
  const data = await listAudit({ action: filters.q, page });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <FilterBar action="/admin/audit" q={filters.q} placeholder="按动作筛选，例如 site.update、user" />
      <p className="text-sm text-muted">共 {data.total} 条记录</p>
      <Table
        colSpan={4}
        empty="暂无记录"
        head={
          <>
            <th className={thClass}>时间</th>
            <th className={thClass}>操作人</th>
            <th className={thClass}>操作</th>
            <th className={thClass}>明细</th>
          </>
        }
      >
        {data.items.map((a) => (
          <tr key={a.id}>
            <td className={`${tdClass} font-mono text-xs whitespace-nowrap text-muted`}>{formatTime(a.createdAt)}</td>
            <td className={`${tdClass} whitespace-nowrap`}>{a.actorEmail ?? "系统 / 命令行"}</td>
            <td className={tdClass}>
              <div>{describeAudit(a)}</div>
              <code className="text-xs text-muted" title={auditActionLabel[a.action]}>
                {a.action}
              </code>
            </td>
            <td className={`${tdClass} text-xs`}>
              <dl className="space-y-0.5">
                {auditChanges(a.detail).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="shrink-0 text-muted">{k}</dt>
                    <dd className="break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={pages} href={pageHref("/admin/audit", filters)} />
    </>
  );
}

export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <div className="space-y-4">
      <PageHeader title="审计日志" desc="登录锁定、用户、产品与站点的变更记录。" />
      <Suspense fallback={<TableSkeleton />}>
        <AuditTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
