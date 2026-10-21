"use client";

import { useActionState } from "react";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { deleteSite } from "@/app/actions/admin";

export function DeleteSiteButton({
  id,
  domain,
  backToList = false,
  className,
}: {
  id: number;
  domain: string;
  backToList?: boolean;
  className: string;
}) {
  const [state, action, pending] = useActionState(deleteSite.bind(null, id, backToList), undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`确定删除站点 ${domain}？删除后无法恢复。`)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      <button type="submit" disabled={pending} className={className}>
        {pending ? <CircleNotch size={14} className="animate-spin" aria-hidden /> : <Trash size={14} aria-hidden />}
        删除
      </button>
      {state?.message && !state.ok && (
        <span role="alert" className="max-w-48 text-xs text-danger-text">
          {state.message}
        </span>
      )}
    </form>
  );
}
