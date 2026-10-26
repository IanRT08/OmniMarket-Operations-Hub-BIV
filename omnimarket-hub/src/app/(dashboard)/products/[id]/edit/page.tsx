import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { ProductEditForm } from "@/features/products/components/product-edit-form.client";
import { getProduct } from "@/server/dal/products";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  const { id } = await params;
  // Un id que no es UUID haría fallar la consulta (columna uuid): es un 404.
  const product = z.uuid().safeParse(id).success ? await getProduct(id) : null;
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={`Editar ${product.sku}`}
        description="Los precios se capturan en pesos; el stock se ajusta sumando entradas o restando mermas."
      />
      <ProductEditForm product={product} />
    </>
  );
}
