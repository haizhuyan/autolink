"use client";

import { ClockCounterClockwise, Database, Package, SquaresFour, Users } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const items = [
  { label: "概览", href: "/admin", Icon: SquaresFour },
  { label: "站点", href: "/admin/sites", Icon: Database },
  { label: "用户", href: "/admin/users", Icon: Users },
  { label: "产品", href: "/admin/products", Icon: Package },
  { label: "审计日志", href: "/admin/audit", Icon: ClockCounterClockwise },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

type Direction = "row" | "column";

// usePathname 在动态路由里只能在运行时取得，需放在 Suspense 内；预渲染时先输出无高亮的导航
export function AdminNav({ direction }: { direction: Direction }) {
  return (
    <Suspense fallback={<NavList direction={direction} pathname={null} />}>
      <ActiveNav direction={direction} />
    </Suspense>
  );
}

function ActiveNav({ direction }: { direction: Direction }) {
  return <NavList direction={direction} pathname={usePathname()} />;
}

function NavList({ direction, pathname }: { direction: Direction; pathname: string | null }) {
  return (
    <ul className={direction === "row" ? "flex gap-1 overflow-x-auto" : "space-y-1"}>
      {items.map(({ label, href, Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200 ${
                active ? "bg-accent/10 font-medium text-accent-text" : "text-muted hover:bg-raised/60 hover:text-fg"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
