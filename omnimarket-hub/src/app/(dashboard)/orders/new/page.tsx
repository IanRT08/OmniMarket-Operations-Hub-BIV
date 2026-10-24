import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm } from "@/features/orders/components/order-form.client";
import { getProductOptions } from "@/server/dal/products";

export const metadata: Metadata = { title: "Nuevo pedido" };

// La sesión ya la validó el layout del dashboard; el catálogo se lee directo
// del DAL en el servidor y viaja como props al formulario.
export default async function NewOrderPage() {
  const products = await getProductOptions();

  return (
    <>
      <PageHeader
        title="Nuevo pedido"
        description="Los precios se toman del catálogo actual y el stock se descuenta al confirmar."
      />
      <OrderForm products={products} />
    </>
  );
}
