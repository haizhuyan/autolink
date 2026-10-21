import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Lock } from "@phosphor-icons/react/ssr";
import { btnPrimary } from "@/components/button-styles";
import { getCurrentUser } from "@/lib/dal";
import { getPlan } from "@/lib/plans";
import { countStoredProducts } from "@/lib/products";
import { ProductForm } from "../product-form";

export const metadata: Metadata = {
  title: "新建产品",
};

export default function NewProductPage() {
  return (
    <Suspense fallback={<div aria-hidden className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl border border-line bg-card" />}>
      <NewProduct />
    </Suspense>
  );
}

async function NewProduct() {
  const plan = getPlan((await getCurrentUser()).planId);
  const owned = await countStoredProducts();
  const canCreate = owned < plan.products;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-tight">新建产品</h1>
        <p className="mt-1 text-sm text-muted">
          填一次，之后每次提交自动复用。当前 {owned} / {plan.products} 个产品。
        </p>
      </div>
      {canCreate ? (
        <ProductForm submitLabel="创建产品" cancelHref="/dashboard/products" />
      ) : (
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <Lock size={28} className="mx-auto text-muted" aria-hidden />
          <p className="mt-3 font-semibold">已达到 {plan.name} 套餐的产品上限</p>
          <p className="mt-1 text-sm text-muted">升级套餐后可添加更多产品，已有额度会保留。</p>
          <Link href="/#pricing" className={`${btnPrimary} mt-5`}>
            查看套餐
          </Link>
        </div>
      )}
    </div>
  );
}
