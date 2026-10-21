import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAdminStats } from "@/lib/admin";
import { formatTime, siteStatusLabel, SITE_STATUSES } from "@/lib/admin-labels";
import { plans } from "@/lib/plans";
import { submitModeLabel } from "@/lib/site-labels";
import { describeAudit } from "./audit/describe";
import { PageHeader } from "./ui";

export const metadata: Metadata = {
  title: "概览",
};

const submissionLabel: Record<string, string> = {
  not_submitted: "未提交",
  needs_manual: "待人工接管",
  in_review: "审核中",
  listed: "已收录",
  rejected: "被拒",
  timed_out: "超时",
};

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

function Card({ title, value, href, rows }: {
  title: string;
  value: number;
  href?: string;
  rows: [string, number][];
}) {
  const body = (
    <>
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-1 font-mono text-3xl font-bold">{value}</p>
      <dl className="mt-3 space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
  const cls = "block rounded-lg border border-line bg-card p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors duration-200 hover:border-accent`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

async function Stats() {
  const s = await getAdminStats();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="用户"
          value={sum(s.users)}
          href="/admin/users"
          rows={[
            ["正常", s.users.active ?? 0],
            ["已停用", s.users.disabled ?? 0],
            ...plans.map((p): [string, number] => [`${p.name} 套餐`, s.plans[p.id] ?? 0]),
          ]}
        />
        <Card title="产品" value={s.products} href="/admin/products" rows={[]} />
        <Card
          title="站点"
          value={sum(s.sites)}
          href="/admin/sites"
          rows={[
            ...SITE_STATUSES.map((k): [string, number] => [siteStatusLabel[k], s.sites[k] ?? 0]),
            [submitModeLabel.manual, s.siteModes.manual ?? 0],
          ]}
        />
        <Card
          title="提交记录"
          value={sum(s.submissions)}
          rows={Object.entries(submissionLabel).map(([k, l]): [string, number] => [l, s.submissions[k] ?? 0])}
        />
      </div>

      <section className="rounded-lg border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-medium">最近操作</h2>
          <Link href="/admin/audit" className="text-sm text-accent-text hover:underline">
            查看全部
          </Link>
        </div>
        {s.recent.length ? (
          <ul className="divide-y divide-line text-sm">
            {s.recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                <time className="font-mono text-xs text-muted">{formatTime(a.createdAt)}</time>
                <span className="text-muted">{a.actorEmail ?? "系统"}</span>
                <span>{describeAudit(a)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">暂无记录</p>
        )}
      </section>
    </>
  );
}

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <PageHeader title="概览" desc="用户、产品、站点库与提交状态的整体情况。" />
      <Suspense fallback={<div aria-hidden className="h-72 animate-pulse rounded-lg border border-line bg-card" />}>
        <Stats />
      </Suspense>
    </div>
  );
}
