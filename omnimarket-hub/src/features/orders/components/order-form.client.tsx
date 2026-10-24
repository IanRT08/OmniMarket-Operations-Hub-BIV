"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { createOrder } from "@/features/orders/actions";
import {
  createOrderSchema,
  ORDER_MAX_ITEMS,
  type CreateOrderData,
  type CreateOrderInput,
} from "@/features/orders/schemas";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { formatCurrency } from "@/lib/currency";
import { formatNumber } from "@/lib/format";
import { mutationKeys, queryKeys } from "@/lib/query-keys";
import type { ProductOption } from "@/server/dal/products";

const EMPTY_ITEM = { productId: "", quantity: 1 };

type FieldErrors = { fieldErrors?: Record<string, string[] | undefined> };

export function OrderForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const productsById = new Map(products.map((product) => [product.id, product]));

  const form = useForm<CreateOrderInput, unknown, CreateOrderData>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { customerName: "", customerEmail: "", items: [EMPTY_ITEM] },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const { errors } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });

  const lines = items.map((item) => {
    const product = productsById.get(item.productId);
    const quantity = Number.isFinite(item.quantity) ? Number(item.quantity) : 0;
    return { product, quantity, subtotalCents: product ? product.priceCents * quantity : 0 };
  });
  const totalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const chosen = new Set(items.map((item) => item.productId).filter(Boolean));

  const mutation = useMutation({
    mutationKey: mutationKeys.createOrder,
    mutationFn: async (data: CreateOrderData) => unwrapAction(await createOrder(data)),
    onSuccess: (order) => {
      toast.success(`Pedido ${order.orderNumber} creado`, {
        description: `${formatCurrency(order.totalCents)} · aparece al inicio de la tabla y en Pendiente del Kanban.`,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanban.all });
      router.push("/orders");
    },
    onError: (error) => {
      if (error instanceof ActionFailure && error.code === "INVALID_INPUT") {
        // Errores de validación del servidor sobre los mismos campos del formulario.
        const fieldErrors = (error.error.details as FieldErrors | undefined)?.fieldErrors ?? {};
        Object.entries(fieldErrors).forEach(([field, messages]) =>
          setError(field as FieldPath<CreateOrderInput>, { message: messages?.[0] }),
        );
      }
      toast.error("No se pudo crear el pedido", {
        description:
          error instanceof ActionFailure ? error.message : "Revisa tu conexión e inténtalo de nuevo.",
      });
    },
  });

  function onSubmit(data: CreateOrderData) {
    // Aviso temprano de stock (el servidor lo vuelve a validar con lock).
    const short = data.items.findIndex((item) => item.quantity > (productsById.get(item.productId)?.stock ?? 0));
    if (short >= 0) {
      const product = productsById.get(data.items[short].productId);
      setError(`items.${short}.quantity`, { message: `Solo hay ${formatNumber(product?.stock ?? 0)} en stock` });
      return;
    }
    mutation.mutate(data);
  }

  const pending = mutation.isPending || mutation.isSuccess;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-3xl flex-col gap-6">
      <fieldset disabled={pending} className="flex flex-col gap-6">
        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-ink">Cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customerName">Nombre</Label>
              <Input
                id="customerName"
                autoComplete="name"
                aria-invalid={Boolean(errors.customerName)}
                aria-describedby="customerName-error"
                {...register("customerName")}
              />
              <FieldError id="customerName-error" message={errors.customerName?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.customerEmail)}
                aria-describedby="customerEmail-error"
                {...register("customerEmail")}
              />
              <FieldError id="customerEmail-error" message={errors.customerEmail?.message} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Productos</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => append(EMPTY_ITEM)}
              disabled={fields.length >= ORDER_MAX_ITEMS || chosen.size >= products.length}
            >
              <Plus className="size-4" aria-hidden="true" />
              Agregar producto
            </Button>
          </div>

          <ul className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const line = lines[index];
              return (
                <li key={field.id} className="grid grid-cols-[1fr_7rem_7rem_auto] items-start gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`items.${index}.productId`} className={index > 0 ? "sr-only" : undefined}>
                      Producto
                    </Label>
                    <Select
                      id={`items.${index}.productId`}
                      aria-invalid={Boolean(itemErrors?.productId)}
                      aria-describedby={`items.${index}.productId-error`}
                      {...register(`items.${index}.productId`)}
                    >
                      <option value="">Elige un producto…</option>
                      {products.map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                          // Sin stock, o ya elegido en otra partida (el esquema exige productos únicos).
                          disabled={
                            product.stock === 0 || (chosen.has(product.id) && items[index]?.productId !== product.id)
                          }
                        >
                          {product.name} · {formatCurrency(product.priceCents)} ·{" "}
                          {product.stock === 0 ? "agotado" : `${formatNumber(product.stock)} disp.`}
                        </option>
                      ))}
                    </Select>
                    <FieldError id={`items.${index}.productId-error`} message={itemErrors?.productId?.message} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`items.${index}.quantity`} className={index > 0 ? "sr-only" : undefined}>
                      Cantidad
                    </Label>
                    <Input
                      id={`items.${index}.quantity`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={line?.product?.stock}
                      aria-invalid={Boolean(itemErrors?.quantity)}
                      aria-describedby={`items.${index}.quantity-error`}
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                    <FieldError id={`items.${index}.quantity-error`} message={itemErrors?.quantity?.message} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className={index > 0 ? "sr-only" : "text-sm font-medium text-ink"}>Subtotal</span>
                    <span className="flex h-10 items-center justify-end text-sm font-semibold tabular-nums text-ink">
                      {formatCurrency(line?.subtotalCents ?? 0)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className={index > 0 ? "sr-only" : "invisible text-sm"} aria-hidden="true">
                      Quitar
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label={`Quitar producto ${index + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <FieldError id="items-error" message={errors.items?.message ?? errors.items?.root?.message} />

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
            <span className="text-sm text-ink-muted">Total del pedido</span>
            <span className="text-xl font-semibold tabular-nums text-brand-moss" data-testid="order-total">
              {formatCurrency(totalCents)}
            </span>
          </div>
        </section>
      </fieldset>

      <div className="flex items-center justify-end gap-3">
        <Link href="/orders" className={buttonClasses({ variant: "ghost" })}>
          Cancelar
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creando pedido…" : "Crear pedido"}
        </Button>
      </div>
    </form>
  );
}
