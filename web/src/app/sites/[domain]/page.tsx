import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, ArrowSquareOut, CaretLeft, Info, Warning } from "@phosphor-icons/react/ssr";
import { btnPrimary } from "@/components/button-styles";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { HeadPlatformBadge, VerificationBadge } from "@/components/site-library";
import { loginLabel, pricingLabel, siteTitle, submitModeLabel, type Site } from "@/lib/site-labels";
import { getSite, getSites } from "@/lib/sites";

export async function generateStaticParams() {
  const sites = await getSites();
  return sites.map((s) => ({ domain: s.domain }));
}

export async function generateMetadata({ params }: PageProps<"/sites/[domain]">): Promise<Metadata> {
  const site = await getSite((await params).domain);
  if (!site) return { title: "站点不存在" };
  const title = siteTitle(site);
  return {
    title: `${title} 提交指南`,
    description: `${title}（${site.domain}）产品收录提交信息：收费模式 ${pricingLabel[site.pricing]}，登录方式 ${loginLabel[site.loginMethod]}${site.requiresBacklink ? "，要求反链" : ""}${site.supportsLaunch ? "，支持打榜" : ""}。`,
  };
}

function yesNo(value: boolean) {
  return value ? "是" : "否";
}

function tips(site: Site) {
  const list: string[] = [];
  if (site.submitMode === "manual")
    list.push(
      "这是头部平台：曝光集中、审核看重内容质量和发布时机，批量式提交容易被拒或浪费一次性的发布机会。AutoLink 不会对它自动提交，也不消耗提交额度；建议你基于产品档案亲自准备文案、配图和发布日后手动提交，再在 AutoLink 里记录状态。",
    );
  if (site.loginMethod === "google" && site.submitMode === "auto")
    list.push("该站只能用 Google 登录。首次需要你在 AutoLink 的远程浏览器里登录一次，之后自动复用登录状态。");
  if (site.loginMethod === "email_password" && site.submitMode === "auto")
    list.push("需要站点账号。账号保存在 AutoLink 的加密账号库中，提交时自动登录。");
  if (site.requiresBacklink)
    list.push("收录前需要在你的官网放置该站徽章或反链。AutoLink 会保存徽章代码并定期检测是否仍在。");
  if (site.requiresVerification) list.push("需要站长验证（DNS 或 meta 代码），AutoLink 会提示需添加的记录并检测是否生效。");
  if (site.supportsLaunch) list.push("支持打榜或按发布日排队。发布日以站点排期为准，AutoLink 会记录并在发布前一天与当天提醒你。");
  if (site.pricing === "paid" || site.pricing === "paid_with_free_window")
    list.push("这是付费站点，需要你自行付款；AutoLink 不代付，也不消耗提交额度。");
  return list;
}

export default function SiteDetailPage({ params }: PageProps<"/sites/[domain]">) {
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <Link href="/sites" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <CaretLeft size={14} aria-hidden />
          站点库
        </Link>
        <Suspense fallback={<SiteDetailSkeleton />}>
          <SiteDetail params={params} />
        </Suspense>
      </main>
      <PublicFooter />
    </>
  );
}

function SiteDetailSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="mt-4 h-9 w-64 rounded bg-raised" />
      <div className="mt-8 h-96 rounded-xl border border-line bg-card" />
    </div>
  );
}

async function SiteDetail({ params }: Pick<PageProps<"/sites/[domain]">, "params">) {
  const site = await getSite((await params).domain);
  if (!site) notFound();

  const title = siteTitle(site);
  const rows: [string, React.ReactNode][] = [
    [
      "提交入口",
      <a
        key="url"
        href={site.submitUrl}
        target="_blank"
        rel="nofollow noopener noreferrer"
        className="inline-flex cursor-pointer items-center gap-1 break-all font-mono text-accent-text hover:underline"
      >
        {site.submitUrl}
        <ArrowSquareOut size={14} className="shrink-0" aria-hidden />
      </a>,
    ],
    ["提交方式", submitModeLabel[site.submitMode]],
    ["收费模式", pricingLabel[site.pricing]],
    ["登录方式", loginLabel[site.loginMethod]],
    ["要求反链 / 徽章", yesNo(site.requiresBacklink)],
    ["需要站长验证", yesNo(site.requiresVerification)],
    ["支持打榜", yesNo(site.supportsLaunch)],
    ["典型审核时长", site.reviewTime || "暂无数据"],
    ["分类", site.category || "未标注"],
  ];
  const notes = tips(site);

  return (
    <>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-3xl font-bold tracking-tight">{title}</h1>
          <VerificationBadge value={site.verification} />
          {site.submitMode === "manual" && <HeadPlatformBadge />}
        </div>
        {site.name && <p className="mt-1 font-mono text-sm text-muted">{site.domain}</p>}

        {site.needsReview && (
          <p
            role="note"
            className="mt-6 flex items-start gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn-text"
          >
            <Warning size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
            该站点近期提交出现异常（如提交入口关闭或报错），正在复核中。
          </p>
        )}

        <section aria-labelledby="facts" className="mt-8 rounded-xl border border-line bg-card">
          <h2 id="facts" className="border-b border-line px-5 py-4 font-semibold">
            提交信息
          </h2>
          <dl className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-3">
                <dt className="text-muted">{label}</dt>
                <dd className="sm:col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {notes.length > 0 && (
          <section aria-labelledby="tips" className="mt-6 rounded-xl border border-line bg-card p-5">
            <h2 id="tips" className="flex items-center gap-2 font-semibold">
              <Info size={18} className="text-info-text" aria-hidden />
              提交前须知
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
              {notes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-accent/30 bg-accent/5 p-6 sm:flex-row sm:items-center">
          <div>
            {site.submitMode === "manual" ? (
              <>
                <h2 className="font-semibold">用 AutoLink 管理你在 {title} 的发布</h2>
                <p className="mt-1 text-sm text-muted">
                  头部平台由你亲自提交；AutoLink 负责产品档案、发布提醒和收录状态跟踪。
                </p>
              </>
            ) : (
              <>
                <h2 className="font-semibold">用 AutoLink 自动提交到 {title}</h2>
                <p className="mt-1 text-sm text-muted">注册即可免费体验 1 次自动提交，目录由你自己选。</p>
              </>
            )}
          </div>
          <Link href="/login" className={`${btnPrimary} shrink-0`}>
            {site.submitMode === "manual" ? "免费注册" : "免费体验"}
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </section>
    </>
  );
}
