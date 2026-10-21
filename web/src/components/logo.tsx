import Link from "next/link";
import { LinkSimple } from "@phosphor-icons/react/ssr";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex cursor-pointer items-center gap-2 rounded-md font-mono text-base font-semibold tracking-tight text-fg"
      aria-label="AutoLink 首页"
    >
      <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg">
        <LinkSimple size={16} weight="bold" aria-hidden />
      </span>
      AutoLink
    </Link>
  );
}
