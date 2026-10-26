"use client";

import { useMutation } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog.client";
import { deleteProduct, updateProduct } from "@/features/products/actions";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { mutationKeys } from "@/lib/query-keys";
import type { ProductRow } from "@/server/dal/products";

type ProductRef = Pick<ProductRow, "id" | "sku" | "name" | "isActive">;

const failureMessage = (error: Error) =>
  error instanceof ActionFailure ? error.message : "Revisa tu conexión e inténtalo de nuevo.";

/**
 * Editar y eliminar desde la tabla de productos. Un producto con ventas no
 * se puede borrar (conserva el historial): el toast ofrece desactivarlo.
 */
export function ProductRowActions({ product }: { product: ProductRef }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const deactivate = useMutation({
    mutationKey: mutationKeys.updateProduct,
    mutationFn: async () => unwrapAction(await updateProduct({ id: product.id, isActive: false })),
    onSuccess: () => {
      toast.success(`Producto ${product.sku} desactivado`, { description: "Ya no aparece al crear pedidos." });
      router.refresh();
    },
    onError: (error) => toast.error(`No se pudo desactivar ${product.sku}`, { description: failureMessage(error) }),
  });

  const remove = useMutation({
    mutationKey: mutationKeys.deleteProduct,
    mutationFn: async () => unwrapAction(await deleteProduct({ id: product.id })),
    onSuccess: () => {
      setConfirming(false);
      toast.success(`Producto ${product.sku} eliminado`, { description: product.name });
      router.refresh();
    },
    onError: (error) => {
      setConfirming(false);
      const inUse = error instanceof ActionFailure && error.code === "PRODUCT_IN_USE";
      toast.error(`No se puede eliminar ${product.sku}`, {
        description: failureMessage(error),
        action: inUse && product.isActive ? { label: "Desactivar", onClick: () => deactivate.mutate() } : undefined,
      });
    },
  });

  return (
    <div className="flex justify-end gap-1">
      <Link
        href={`/products/${product.id}/edit`}
        className={buttonClasses({ variant: "ghost", size: "sm" })}
        aria-label={`Editar ${product.sku}`}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Link>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Eliminar ${product.sku}`}>
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`¿Eliminar ${product.sku}?`}
        description={
          <>
            <strong className="text-ink">{product.name}</strong> se eliminará del catálogo. Solo es posible si nunca se
            ha vendido; si tiene pedidos, puedes desactivarlo.
          </>
        }
        confirmLabel="Eliminar producto"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
