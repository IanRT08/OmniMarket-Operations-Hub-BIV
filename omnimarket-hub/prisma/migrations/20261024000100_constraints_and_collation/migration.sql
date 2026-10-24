-- ============================================================================
-- Lo que schema.prisma no puede expresar. Prisma no compara collations ni
-- CHECK constraints al detectar drift, así que esta migración convive con
-- `prisma migrate dev` sin generar diffs fantasma.
-- ============================================================================

-- Índice fraccional del Kanban: la librería fractional-indexing compara las
-- llaves byte a byte. Con la collation por defecto (en_US.UTF-8) Postgres
-- ordena "a0" / "aZ" / "a_" de forma lingüística y las tarjetas se
-- desordenan. El índice (status, position) se reconstruye automáticamente.
ALTER TABLE "orders" ALTER COLUMN "position" TYPE VARCHAR(64) COLLATE "C";

-- Dinero en centavos: nunca negativo.
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_cents_check" CHECK ("price_cents" >= 0),
  ADD CONSTRAINT "products_cost_cents_check"  CHECK ("cost_cents" >= 0),
  ADD CONSTRAINT "products_stock_check"       CHECK ("stock" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_total_cents_check" CHECK ("total_cents" >= 0),
  ADD CONSTRAINT "orders_cost_cents_check"  CHECK ("cost_cents" >= 0),
  ADD CONSTRAINT "orders_version_check"     CHECK ("version" >= 1);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_check"         CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_unit_price_cents_check" CHECK ("unit_price_cents" >= 0),
  ADD CONSTRAINT "order_items_unit_cost_cents_check"  CHECK ("unit_cost_cents" >= 0);

ALTER TABLE "daily_sales_metrics"
  ADD CONSTRAINT "daily_sales_metrics_orders_count_check"  CHECK ("orders_count" >= 0),
  ADD CONSTRAINT "daily_sales_metrics_revenue_cents_check" CHECK ("revenue_cents" >= 0),
  ADD CONSTRAINT "daily_sales_metrics_cost_cents_check"    CHECK ("cost_cents" >= 0),
  ADD CONSTRAINT "daily_sales_metrics_items_sold_check"    CHECK ("items_sold" >= 0);
