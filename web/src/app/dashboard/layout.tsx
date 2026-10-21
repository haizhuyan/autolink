import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/dal";
import { getPlan } from "@/lib/plans";
import { listProducts } from "@/lib/products";
import { NavItems } from "./nav-items";
import { ProductSwitcher } from "./product-switcher";
import { QuotaCard } from "./quota-card";
import { UserMenu, UserMenuSkeleton } from "./user-menu";

export const metadata: Metadata = {
  title: "控制台",
};

async function Switcher() {
  const plan = getPlan((await getCurrentUser()).planId);
  const products = await listProducts();
  return (
    <ProductSwitcher
      products={products.map(({ id, name }) => ({ id, name }))}
      canCreate={products.length < plan.products}
      limit={plan.products}
    />
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const switcher = (
    <Suspense fallback={<div aria-hidden className="h-9 w-44 animate-pulse rounded-md border border-line bg-card" />}>
      <Switcher />
    </Suspense>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href="/dashboard" />
        </div>
        <nav aria-label="控制台导航" className="flex-1 overflow-y-auto px-3 py-4">
          <NavItems direction="column" />
        </nav>
        <div className="p-3">
          <Suspense fallback={<div aria-hidden className="h-28 animate-pulse rounded-lg border border-line bg-card" />}>
            <QuotaCard />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <Logo href="/dashboard" />
              </div>
              <div className="hidden sm:block">{switcher}</div>
            </div>
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
          <div className="border-t border-line px-4 py-2 sm:hidden">{switcher}</div>
          <nav aria-label="控制台导航" className="border-t border-line px-2 py-2 lg:hidden">
            <NavItems direction="row" />
          </nav>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
