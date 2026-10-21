"use client";

import { CaretUpDown, Check, Lock, Plus, SquaresFour } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  products: { id: string; name: string }[];
  canCreate: boolean;
  limit: number;
};

export function ProductSwitcher({ products, canCreate, limit }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);

  // 路由变化时收起菜单
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentId = pathname.match(/^\/dashboard\/products\/([^/]+)/)?.[1];
  const current = products.find((p) => p.id === currentId);
  const item =
    "flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-raised";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-44 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm transition-colors duration-200 hover:bg-raised"
      >
        <span className="grid size-5 place-items-center rounded bg-accent/10 font-mono text-[11px] font-bold text-accent-text">
          {current ? current.name.charAt(0).toUpperCase() : <SquaresFour size={12} weight="bold" aria-hidden />}
        </span>
        <span className="max-w-40 truncate font-medium">{current?.name ?? "全部产品"}</span>
        <CaretUpDown size={14} className="ml-auto text-muted" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="切换产品"
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-line bg-card p-1 shadow-lg shadow-slate-900/10"
        >
          <Link role="menuitem" href="/dashboard/products" className={item}>
            <SquaresFour size={16} className="text-muted" aria-hidden />
            全部产品
            {!current && <Check size={14} weight="bold" className="ml-auto text-accent-text" aria-hidden />}
          </Link>
          <div className="my-1 border-t border-line" role="separator" />
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-muted">
            产品 {products.length} / {limit}
          </p>
          {products.map((p) => (
            <Link key={p.id} role="menuitem" href={`/dashboard/products/${p.id}`} className={item}>
              <span className="grid size-5 place-items-center rounded bg-raised font-mono text-[11px] font-bold">
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{p.name}</span>
              {p.id === currentId && <Check size={14} weight="bold" className="ml-auto text-accent-text" aria-hidden />}
            </Link>
          ))}
          <div className="my-1 border-t border-line" role="separator" />
          {canCreate ? (
            <Link role="menuitem" href="/dashboard/products/new" className={item}>
              <Plus size={16} aria-hidden />
              新建产品
            </Link>
          ) : (
            <Link role="menuitem" href="/#pricing" className={`${item} text-muted`}>
              <Lock size={16} aria-hidden />
              已达产品上限，升级套餐
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
