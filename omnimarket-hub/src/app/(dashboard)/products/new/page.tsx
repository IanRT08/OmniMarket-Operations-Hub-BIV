import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/features/products/components/product-form.client";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        title="Nuevo producto"
        description="Captura los precios en pesos; se guardan en centavos para evitar errores de redondeo."
      />
      <ProductForm />
    </>
  );
}
