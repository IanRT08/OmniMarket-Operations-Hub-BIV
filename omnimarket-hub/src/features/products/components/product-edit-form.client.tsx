"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label } from "@/components/ui/input";
import { updateProduct } from "@/features/products/actions";
import {
  productEditFormSchema,
  type ProductEditFormData,
  type ProductEditFormInput,
} from "@/features/products/schemas";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { formatCurrency, pesosToCents } from "@/lib/currency";
import { grossMarginRatio } from "@/lib/finance";
import { formatNumber, formatPercent } from "@/lib/format";
import { mutationKeys } from "@/lib/query-keys";
import type { ProductRow } from "@/server/dal/products";

// Campos de la Server Action (centavos) → campos del formulario (pesos).
const SERVER_TO_FORM_FIELD: Record<string, FieldPath<ProductEditFormInput>> = {
  name: "name",
  priceCents: "price",
  costCents: "cost",
  stockAdjustment: "stockAdjustment",
};

type FieldErrors = { fieldErrors?: Record<string, string[] | undefined> };

/** Edición de un producto. El SKU es inmutable y el stock se ajusta (+ entrada, − merma). */
export function ProductEditForm({ product }: { product: ProductRow }) {
  const router = useRouter();
  const { register, control, handleSubmit, setError, formState } = useForm<ProductEditFormInput, unknown, ProductEditFormData>({
    resolver: zodResolver(productEditFormSchema),
    defaultValues: {
      name: product.name,
      price: product.priceCents / 100,
      cost: product.costCents / 100,
      stockAdjustment: 0,
      isActive: product.isActive,
    },
  });
  const { errors } = formState;

  const [price, cost, adjustment] = useWatch({ control, name: ["price", "cost", "stockAdjustment"] });
  const priceCents = Number.isFinite(price) ? pesosToCents(price) : 0;
  const costCents = Number.isFinite(cost) ? pesosToCents(cost) : 0;
  const margin = grossMarginRatio(priceCents, costCents);
  const resultingStock = product.stock + (Number.isFinite(adjustment) ? Number(adjustment) : 0);

  const mutation = useMutation({
    mutationKey: mutationKeys.updateProduct,
    mutationFn: async (data: ProductEditFormData) => unwrapAction(await updateProduct({ id: product.id, ...data })),
    onSuccess: (updated) => {
      toast.success(`Producto ${updated.sku} actualizado`, {
        description: `${updated.name} · stock ${formatNumber(updated.stock)}`,
      });
      router.push("/products");
    },
    onError: (error) => {
      if (error instanceof ActionFailure && error.code === "INSUFFICIENT_STOCK") {
        setError("stockAdjustment", { message: error.message });
      } else if (error instanceof ActionFailure && error.code === "INVALID_INPUT") {
        const fieldErrors = (error.error.details as FieldErrors | undefined)?.fieldErrors ?? {};
        Object.entries(fieldErrors).forEach(([field, messages]) => {
          const formField = SERVER_TO_FORM_FIELD[field];
          if (formField) setError(formField, { message: messages?.[0] });
        });
      }
      toast.error(`No se pudo actualizar ${product.sku}`, {
        description: error instanceof ActionFailure ? error.message : "Revisa tu conexión e inténtalo de nuevo.",
      });
    },
  });

  const pending = mutation.isPending || mutation.isSuccess;

  const field = (name: keyof ProductEditFormInput) => ({
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
              <Input id="sku" value={product.sku} readOnly disabled className="font-mono" aria-describedby="sku-hint" />
              <p id="sku-hint" className="text-xs text-ink-muted">
                No se puede cambiar.
              </p>
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
              <Label htmlFor="stockAdjustment">Ajuste de stock</Label>
              <Input
                {...field("stockAdjustment")}
                type="number"
                inputMode="numeric"
                step={1}
                {...register("stockAdjustment", { valueAsNumber: true })}
              />
              <p className="text-xs text-ink-muted">
                Actual {formatNumber(product.stock)} → <span className="font-semibold text-ink">{formatNumber(resultingStock)}</span>
              </p>
              <FieldError id="stockAdjustment-error" message={errors.stockAdjustment?.message} />
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
          <p className="mt-2 text-xs text-ink-muted">
            Cambiar precio o costo no altera pedidos existentes: cada pedido guarda el precio de su venta.
          </p>

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
          {pending ? "Guardando cambios…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
