import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { toFormValues } from "@/lib/definitions";
import { getProductRecord } from "@/lib/products";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = {
  title: "编辑产品",
};

export default function EditProductPage({ params }: PageProps<"/dashboard/products/[id]/edit">) {
  return (
    <Suspense fallback={<div aria-hidden className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl border border-line bg-card" />}>
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: Pick<PageProps<"/dashboard/products/[id]/edit">, "params">) {
  const { id } = await params;
  const product = await getProductRecord(id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="面包屑" className="flex items-center gap-1 text-sm text-muted">
        <Link href="/dashboard/products" className="hover:text-fg">
          产品档案
        </Link>
        <CaretRight size={12} aria-hidden />
        <Link href={`/dashboard/products/${product.id}`} className="hover:text-fg">
          {product.name}
        </Link>
        <CaretRight size={12} aria-hidden />
        <span className="text-fg" aria-current="page">
          编辑
        </span>
      </nav>
      <h1 className="font-mono text-2xl font-bold tracking-tight">编辑 {product.name}</h1>
      <ProductForm
        productId={product.id}
        submitLabel="保存修改"
        cancelHref={`/dashboard/products/${product.id}`}
        initial={toFormValues(product)}
        assets={{ logo: product.logo, screenshot: product.screenshot }}
      />
    </div>
  );
}
