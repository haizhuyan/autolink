import Link from "next/link";
import { ShieldCheck, SignOut } from "@phosphor-icons/react/ssr";
import { logout } from "@/app/actions/auth";
import { btnGhost } from "@/components/button-styles";
import { getCurrentUser } from "@/lib/dal";

export async function UserMenu({ showAdminLink = true }: { showAdminLink?: boolean }) {
  const user = await getCurrentUser();
  const initial = user.email.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {showAdminLink && user.role === "admin" && (
        <Link href="/admin" className={btnGhost}>
          <ShieldCheck size={18} aria-hidden />
          <span className="hidden sm:inline">管理后台</span>
        </Link>
      )}
      <span
        className="grid size-8 place-items-center rounded-full bg-raised font-mono text-sm font-semibold"
        aria-hidden
      >
        {initial}
      </span>
      <span className="hidden max-w-48 truncate text-sm text-muted sm:inline" title={user.email}>
        {user.email}
      </span>
      <form action={logout}>
        <button type="submit" className={btnGhost}>
          <SignOut size={18} aria-hidden />
          退出
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="size-8 animate-pulse rounded-full bg-raised" />
      <span className="hidden h-4 w-36 animate-pulse rounded bg-raised sm:inline-block" />
    </div>
  );
}
