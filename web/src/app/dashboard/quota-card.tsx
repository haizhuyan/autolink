import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { getPlan } from "@/lib/plans";
import { listProducts } from "@/lib/products";

export async function QuotaCard() {
  const plan = getPlan((await getCurrentUser()).planId);
  const products = await listProducts();
  const used = products.reduce((sum, p) => sum + p.creditsUsed, 0);
  const pct = plan.credits ? Math.min(100, Math.round((used / plan.credits) * 100)) : 0;

  return (
    <section aria-label="套餐额度" className="rounded-lg border border-line bg-card p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-fg">{plan.name}</span>
        <Link href="/#pricing" className="text-muted hover:text-fg">
          升级
        </Link>
      </div>
      <dl className="mt-3 space-y-2">
        <div className="flex justify-between">
          <dt className="text-muted">产品</dt>
          <dd className="font-mono">
            {products.length} / {plan.products}
          </dd>
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="text-muted">提交额度</dt>
            <dd className="font-mono">{plan.credits ? `${used} / ${plan.credits}` : "不限"}</dd>
          </div>
          {plan.credits && (
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"
              role="progressbar"
              aria-label="提交额度已用"
              aria-valuemin={0}
              aria-valuemax={plan.credits}
              aria-valuenow={used}
            >
              <div className={`h-full rounded-full ${pct >= 90 ? "bg-warn" : "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </dl>
    </section>
  );
}
