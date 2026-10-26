"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { updateOrder } from "@/features/orders/actions";
import { orderEditFormSchema, type OrderEditFormInput } from "@/features/orders/schemas";
import { OrderStatus } from "@/generated/prisma/enums";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { ORDER_STATUS_FLOW, statusLabel } from "@/lib/order-status";
import { mutationKeys, queryKeys } from "@/lib/query-keys";
import type { OrderDetail } from "@/server/dal/orders";

type FieldErrors = { fieldErrors?: Record<string, string[] | undefined> };

/**
 * Edición de cliente y estado. Envía la `version` que se leyó: si otro
 * usuario cambió el pedido mientras tanto, el servidor responde
 * VERSION_CONFLICT y la página se recarga con los datos actuales.
 */
export function OrderEditForm({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, setError, formState } = useForm<OrderEditFormInput>({
    resolver: zodResolver(orderEditFormSchema),
    defaultValues: { customerName: order.customerName, customerEmail: order.customerEmail, status: order.status },
  });
  const { errors } = formState;
  const status = useWatch({ control, name: "status" });

  const mutation = useMutation({
    mutationKey: mutationKeys.updateOrder,
    mutationFn: async (data: OrderEditFormInput) =>
      unwrapAction(await updateOrder({ ...data, orderId: order.id, version: order.version })),
    onSuccess: (updated) => {
      toast.success(`Pedido ${updated.orderNumber} actualizado`, {
        description: `${updated.customerName} · ${statusLabel(updated.status)}`,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanban.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      router.push("/orders");
    },
    onError: (error) => {
      if (error instanceof ActionFailure && error.code === "INVALID_INPUT") {
        const fieldErrors = (error.error.details as FieldErrors | undefined)?.fieldErrors ?? {};
        Object.entries(fieldErrors).forEach(([field, messages]) =>
          setError(field as FieldPath<OrderEditFormInput>, { message: messages?.[0] }),
        );
      }
      toast.error(`No se pudo actualizar ${order.orderNumber}`, {
        description: error instanceof ActionFailure ? error.message : "Revisa tu conexión e inténtalo de nuevo.",
      });
      // El formulario lleva key={version}: al recargar se monta con lo actual.
      if (error instanceof ActionFailure && error.code === "VERSION_CONFLICT") router.refresh();
    },
  });

  const pending = mutation.isPending || mutation.isSuccess;
  const statusNote =
    status === order.status
      ? null
      : status === OrderStatus.CANCELLED
        ? "Al cancelarlo, su stock regresa al inventario y deja de contar en las métricas."
        : order.status === OrderStatus.CANCELLED
          ? "Al reactivarlo se vuelve a descontar el stock (si alcanza) y cuenta otra vez en las métricas."
          : "Se moverá al final de esa columna del Kanban.";

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate className="flex flex-col gap-6">
      <fieldset disabled={pending} className="rounded-xl border border-border bg-white p-5">
        <legend className="sr-only">Datos del pedido</legend>
        <h2 className="mb-4 text-base font-semibold text-ink">Cliente y estado</h2>
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
          <div className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-xs">
            <Label htmlFor="status">Estado</Label>
            <Select id="status" aria-describedby="status-note status-error" {...register("status")}>
              {ORDER_STATUS_FLOW.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
            {statusNote && (
              <p id="status-note" className="text-xs text-ink-muted">
                {statusNote}
              </p>
            )}
            <FieldError id="status-error" message={errors.status?.message} />
          </div>
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-3">
        <Link href="/orders" className={buttonClasses({ variant: "ghost" })}>
          Cancelar
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando cambios…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
