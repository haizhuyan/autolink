import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  ChartLineUp,
  Database,
  Envelope,
  HandPointing,
  Robot,
} from "@phosphor-icons/react/ssr";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { StatusBadge, type SubmissionStatus } from "@/components/status-badge";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { plans } from "@/lib/plans";

const previewRows: { site: string; category: string; status: SubmissionStatus }[] = [
  { site: "producthunt.com", category: "综合", status: "success" },
  { site: "betalist.com", category: "初创", status: "success" },
  { site: "saashub.com", category: "SaaS", status: "manual" },
  { site: "alternativeto.net", category: "替代品", status: "running" },
  { site: "toolify.ai", category: "AI 工具", status: "queued" },
];

const metrics = [
  { value: "500+", label: "内置收录站点" },
  { value: "3 层", label: "规则 → 文本 LLM → 视觉兜底" },
  { value: "1 份", label: "产品档案适配所有站点" },
  { value: "全程", label: "截图与日志留证" },
];

const steps = [
  {
    title: "建立产品档案",
    body: "名称、多版本简介、Logo 与多尺寸截图、分类标签，一次填写，自动适配各站点字段长度。",
  },
  {
    title: "选择目标站点",
    body: "在站点库中按定价、登录方式、是否支持打榜筛选，也可以导入自己的站点列表。",
  },
  {
    title: "自动提交",
    body: "浏览器自动打开站点，AI 识别表单并填写。遇到验证码或邮箱验证时转为人工接管。",
  },
  {
    title: "跟踪与监控",
    body: "逐站点查看状态、截图证据与失败原因，持续检查收录情况与外链存活。",
  },
];

const features = [
  {
    Icon: Robot,
    title: "AI 表单识别",
    body: "先用规则与模板缓存，再交给文本 LLM，复杂页面用视觉模型兜底，控制成本的同时提高成功率。",
  },
  {
    Icon: HandPointing,
    title: "远程浏览器接管",
    body: "验证码、人机校验、邮箱确认不做破解，直接在网页里接管同一个浏览器会话，完成后自动继续。",
  },
  {
    Icon: Database,
    title: "维护中的站点库",
    body: "500+ 站点持续人工维护：提交入口、是否收费、登录方式与收录验证状态，公开可查站点列表，失效站点及时下线。",
  },
  {
    Icon: Envelope,
    title: "账号与邮箱管理",
    body: "统一保存各站点账号与验证邮箱，集中查看验证邮件，减少在多个收件箱之间来回切换。",
  },
  {
    Icon: ChartLineUp,
    title: "外链监控",
    body: "定期检查已收录页面与外链是否仍然存在、是否 dofollow，异常变化及时提醒。",
  },
  {
    Icon: Camera,
    title: "提交留证",
    body: "每次提交保留表单截图、提交结果与日志，失败原因清晰可查，可一键重试。",
  },
];

export default function HomePage() {
  return (
    <>
      <PublicHeader />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              500+ 收录站点 · AI 表单识别
            </p>
            <h1 className="mt-6 font-mono text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              把产品提交到 500+ 收录站，
              <span className="text-accent-text">交给 AutoLink</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              填写一次产品档案，AutoLink 自动打开每个站点、识别表单、填写并提交。
              遇到验证码或邮箱验证时在网页里一键接管，其余步骤全部自动完成。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={`${btnPrimary} px-5 py-3 text-base`}>
                免费体验 1 次提交
                <ArrowRight size={18} weight="bold" aria-hidden />
              </Link>
              <Link href="/sites" className={`${btnSecondary} px-5 py-3 text-base`}>
                浏览站点库
              </Link>
            </div>
          </div>

          <figure className="rounded-xl border border-line bg-card shadow-xl shadow-slate-900/5">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="font-mono text-sm font-semibold">提交批次 #0142</p>
                <p className="text-xs text-muted">MyProduct · 100 个站点</p>
              </div>
              <StatusBadge status="running" />
            </div>
            <div className="px-4 py-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted">进度</span>
                <span className="font-mono">72 / 100</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-raised"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={72}
                aria-label="提交进度"
              >
                <div className="h-full w-[72%] rounded-full bg-accent" />
              </div>
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {previewRows.map((r) => (
                <li key={r.site} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-mono">{r.site}</span>
                  <span className="flex items-center gap-3">
                    <span className="hidden text-xs text-muted sm:inline">{r.category}</span>
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
            <figcaption className="border-t border-line px-4 py-2 text-xs text-muted">
              界面示意
            </figcaption>
          </figure>
        </section>

        {/* Metrics */}
        <section aria-label="核心能力" className="border-y border-line bg-surface/50">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="px-2 py-8">
                <dt className="text-sm text-muted">{m.label}</dt>
                <dd className="mt-1 font-mono text-3xl font-bold">{m.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <h2 className="font-mono text-3xl font-bold tracking-tight">四步完成批量提交</h2>
          <p className="mt-3 max-w-2xl text-muted">
            半自动是刻意的设计：能自动的全部自动，必须由人完成的步骤交还给你，不碰灰色手段。
          </p>
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-line bg-card p-6">
                <span className="font-mono text-sm text-accent-text">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-t border-line bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <h2 className="font-mono text-3xl font-bold tracking-tight">比提交服务更完整的工具</h2>
            <p className="mt-3 max-w-2xl text-muted">
              从提交、接管到监控，一个控制台覆盖外链建设的完整流程。
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ Icon, title, body }) => (
                <article key={title} className="rounded-xl border border-line bg-card p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-accent/10 text-accent-text">
                    <Icon size={22} weight="duotone" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <h2 className="font-mono text-3xl font-bold tracking-tight">定价</h2>
          <p className="mt-3 text-muted">
            全部为一次性付款，没有订阅，额度不过期。站点库对所有人免费开放。
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const highlight = p.id === "pro";
              return (
                <article
                  key={p.id}
                  className={`flex flex-col rounded-xl border bg-card p-6 ${
                    highlight ? "border-accent" : "border-line"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-lg font-semibold">{p.name}</h3>
                    {highlight && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-text">
                        推荐
                      </span>
                    )}
                  </div>
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-bold">{p.price ? `$${p.price}` : "免费"}</span>
                    {p.price > 0 && <span className="text-sm text-muted">一次性</span>}
                  </p>
                  <p className="mt-1 text-sm text-muted">{p.summary}</p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className={`mt-8 ${highlight ? btnPrimary : btnSecondary}`}>
                    {p.price ? `选择 ${p.name}` : "免费开始"}
                  </Link>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-muted">
            一次提交 = 一个产品提交到一个目录。失败重试不重复扣除，站点自身的付费上架费用不包含在内。
          </p>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="rounded-2xl border border-line bg-card px-6 py-12 text-center sm:px-12">
            <h2 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">
              今天就开始第一批提交
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              注册即可免费体验 1 次自动提交，目录自选，完整走一遍从填表到收录追踪的流程。
            </p>
            <Link href="/login" className={`${btnPrimary} mt-8 px-6 py-3 text-base`}>
              免费开始
              <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
