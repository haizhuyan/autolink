import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAdminUser, idParam } from "@/lib/admin";
import { formatTime, isLocked } from "@/lib/admin-labels";
import { requireAdmin } from "@/lib/dal";
import { PageHeader } from "../../ui";
import { UserForm } from "../user-form";

export const metadata: Metadata = {
  title: "编辑用户",
};

async function EditUser({ params }: Pick<PageProps<"/admin/users/[id]">, "params">) {
  const [me, user] = await Promise.all([requireAdmin(), params.then(({ id }) => getAdminUser(idParam(id)))]);
  const locked = isLocked(user);
  return (
    <>
      <PageHeader
        title={user.email}
        desc={
          <>
            注册于 {formatTime(user.createdAt)} · 最近登录 {formatTime(user.lastLoginAt)} ·{" "}
            <Link href={`/admin/products?q=${encodeURIComponent(user.email)}`} className="text-accent-text hover:underline">
              {user.productCount} 个产品
            </Link>
            {locked && <> · 登录已锁定至 {formatTime(user.lockedUntil)}</>}
          </>
        }
      />
      <UserForm user={user} isSelf={me.id === String(user.id)} locked={locked} />
    </>
  );
}

export default function EditUserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <div className="max-w-3xl space-y-6">
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-lg border border-line bg-card" />}>
        <EditUser params={params} />
      </Suspense>
    </div>
  );
}
