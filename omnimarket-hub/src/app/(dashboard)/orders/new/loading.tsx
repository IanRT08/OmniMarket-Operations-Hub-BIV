import { FormSkeleton } from "@/components/form-skeleton";
import { PageHeader } from "@/components/layout/page-header";

export default function NewOrderLoading() {
  return (
    <>
      <PageHeader
        title="Nuevo pedido"
        description="Los precios se toman del catálogo actual y el stock se descuenta al confirmar."
      />
      <FormSkeleton sections={[2, 2]} />
    </>
  );
}
