import { z } from "zod";

// Esquemas compartidos por el formulario de productos, las Server Actions y
// los tests. Todo el dinero en centavos (Int).

const MAX_CENTS = 100_000_000; // $1,000,000.00
const MAX_STOCK = 1_000_000;

const centsSchema = z.number().int().min(0).max(MAX_CENTS);

export const createProductSchema = z.object({
  /** Se normaliza a mayúsculas: "om-aud-001" → "OM-AUD-001". */
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, "SKU: 3 a 32 caracteres, letras, números y guiones"),
  name: z.string().trim().min(2).max(160),
  priceCents: centsSchema,
  costCents: centsSchema,
  stock: z.number().int().min(0).max(MAX_STOCK).default(0),
  isActive: z.boolean().default(true),
});

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
export type ProductListQuery = z.output<typeof productListQuerySchema>;
