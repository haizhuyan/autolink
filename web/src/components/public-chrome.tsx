import Link from "next/link";
import { Logo } from "@/components/logo";
import { btnGhost, btnPrimary } from "@/components/button-styles";

const navLinks = [
  { href: "/#features", label: "功能" },
  { href: "/sites", label: "站点库" },
  { href: "/#pricing", label: "定价" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={btnGhost}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sites" className={`${btnGhost} md:hidden`}>
            站点库
          </Link>
          <Link href="/login" className={btnGhost}>
            登录
          </Link>
          <Link href="/login" className={btnPrimary}>
            免费开始
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Logo />
        <nav aria-label="页脚导航" className="flex gap-4">
          <Link href="/sites" className="hover:text-fg">
            站点库
          </Link>
          <Link href="/#pricing" className="hover:text-fg">
            定价
          </Link>
        </nav>
        <p>© AutoLink. 保留所有权利。</p>
      </div>
    </footer>
  );
}
