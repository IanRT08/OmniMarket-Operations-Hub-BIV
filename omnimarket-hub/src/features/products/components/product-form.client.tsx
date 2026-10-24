"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label } from "@/components/ui/input";
import { createProduct } from "@/features/products/actions";
import { productFormSchema, type CreateProductInput, type ProductFormInput } from "@/features/products/schemas";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { formatCurrency, pesosToCents } from "@/lib/currency";
import { grossMarginRatio } from "@/lib/finance";
import { formatPercent } from "@/lib/format";
import { mutationKeys } from "@/lib/query-keys";

// Campos de la Server Action (centavos) → campos del formulario (pesos).
const SERVER_TO_FORM_FIELD: Record<string, FieldPath<ProductFormInput>> = {
  priceCents: "price",
  costCents: "cost",
  sku: "sku",
  name: "name",
  stock: "stock",
};

type FieldErrors = { fieldErrors?: Record<string, string[] | undefined> };

export function ProductForm() {
  const router = useRouter();
  const { register, control, handleSubmit, setError, formState } = useForm<ProductFormInput, unknown, CreateProductInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { sku: "", name: "", stock: 0, isActive: true },
  });
  const { errors } = formState;

  const [price, cost] = useWatch({ control, name: ["price", "cost"] });
  const priceCents = Number.isFinite(price) ? pesosToCents(price) : 0;
  const costCents = Number.isFinite(cost) ? pesosToCents(cost) : 0;
  const margin = grossMarginRatio(priceCents, costCents);

  const mutation = useMutation({
    mutationKey: mutationKeys.createProduct,
    mutationFn: async (data: CreateProductInput) => unwrapAction(await createProduct(data)),
    onSuccess: (product) => {
      toast.success(`Producto ${product.sku} creado`, { description: product.name });
      router.push("/products");
    },
    onError: (error) => {
      if (error instanceof ActionFailure && error.code === "SKU_TAKEN") {
        setError("sku", { message: error.message });
      } else if (error instanceof ActionFailure && error.code === "INVALID_INPUT") {
        const fieldErrors = (error.error.details as FieldErrors | undefined)?.fieldErrors ?? {};
        Object.entries(fieldErrors).forEach(([field, messages]) => {
          const formField = SERVER_TO_FORM_FIELD[field];
          if (formField) setError(formField, { message: messages?.[0] });
        });
      }
      toast.error("No se pudo crear el producto", {
        description: error instanceof ActionFailure ? error.message : "Revisa tu conexión e inténtalo de nuevo.",
      });
    },
  });

  const pending = mutation.isPending || mutation.isSuccess;

  const field = (name: keyof ProductFormInput) => ({
    id: name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": `${name}-error`,
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate className="flex max-w-3xl flex-col gap-6">
      <fieldset disabled={pending} className="flex flex-col gap-6">
        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">Datos del producto</h2>
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input {...field("sku")} placeholder="OM-ABC-013" className="font-mono uppercase" {...register("sku")} />
              <FieldError id="sku-error" message={errors.sku?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input {...field("name")} {...register("name")} />
              <FieldError id="name-error" message={errors.name?.message} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">Precio e inventario</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">Precio de venta (MXN)</Label>
              <Input {...field("price")} type="number" inputMode="decimal" step="0.01" min={0} {...register("price", { valueAsNumber: true })} />
              <FieldError id="price-error" message={errors.price?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">Costo (MXN)</Label>
              <Input {...field("cost")} type="number" inputMode="decimal" step="0.01" min={0} {...register("cost", { valueAsNumber: true })} />
              <FieldError id="cost-error" message={errors.cost?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock">Stock inicial</Label>
              <Input {...field("stock")} type="number" inputMode="numeric" min={0} {...register("stock", { valueAsNumber: true })} />
              <FieldError id="stock-error" message={errors.stock?.message} />
            </div>
          </div>

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-muted">Ganancia por pieza</dt>
              <dd className="font-semibold tabular-nums text-ink">{formatCurrency(priceCents - costCents)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-muted">Margen</dt>
              <dd className={margin < 0 ? "font-semibold text-rose-700" : "font-semibold text-brand-moss"}>
                {formatPercent(margin)}
              </dd>
            </div>
          </dl>

          <label htmlFor="isActive" className="mt-4 flex items-center gap-2 text-sm text-ink">
            <Checkbox id="isActive" {...register("isActive")} />
            Disponible para venta (aparece al crear pedidos)
          </label>
        </section>
      </fieldset>

      <div className="flex items-center justify-end gap-3">
        <Link href="/products" className={buttonClasses({ variant: "ghost" })}>
          Cancelar
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando producto…" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
