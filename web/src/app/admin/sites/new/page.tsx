import type { Metadata } from "next";
import { PageHeader } from "../../ui";
import { SiteForm } from "../site-form";

export const metadata: Metadata = {
  title: "新增站点",
};

export default function NewSitePage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="新增站点" desc="新站点默认状态为正常，会立即出现在公开站点库中。" />
      <SiteForm site={null} />
    </div>
  );
}
