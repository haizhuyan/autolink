import type { Metadata } from "next";
import { PageHeader } from "../../ui";
import { UserForm } from "../user-form";

export const metadata: Metadata = {
  title: "新增用户",
};

export default function NewUserPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="新增用户" desc="创建后把邮箱和初始密码通过安全渠道发给用户。" />
      <UserForm user={null} />
    </div>
  );
}
