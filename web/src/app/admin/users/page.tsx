import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "@phosphor-icons/react/ssr";
import { btnPrimary } from "@/components/button-styles";
import { Pagination } from "@/components/pagination";
import { listAdminUsers, pageHref, pageParam, param } from "@/lib/admin";
import { ROLES, USER_STATUSES, formatTime, isLocked, roleLabel, userStatusLabel } from "@/lib/admin-labels";
import { getPlan } from "@/lib/plans";
import { Badge, FilterBar, FilterSelect, PageHeader, Table, TableSkeleton, tdClass, thClass } from "../ui";

export const metadata: Metadata = {
  title: "用户",
};

type Props = Pick<PageProps<"/admin/users">, "searchParams">;

async function UsersTable({ searchParams }: Props) {
  const params = await searchParams;
  const filters = {
    q: param(params, "q"),
    role: param(params, "role", ROLES),
    status: param(params, "status", USER_STATUSES),
  };
  const page = pageParam(params);
  const data = await listAdminUsers({ ...filters, page });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <FilterBar action="/admin/users" q={filters.q} placeholder="搜索邮箱或姓名">
        <FilterSelect name="role" label="角色" value={filters.role} options={ROLES.map((r) => [r, roleLabel[r]] as const)} />
        <FilterSelect
          name="status"
          label="状态"
          value={filters.status}
          options={USER_STATUSES.map((s) => [s, userStatusLabel[s]] as const)}
        />
      </FilterBar>
      <p className="text-sm text-muted">共 {data.total} 个用户</p>
      <Table
        colSpan={6}
        empty="没有符合条件的用户"
        head={
          <>
            <th className={thClass}>用户</th>
            <th className={thClass}>角色 / 状态</th>
            <th className={thClass}>套餐</th>
            <th className={`${thClass} text-right`}>产品</th>
            <th className={thClass}>最近登录</th>
            <th className={thClass}>注册时间</th>
          </>
        }
      >
        {data.items.map((u) => {
          const locked = isLocked(u);
          return (
            <tr key={u.id} className="hover:bg-surface/60">
              <td className={tdClass}>
                <Link href={`/admin/users/${u.id}`} className="font-medium text-accent-text hover:underline">
                  {u.email}
                </Link>
                {u.name && <div className="text-xs text-muted">{u.name}</div>}
              </td>
              <td className={tdClass}>
                <div className="flex flex-wrap gap-1">
                  {u.role === "admin" && <Badge tone="bg-accent/10 text-accent-text">{roleLabel.admin}</Badge>}
                  <Badge tone={u.status === "active" ? "bg-success/10 text-success" : "bg-danger/10 text-danger-text"}>
                    {userStatusLabel[u.status]}
                  </Badge>
                  {locked && <Badge tone="bg-warn/10 text-warn-text">已锁定</Badge>}
                </div>
              </td>
              <td className={`${tdClass} whitespace-nowrap`}>{getPlan(u.planId).name}</td>
              <td className={`${tdClass} text-right font-mono`}>{u.productCount}</td>
              <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatTime(u.lastLoginAt)}</td>
              <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatTime(u.createdAt)}</td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pages={pages} href={pageHref("/admin/users", filters)} />
    </>
  );
}

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="用户"
        desc="管理账号、角色与套餐。修改密码、角色或停用后，该用户需要重新登录。"
        actions={
          <Link href="/admin/users/new" className={btnPrimary}>
            <Plus size={16} aria-hidden />
            新增用户
          </Link>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <UsersTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
