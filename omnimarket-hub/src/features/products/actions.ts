"use server";

import { revalidatePath } from "next/cache";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/features/products/schemas";
import type { ActionResult } from "@/lib/action-result";
import { invalidInput, runAction } from "@/server/action-utils";
import * as productsDal from "@/server/dal/products";
import { requireSession } from "@/server/session";

// No invalidan `analytics`: las métricas usan el snapshot de precio/costo de
// cada pedido, así que editar el catálogo no las cambia. Sí refrescan las
// páginas que muestran el catálogo (listado y selector del nuevo pedido).
// Errores de dominio: INVALID_INPUT, SKU_TAKEN, PRODUCT_NOT_FOUND e
// INSUFFICIENT_STOCK (ajuste negativo mayor al stock disponible).

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
