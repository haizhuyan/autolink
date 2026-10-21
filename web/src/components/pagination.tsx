import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";

type Props = {
  page: number;
  pages: number;
  href: (page: number) => string;
};

// 首页、末页、当前页前后各 1 页，其余用省略号
function pageItems(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev === 2) items.push(prev + 1);
    else if (prev !== undefined && n - prev > 2) items.push("gap");
    items.push(n);
  });
  return items;
}

const cell =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 font-mono text-sm transition-colors duration-200";

export function Pagination({ page, pages, href }: Props) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="分页" className="flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${cell} gap-1 text-muted hover:bg-raised hover:text-fg`}>
          <CaretLeft size={14} aria-hidden />
          <span className="font-sans">上一页</span>
        </Link>
      ) : (
        <span className={`${cell} gap-1 text-muted opacity-50`} aria-hidden>
          <CaretLeft size={14} />
          <span className="font-sans">上一页</span>
        </span>
      )}
      {pageItems(page, pages).map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className={`${cell} text-muted`} aria-hidden>
            …
          </span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${cell} border border-accent bg-accent/10 text-accent-text`}>
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-label={`第 ${item} 页`}
            className={`${cell} text-muted hover:bg-raised hover:text-fg`}
          >
            {item}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} className={`${cell} gap-1 text-muted hover:bg-raised hover:text-fg`}>
          <span className="font-sans">下一页</span>
          <CaretRight size={14} aria-hidden />
        </Link>
      ) : (
        <span className={`${cell} gap-1 text-muted opacity-50`} aria-hidden>
          <span className="font-sans">下一页</span>
          <CaretRight size={14} />
        </span>
      )}
    </nav>
  );
}
