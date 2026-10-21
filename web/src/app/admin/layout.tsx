import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { btnGhost } from "@/components/button-styles";
import { Logo } from "@/components/logo";
import { requireAdmin } from "@/lib/dal";
import { UserMenu, UserMenuSkeleton } from "../dashboard/user-menu";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: { template: "%s · 管理后台", default: "管理后台" },
  robots: { index: false, follow: false },
};

/** 非管理员一律 404；各页面的数据请求也会再次校验 */
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}

function ContentSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-8 w-48 animate-pulse rounded bg-raised" />
      <div className="h-64 animate-pulse rounded-lg border border-line bg-card" />
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <Logo href="/admin" />
          <span className="rounded bg-fg px-1.5 py-0.5 text-[10px] font-medium text-bg">后台</span>
        </div>
        <nav aria-label="后台导航" className="flex-1 overflow-y-auto px-3 py-4">
          <AdminNav direction="column" />
        </nav>
        <div className="p-3">
          <Link href="/dashboard" className={`${btnGhost} w-full justify-start`}>
            <ArrowLeft size={18} aria-hidden />
            返回控制台
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <Logo href="/admin" />
              <span className="rounded bg-fg px-1.5 py-0.5 text-[10px] font-medium text-bg">后台</span>
            </div>
            <Link href="/dashboard" className={`${btnGhost} hidden lg:inline-flex`}>
              <ArrowLeft size={18} aria-hidden />
              返回控制台
            </Link>
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu showAdminLink={false} />
            </Suspense>
          </div>
          <nav aria-label="后台导航" className="border-t border-line px-2 py-2 lg:hidden">
            <AdminNav direction="row" />
          </nav>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Suspense fallback={<ContentSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
