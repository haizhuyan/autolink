"use client";

import {
  Database,
  Gear,
  IdentificationCard,
  LinkSimple,
  Package,
  PaperPlaneTilt,
  SquaresFour,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const items = [
  { label: "概览", href: "/dashboard", Icon: SquaresFour },
  { label: "产品档案", href: "/dashboard/products", Icon: Package },
  { label: "站点库", href: "/dashboard/sites", Icon: Database },
  { label: "提交任务", href: null, Icon: PaperPlaneTilt },
  { label: "账号与邮箱", href: null, Icon: IdentificationCard },
  { label: "外链监控", href: null, Icon: LinkSimple },
  { label: "设置", href: null, Icon: Gear },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

type Direction = "row" | "column";

// usePathname 在动态路由里只能在运行时取得，需放在 Suspense 内；预渲染时先输出无高亮的导航
export function NavItems({ direction }: { direction: Direction }) {
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
  const isRow = direction === "row";
  return (
    <ul className={isRow ? "flex gap-1 overflow-x-auto" : "space-y-1"}>
      {items.map(({ label, href, Icon }) => {
        const base = "flex items-center gap-3 rounded-md px-3 py-2 text-sm";
        if (!href) {
          return (
            <li key={label} className="shrink-0">
              <span aria-disabled="true" title="即将上线" className={`${base} cursor-not-allowed text-muted/70`}>
                <Icon size={18} aria-hidden />
                <span className="whitespace-nowrap">{label}</span>
                {!isRow && (
                  <span className="ml-auto rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    即将上线
                  </span>
                )}
              </span>
            </li>
          );
        }
        const active = pathname !== null && isActive(pathname, href);
        return (
          <li key={label} className="shrink-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${base} cursor-pointer transition-colors duration-200 ${
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
