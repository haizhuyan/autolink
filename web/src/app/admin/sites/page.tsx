import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowSquareOut, PencilSimple, Plus } from "@phosphor-icons/react/ssr";
import { btnPrimary } from "@/components/button-styles";
import { Pagination } from "@/components/pagination";
import { listAdminSites, pageHref, pageParam, param } from "@/lib/admin";
import { SITE_STATUSES, siteStatusLabel, siteStatusTone } from "@/lib/admin-labels";
import { SUBMIT_MODES, loginLabel, pricingLabel, submitModeLabel } from "@/lib/site-labels";
import { Badge, FilterBar, FilterSelect, PageHeader, Table, TableSkeleton, tdClass, thClass } from "../ui";
import { DeleteSiteButton } from "./delete-site-button";

const btnRowBase =
  "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const btnRow = `${btnRowBase} text-muted hover:bg-raised hover:text-fg`;
const btnRowDanger = `${btnRowBase} text-danger-text hover:bg-danger/10`;

export const metadata: Metadata = {
  title: "站点",
};

type Props = Pick<PageProps<"/admin/sites">, "searchParams">;

async function SitesTable({ searchParams }: Props) {
  const params = await searchParams;
  const filters = {
    q: param(params, "q"),
    status: param(params, "status", SITE_STATUSES),
    mode: param(params, "mode", SUBMIT_MODES),
  };
  const page = pageParam(params);
  const data = await listAdminSites({ ...filters, page });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <FilterBar action="/admin/sites" q={filters.q} placeholder="搜索域名或名称">
        <FilterSelect
          name="status"
          label="状态"
          value={filters.status}
          options={SITE_STATUSES.map((s) => [s, siteStatusLabel[s]] as const)}
        />
        <FilterSelect
          name="mode"
          label="提交方式"
          value={filters.mode}
          options={SUBMIT_MODES.map((m) => [m, submitModeLabel[m]] as const)}
        />
      </FilterBar>
      <p className="text-sm text-muted">共 {data.total} 个站点</p>
      <Table
        colSpan={9}
        empty={filters.q || filters.status || filters.mode ? "没有符合条件的站点" : "还没有站点，点右上角“新增站点”添加"}
        head={
          <>
            <th className={thClass}>站点</th>
            <th className={thClass}>状态</th>
            <th className={thClass}>提交方式</th>
            <th className={thClass}>定价</th>
            <th className={thClass}>登录方式</th>
            <th className={thClass}>分类</th>
            <th className={thClass}>提交要求</th>
            <th className={thClass}>备注</th>
            <th className={thClass}>操作</th>
          </>
        }
      >
        {data.items.map((s) => {
          const reqs = [
            s.requiresBacklink && "需要反链",
            s.requiresVerification && "需要验证",
            s.supportsLaunch && "支持 Launch",
          ].filter(Boolean);
          return (
            <tr key={s.id} className="hover:bg-surface/60">
              <td className={tdClass}>
                <Link href={`/admin/sites/${s.id}`} className="font-medium text-accent-text hover:underline">
                  {s.domain}
                </Link>
                {s.submitUrl !== `https://${s.domain}` && (
                  <a
                    href={s.submitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block max-w-56 truncate text-xs text-muted hover:text-fg"
                  >
                    {s.submitUrl}
                  </a>
                )}
              </td>
              <td className={tdClass}>
                <Badge tone={siteStatusTone[s.status]}>{siteStatusLabel[s.status]}</Badge>
              </td>
              <td className={`${tdClass} whitespace-nowrap`}>{submitModeLabel[s.submitMode]}</td>
              <td className={`${tdClass} whitespace-nowrap`}>{pricingLabel[s.pricing]}</td>
              <td className={`${tdClass} whitespace-nowrap`}>{loginLabel[s.loginMethod]}</td>
              <td className={`${tdClass} whitespace-nowrap`}>{s.category || "—"}</td>
              <td className={`${tdClass} text-xs`}>
                {reqs.length ? reqs.map((r) => <div key={String(r)}>{r}</div>) : <span className="text-muted">无</span>}
              </td>
              <td className={`${tdClass} max-w-64 text-xs text-muted`}>
                <span className="line-clamp-3 whitespace-pre-line">{s.adminNote || "—"}</span>
              </td>
              <td className={tdClass}>
                <div className="flex items-start gap-1">
                  <Link href={`/admin/sites/${s.id}`} className={btnRow}>
                    <PencilSimple size={14} aria-hidden />
                    编辑
                  </Link>
                  <DeleteSiteButton id={s.id} domain={s.domain} className={btnRowDanger} />
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pages={pages} href={pageHref("/admin/sites", filters)} />
    </>
  );
}

export default function AdminSitesPage({ searchParams }: PageProps<"/admin/sites">) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="站点"
        desc="维护站点库。失效与黑名单站点不会出现在公开站点库和用户控制台中。"
        actions={
          <>
            <Link href="/sites" target="_blank" className="inline-flex items-center gap-1 px-3 py-2 text-sm text-muted hover:text-fg">
              公开站点库
              <ArrowSquareOut size={14} aria-hidden />
            </Link>
            <Link href="/admin/sites/new" className={btnPrimary}>
              <Plus size={16} aria-hidden />
              新增站点
            </Link>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <SitesTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
