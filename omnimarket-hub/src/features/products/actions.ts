"use server";

import { revalidatePath } from "next/cache";
import {
  createProductSchema,
  deleteProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type DeleteProductInput,
  type UpdateProductInput,
} from "@/features/products/schemas";
import type { ActionResult } from "@/lib/action-result";
import { invalidInput, runAction } from "@/server/action-utils";
import * as productsDal from "@/server/dal/products";
import { requireSession } from "@/server/session";

// No invalidan `analytics`: las métricas usan el snapshot de precio/costo de
// cada pedido, así que editar el catálogo no las cambia. Sí refrescan las
// páginas que muestran el catálogo (listado y selector del nuevo pedido).
// Errores de dominio: INVALID_INPUT, SKU_TAKEN, PRODUCT_NOT_FOUND,
// INSUFFICIENT_STOCK (ajuste negativo mayor al stock disponible) y
// PRODUCT_IN_USE (eliminar un producto con ventas).

function revalidateCatalogPages() {
  revalidatePath("/products");
  revalidatePath("/orders/new");
}

export async function createProduct(input: CreateProductInput): Promise<ActionResult<productsDal.ProductRow>> {
  await requireSession();

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const product = await productsDal.createProduct(parsed.data);
    revalidateCatalogPages();
    return product;
  });
}

export async function updateProduct(input: UpdateProductInput): Promise<ActionResult<productsDal.ProductRow>> {
  await requireSession();

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const product = await productsDal.updateProduct(parsed.data);
    revalidateCatalogPages();
    return product;
  });
}

/** Elimina un producto sin ventas; con ventas responde PRODUCT_IN_USE. */
export async function deleteProduct(input: DeleteProductInput): Promise<ActionResult<{ id: string; sku: string }>> {
  await requireSession();

  const parsed = deleteProductSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const product = await productsDal.deleteProduct(parsed.data.id);
    revalidateCatalogPages();
    return product;
  });
}
