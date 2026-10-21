import Link from "next/link";
import { ArrowSquareOut, Funnel, MagnifyingGlass, Plus, Warning } from "@phosphor-icons/react/ssr";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { LISTING_STATUSES, ListingBadge, listingLabel, type ListingStatus } from "@/components/listing-badge";
import { Pagination } from "@/components/pagination";
import { siteStatusLabel, siteStatusTone } from "@/lib/admin-labels";
import {
  LOGIN_METHODS,
  PRICING,
  SUBMIT_MODES,
  VERIFICATION,
  loginLabel,
  pricingLabel,
  siteTitle,
  submitModeLabel,
  verificationLabel,
  type Site,
  type Verification,
} from "@/lib/site-labels";
import { filterSites, getSites, parseSiteQuery, type SiteQuery } from "@/lib/sites";

const PAGE_SIZE = 25;

export type ProductContext = {
  products: { id: string; name: string; statuses: Record<string, ListingStatus> }[];
};

type View = "all" | "product";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath: string;
  context: ProductContext;
};

const fieldClass =
  "block w-full rounded-md border border-line-strong bg-card px-3 py-2 text-sm text-fg transition-colors duration-200 focus:border-accent focus:outline-none";
const thClass = "px-4 py-3 font-medium whitespace-nowrap";
const tdClass = "px-4 py-3";

const verificationClass: Record<Verification, string> = {
  listed: "border-success/30 bg-success/10 text-success",
  submitted: "border-info-text/40 bg-info-text/10 text-info-text",
  unverified: "border-line text-muted",
};

export function VerificationBadge({ value }: { value: Verification }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${verificationClass[value]}`}
    >
      {verificationLabel[value]}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded border border-line px-1.5 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}

export function HeadPlatformBadge() {
  return (
    <span className="inline-flex whitespace-nowrap rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent-text">
      {submitModeLabel.manual}
    </span>
  );
}

function Requirements({ site, withMode }: { site: Site; withMode: boolean }) {
  const head = withMode && site.submitMode === "manual";
  const none = !head && !site.requiresBacklink && !site.requiresVerification && !site.supportsLaunch;
  return (
    <div className="flex flex-wrap gap-1">
      {head && <HeadPlatformBadge />}
      {site.requiresBacklink && <Chip>反链 / 徽章</Chip>}
      {site.requiresVerification && <Chip>站长验证</Chip>}
      {site.supportsLaunch && <Chip>打榜</Chip>}
      {none && <span className="text-muted">无</span>}
    </div>
  );
}

function SiteCell({ site, showReview }: { site: Site; showReview: boolean }) {
  const title = siteTitle(site);
  return (
    <td className={tdClass}>
      <Link href={`/sites/${site.domain}`} className="cursor-pointer font-medium hover:text-accent-text hover:underline">
        {title}
      </Link>
      {site.name && <div className="font-mono text-xs text-muted">{site.domain}</div>}
      {showReview && site.needsReview && (
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-warn-text">
          <Warning size={12} weight="bold" aria-hidden />
          需复核
        </div>
      )}
    </td>
  );
}

function VisitCell({ site }: { site: Site }) {
  return (
    <td className={`${tdClass} text-right`}>
      <a
        href={site.submitUrl}
        target="_blank"
        rel="nofollow noopener noreferrer"
        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs text-muted hover:text-fg"
      >
        访问
        <ArrowSquareOut size={14} aria-hidden />
        <span className="sr-only">{siteTitle(site)}（新窗口打开）</span>
      </a>
    </td>
  );
}

type Extra = { view: View; product?: string; status?: ListingStatus | "" };

function hrefFor(basePath: string, query: SiteQuery, extra: Extra, page: number) {
  const p = new URLSearchParams();
  if (extra.view === "product") p.set("view", "product");
  if (extra.product) p.set("product", extra.product);
  if (extra.status) p.set("status", extra.status);
  if (query.q) p.set("q", query.q);
  if (query.pricing) p.set("pricing", query.pricing);
  if (query.login) p.set("login", query.login);
  if (query.verification) p.set("verification", query.verification);
  if (query.backlink) p.set("backlink", query.backlink);
  if (query.mode) p.set("mode", query.mode);
  if (query.launch) p.set("launch", "1");
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `${basePath}?${s}` : basePath;
}

function Tabs({ basePath, view, productId }: { basePath: string; view: View; productId?: string }) {
  const tabs: { key: View; label: string; href: string }[] = [
    { key: "all", label: "全部站点", href: basePath },
    {
      key: "product",
      label: "按产品查看",
      href: `${basePath}?view=product${productId ? `&product=${productId}` : ""}`,
    },
  ];
  return (
    <nav aria-label="站点库视图" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={view === t.key ? "page" : undefined}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            view === t.key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export async function SiteLibrary({ searchParams, basePath, context }: Props) {
  const params = await searchParams;
  const first = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const view: View = first("view") === "product" ? "product" : "all";
  const query = parseSiteQuery(params);
  if (view === "all") query.verification = "";
  const product =
    view === "product" ? (context.products.find((p) => p.id === first("product")) ?? context.products[0]) : undefined;
  const statusParam = first("status");
  const status: ListingStatus | "" =
    product && LISTING_STATUSES.includes(statusParam as ListingStatus) ? (statusParam as ListingStatus) : "";
  const extra: Extra = { view, product: product?.id, status };

  if (view === "product" && !product) {
    return (
      <div className="space-y-4">
        <Tabs basePath={basePath} view={view} />
        <div className="rounded-xl border border-line bg-card px-5 py-12 text-center text-sm text-muted">
          <p>还没有产品档案。新建产品后，可以在这里查看它在每个站点的提交状态。</p>
          <Link href="/dashboard/products/new" className={`${btnPrimary} mt-4`}>
            <Plus size={16} weight="bold" aria-hidden />
            新建产品
          </Link>
        </div>
      </div>
    );
  }

  const statusOf = (s: Site): ListingStatus => product?.statuses[s.domain] ?? "not_submitted";
  const all = await getSites();
  const filtered = filterSites(all, query).filter((s) => !status || statusOf(s) === status);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Tabs basePath={basePath} view={view} productId={product?.id} />

      <form
        action={basePath}
        method="get"
        role="search"
        aria-label="筛选站点"
        className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-12"
      >
        {view === "product" && <input type="hidden" name="view" value="product" />}
        {product && (
          <>
            <div className="lg:col-span-3">
              <label htmlFor="f-product" className="text-xs text-muted">
                产品
              </label>
              <select id="f-product" name="product" defaultValue={product.id} className={`mt-1 ${fieldClass}`}>
                {context.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label htmlFor="f-status" className="text-xs text-muted">
                产品状态
              </label>
              <select id="f-status" name="status" defaultValue={status} className={`mt-1 ${fieldClass}`}>
                <option value="">全部</option>
                {LISTING_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {listingLabel(v)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className={product ? "lg:col-span-6" : "lg:col-span-4"}>
          <label htmlFor="f-q" className="text-xs text-muted">
            搜索
          </label>
          <div className="relative mt-1">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              id="f-q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="域名、站点名或分类"
              className={`${fieldClass} pl-9`}
            />
          </div>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="f-pricing" className="text-xs text-muted">
            定价
          </label>
          <select id="f-pricing" name="pricing" defaultValue={query.pricing} className={`mt-1 ${fieldClass}`}>
            <option value="">全部</option>
            {PRICING.map((v) => (
              <option key={v} value={v}>
                {pricingLabel[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="f-login" className="text-xs text-muted">
            登录方式
          </label>
          <select id="f-login" name="login" defaultValue={query.login} className={`mt-1 ${fieldClass}`}>
            <option value="">全部</option>
            {LOGIN_METHODS.map((v) => (
              <option key={v} value={v}>
                {loginLabel[v]}
              </option>
            ))}
          </select>
        </div>
        {product && (
          <div className="lg:col-span-2">
            <label htmlFor="f-verification" className="text-xs text-muted">
              验证状态
            </label>
            <select
              id="f-verification"
              name="verification"
              defaultValue={query.verification}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">全部</option>
              {VERIFICATION.map((v) => (
                <option key={v} value={v}>
                  {verificationLabel[v]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="lg:col-span-2">
          <label htmlFor="f-backlink" className="text-xs text-muted">
            反链要求
          </label>
          <select id="f-backlink" name="backlink" defaultValue={query.backlink} className={`mt-1 ${fieldClass}`}>
            <option value="">全部</option>
            <option value="no">不要求反链</option>
            <option value="yes">要求反链 / 徽章</option>
          </select>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="f-mode" className="text-xs text-muted">
            提交方式
          </label>
          <select id="f-mode" name="mode" defaultValue={query.mode} className={`mt-1 ${fieldClass}`}>
            <option value="">全部</option>
            {SUBMIT_MODES.map((v) => (
              <option key={v} value={v}>
                {submitModeLabel[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-12">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="launch"
              value="1"
              defaultChecked={query.launch}
              className="size-4 cursor-pointer accent-accent"
            />
            只看支持打榜的站点
          </label>
          <div className="flex gap-2">
            <Link
              href={product ? `${basePath}?view=product&product=${product.id}` : basePath}
              className={btnSecondary}
            >
              重置
            </Link>
            <button type="submit" className={btnPrimary}>
              <Funnel size={16} weight="bold" aria-hidden />
              筛选
            </button>
          </div>
        </div>
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        共 <span className="font-mono text-fg">{filtered.length}</span> 个站点
        {filtered.length !== all.length && <>（全部 {all.length} 个）</>}
        {pages > 1 && (
          <>
            ，第 <span className="font-mono text-fg">{page}</span> / {pages} 页
          </>
        )}
      </p>

      <div className="relative overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="text-left text-xs text-muted">
            {view === "all" ? (
              <tr className="border-b border-line">
                <th scope="col" className={thClass}>站点</th>
                <th scope="col" className={thClass}>状态</th>
                <th scope="col" className={thClass}>提交方式</th>
                <th scope="col" className={thClass}>定价</th>
                <th scope="col" className={thClass}>登录方式</th>
                <th scope="col" className={thClass}>分类</th>
                <th scope="col" className={thClass}>提交要求</th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">提交入口</span>
                </th>
              </tr>
            ) : (
              <tr className="border-b border-line">
                <th scope="col" className={thClass}>站点</th>
                <th scope="col" className={thClass}>{product?.name}</th>
                <th scope="col" className={thClass}>定价</th>
                <th scope="col" className={thClass}>登录</th>
                <th scope="col" className={thClass}>要求</th>
                <th scope="col" className={thClass}>审核时长</th>
                <th scope="col" className={thClass}>验证状态</th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">提交入口</span>
                </th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => {
              const siteStatus = s.needsReview ? "needs_review" : "active";
              return view === "all" ? (
                <tr key={s.domain} className="transition-colors duration-150 hover:bg-surface">
                  <SiteCell site={s} showReview={false} />
                  <td className={tdClass}>
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${siteStatusTone[siteStatus]}`}
                    >
                      {siteStatusLabel[siteStatus]}
                    </span>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>{submitModeLabel[s.submitMode]}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{pricingLabel[s.pricing]}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{loginLabel[s.loginMethod]}</td>
                  <td className={`${tdClass} text-muted`}>{s.category || "—"}</td>
                  <td className={tdClass}>
                    <Requirements site={s} withMode={false} />
                  </td>
                  <VisitCell site={s} />
                </tr>
              ) : (
                <tr key={s.domain} className="transition-colors duration-150 hover:bg-surface">
                  <SiteCell site={s} showReview />
                  <td className={tdClass}>
                    <ListingBadge status={statusOf(s)} />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>{pricingLabel[s.pricing]}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{loginLabel[s.loginMethod]}</td>
                  <td className={tdClass}>
                    <Requirements site={s} withMode />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-muted`}>{s.reviewTime || "—"}</td>
                  <td className={tdClass}>
                    <VerificationBadge value={s.verification} />
                  </td>
                  <VisitCell site={s} />
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                  {all.length === 0 ? "站点库正在整理中，稍后再来看看。" : "没有符合条件的站点，试试放宽筛选条件。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} href={(n) => hrefFor(basePath, query, extra, n)} />
    </div>
  );
}

export function SiteLibrarySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="正在加载站点">
      <div className="h-10 w-64 animate-pulse rounded bg-raised" />
      <div className="h-40 animate-pulse rounded-xl border border-line bg-card" />
      <div className="h-4 w-32 animate-pulse rounded bg-raised" />
      <div className="h-96 animate-pulse rounded-xl border border-line bg-card" />
    </div>
  );
}
