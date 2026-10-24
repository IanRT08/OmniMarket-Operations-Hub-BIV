import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/input";
import { ProductsTable } from "@/features/products/components/products-table";
import { productListQuerySchema } from "@/features/products/schemas";
import { listProducts } from "@/server/dal/products";

export const metadata: Metadata = { title: "Productos" };

// Catálogo renderizado en el servidor. La búsqueda es un <Form> GET de Next:
// navega en el cliente a /products?q=… y loading.tsx muestra el skeleton.
export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const parsed = productListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : productListQuerySchema.parse({});
  const products = await listProducts(query);

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo con precio, costo, margen e inventario disponible."
        action={
          <Link href="/products/new" className={buttonClasses()}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo producto
          </Link>
        }
      />

      <Form action="/products" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          <Label htmlFor="products-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <Input id="products-search" type="search" name="q" defaultValue={query.q} placeholder="SKU o nombre" className="pl-9" />
          </div>
        </div>
        <label htmlFor="includeInactive" className="flex h-10 items-center gap-2 text-sm text-ink">
          <Checkbox id="includeInactive" name="includeInactive" value="true" defaultChecked={query.includeInactive} />
          Incluir inactivos
        </label>
        <button type="submit" className={buttonClasses({ variant: "outline" })}>
          Buscar
        </button>
      </Form>

      <ProductsTable products={products} />
    </>
  );
}
