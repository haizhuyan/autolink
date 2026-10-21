import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle, Clock, HandPointing, Plus, XCircle } from "@phosphor-icons/react/ssr";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { countByStatus, listProducts } from "@/lib/products";
import { getSites } from "@/lib/sites";

export const metadata: Metadata = {
  title: "概览",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">概览</h1>
          <p className="mt-1 text-sm text-muted">提交进度、待处理事项与站点库状态。</p>
        </div>
        <Link href="/dashboard/products/new" className={btnPrimary}>
          <Plus size={18} weight="bold" aria-hidden />
          新建产品
        </Link>
      </div>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-xl border border-line bg-card" />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const [products, sites] = await Promise.all([listProducts(), getSites()]);
  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    c: countByStatus(p),
    updated: p.submissions.map((s) => s.updated).sort().at(-1),
  }));
  const total = (key: keyof (typeof rows)[number]["c"]) => rows.reduce((sum, r) => sum + r.c[key], 0);
  const kpis = [
    { label: "已收录", value: total("listed"), hint: "所有产品合计", Icon: CheckCircle, className: "text-success" },
    { label: "审核中", value: total("in_review"), hint: "等待站点审核", Icon: Clock, className: "text-warn-text" },
    {
      label: "待人工接管",
      value: total("needs_manual"),
      hint: "验证码 / 邮箱验证等",
      Icon: HandPointing,
      className: "text-info-text",
    },
    {
      label: "被拒 / 超时",
      value: total("rejected") + total("timed_out"),
      hint: "可调整资料后重新提交",
      Icon: XCircle,
      className: "text-danger-text",
    },
  ];
  const pending = products.flatMap((p) =>
    p.submissions.filter((s) => s.status === "needs_manual").map((s) => ({ ...s, productId: p.id, product: p.name })),
  );
  const review = sites.filter((s) => s.needsReview).length;
  const health = [
    { label: "正常", value: sites.length - review, className: "bg-success" },
    { label: "待复核", value: review, className: "bg-warn" },
  ];

  return (
    <>
      <section aria-label="关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, hint, Icon, className }) => (
          <article key={label} className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm text-muted">{label}</h2>
              <Icon size={20} weight="bold" className={className} aria-hidden />
            </div>
            <p className="mt-3 font-mono text-3xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted">{hint}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <section aria-labelledby="product-progress" className="rounded-xl border border-line bg-card xl:col-span-8">
          <div className="border-b border-line px-5 py-4">
            <h2 id="product-progress" className="font-semibold">
              产品进度
            </h2>
          </div>
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted">
              <p>还没有产品档案，新建产品后这里会显示每个产品的提交进度。</p>
              <Link href="/dashboard/products/new" className={`${btnSecondary} mt-4`}>
                <Plus size={16} aria-hidden />
                新建产品
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="px-5 py-3 font-medium">产品</th>
                    <th scope="col" className="px-5 py-3 font-medium">已提交</th>
                    <th scope="col" className="px-5 py-3 font-medium">已收录</th>
                    <th scope="col" className="px-5 py-3 font-medium">审核中</th>
                    <th scope="col" className="px-5 py-3 font-medium">待人工接管</th>
                    <th scope="col" className="px-5 py-3 font-medium">被拒 / 超时</th>
                    <th scope="col" className="px-5 py-3 font-medium">最近更新</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors duration-150 hover:bg-surface">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/products/${r.id}`} className="font-medium hover:text-accent-text">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono">
                        {r.c.needs_manual + r.c.in_review + r.c.listed + r.c.rejected + r.c.timed_out}
                      </td>
                      <td className="px-5 py-3 font-mono text-success">{r.c.listed}</td>
                      <td className="px-5 py-3 font-mono text-warn-text">{r.c.in_review}</td>
                      <td className="px-5 py-3 font-mono text-info-text">{r.c.needs_manual}</td>
                      <td className="px-5 py-3 font-mono text-danger-text">{r.c.rejected + r.c.timed_out}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted">{r.updated ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6 xl:col-span-4">
          <section aria-labelledby="pending-manual" className="rounded-xl border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="pending-manual" className="font-semibold">
                待人工接管
              </h2>
              <span className="font-mono text-xs text-muted">{pending.length} 项</span>
            </div>
            {pending.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">暂无需要你处理的站点</p>
            ) : (
              <ul className="divide-y divide-line">
                {pending.map((p) => (
                  <li key={`${p.productId}-${p.domain}`} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm">{p.domain}</p>
                      <p className="truncate text-xs text-muted">
                        {p.product}
                        {p.note && ` · ${p.note}`} · {p.updated}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/sites?view=product&product=${p.productId}`}
                      className={`${btnSecondary} shrink-0 px-3 py-1.5 text-xs`}
                    >
                      查看
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="site-health" className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 id="site-health" className="font-semibold">
                站点库状态
              </h2>
              <span className="font-mono text-xs text-muted">共 {sites.length} 个</span>
            </div>
            {sites.length === 0 ? (
              <p className="mt-4 text-sm text-muted">站点库正在整理中。</p>
            ) : (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-raised" aria-hidden>
                  {health.map((s) => (
                    <div key={s.label} className={s.className} style={{ width: `${(s.value / sites.length) * 100}%` }} />
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {health.map((s) => (
                    <div key={s.label}>
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        <span className={`size-2 rounded-full ${s.className}`} aria-hidden />
                        {s.label}
                      </dt>
                      <dd className="mt-1 font-mono font-semibold">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <Link href="/dashboard/sites" className="mt-4 inline-block text-xs text-muted hover:text-fg">
              查看站点库
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
