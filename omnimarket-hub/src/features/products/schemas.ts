import "@/lib/zod-locale";
import { z } from "zod";
import { pesosToCents } from "@/lib/currency";

// Esquemas compartidos por el formulario de productos, las Server Actions y
// los tests. Todo el dinero en centavos (Int).

const MAX_CENTS = 100_000_000; // $1,000,000.00
const MAX_STOCK = 1_000_000;

const centsSchema = z.number().int().min(0).max(MAX_CENTS);

const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, "SKU: 3 a 32 caracteres, letras, números y guiones");

const productNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe el nombre del producto")
  .max(160, "Máximo 160 caracteres");

export const createProductSchema = z.object({
  /** Se normaliza a mayúsculas: "om-aud-001" → "OM-AUD-001". */
  sku: skuSchema,
  name: productNameSchema,
  priceCents: centsSchema,
  costCents: centsSchema,
  stock: z.number().int().min(0).max(MAX_STOCK).default(0),
  isActive: z.boolean().default(true),
});

const pesosSchema = (field: string) =>
  z
    .number(`Escribe el ${field}`)
    .min(0, `El ${field} no puede ser negativo`)
    .max(MAX_CENTS / 100, `El ${field} máximo es $1,000,000.00`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Máximo 2 decimales");

/**
 * Formulario de alta: el usuario captura precios en pesos (12.50) y el
 * esquema los transforma a centavos (1250), que es lo que espera
 * createProductSchema en la Server Action.
 */
export const productFormSchema = z
  .object({
    sku: skuSchema,
    name: productNameSchema,
    price: pesosSchema("precio"),
    cost: pesosSchema("costo"),
    stock: z
      .number("Escribe el stock inicial")
      .int("El stock debe ser un número entero")
      .min(0, "El stock no puede ser negativo")
      .max(MAX_STOCK, "Máximo 1,000,000 piezas"),
    isActive: z.boolean(),
  })
  .transform(({ price, cost, ...product }) => ({
    ...product,
    priceCents: pesosToCents(price),
    costCents: pesosToCents(cost),
  }));

export type ProductFormInput = z.input<typeof productFormSchema>;

// El stock no se edita como valor absoluto sino como ajuste (+ entrada, − merma):
// sobrescribir el número perdería los descuentos que hagan pedidos simultáneos.
// El SKU es inmutable: identifica al producto en reportes externos.
export const updateProductSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(2).max(160).optional(),
    priceCents: centsSchema.optional(),
    costCents: centsSchema.optional(),
    stockAdjustment: z.number().int().min(-MAX_STOCK).max(MAX_STOCK).refine((n) => n !== 0, "El ajuste no puede ser 0").optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (input) => Object.entries(input).some(([key, value]) => key !== "id" && value !== undefined),
    { message: "No hay cambios que guardar" },
  );

/**
 * Formulario de edición: precios en pesos y el stock como ajuste (+/−, 0 si
 * no cambia). Se transforma a los campos de updateProductSchema (sin `id`,
 * que lo agrega el formulario).
 */
export const productEditFormSchema = z
  .object({
    name: productNameSchema,
    price: pesosSchema("precio"),
    cost: pesosSchema("costo"),
    stockAdjustment: z
      .number("Escribe el ajuste de stock (0 si no cambia)")
      .int("El ajuste debe ser un número entero")
      .min(-MAX_STOCK, "Máximo 1,000,000 piezas")
      .max(MAX_STOCK, "Máximo 1,000,000 piezas"),
    isActive: z.boolean(),
  })
  .transform(({ price, cost, stockAdjustment, ...product }) => ({
    ...product,
    priceCents: pesosToCents(price),
    costCents: pesosToCents(cost),
    stockAdjustment: stockAdjustment === 0 ? undefined : stockAdjustment,
  }));

export type ProductEditFormInput = z.input<typeof productEditFormSchema>;
export type ProductEditFormData = z.output<typeof productEditFormSchema>;

export const deleteProductSchema = z.object({ id: z.uuid() });

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  includeInactive: z
    .preprocess((value) => value === true || value === "true" || value === "1", z.boolean())
    .default(false),
});

export type CreateProductInput = z.input<typeof createProductSchema>;
export type CreateProductData = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type UpdateProductData = z.output<typeof updateProductSchema>;
export type DeleteProductInput = z.input<typeof deleteProductSchema>;
export type ProductListQuery = z.output<typeof productListQuerySchema>;
