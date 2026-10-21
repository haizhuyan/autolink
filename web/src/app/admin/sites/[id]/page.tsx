import type { Metadata } from "next";
import { Suspense } from "react";
import { btnDanger } from "@/components/button-styles";
import { getAdminSite, idParam } from "@/lib/admin";
import { formatTime } from "@/lib/admin-labels";
import { PageHeader } from "../../ui";
import { DeleteSiteButton } from "../delete-site-button";
import { SiteForm } from "../site-form";

export const metadata: Metadata = {
  title: "编辑站点",
};

async function EditSite({ params }: Pick<PageProps<"/admin/sites/[id]">, "params">) {
  const site = await getAdminSite(idParam((await params).id));
  return (
    <>
      <PageHeader
        title={site.domain}
        desc={<>更新于 {formatTime(site.updatedAt)}</>}
        actions={<DeleteSiteButton id={site.id} domain={site.domain} backToList className={btnDanger} />}
      />
      <SiteForm site={site} />
    </>
  );
}

export default function EditSitePage({ params }: PageProps<"/admin/sites/[id]">) {
  return (
    <div className="max-w-4xl space-y-6">
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-lg border border-line bg-card" />}>
        <EditSite params={params} />
      </Suspense>
    </div>
  );
}
