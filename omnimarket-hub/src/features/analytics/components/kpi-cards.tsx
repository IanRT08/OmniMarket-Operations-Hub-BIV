import { Banknote, Percent, ReceiptText, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { formatNumber, formatPercent } from "@/lib/format";
import type { DashboardKpis } from "@/server/dal/dashboard";

type Summary = DashboardKpis["summary"];

type Tile = {
  label: string;
  value: string;
  caption: string;
  icon: React.ComponentType<{ className?: string }>;
};

function tiles(summary: Summary): Tile[] {
  return [
    {
      label: "Ingresos",
      value: formatCurrency(summary.revenueCents),
      caption: `${formatNumber(summary.itemsSold)} artículos vendidos`,
      icon: Banknote,
    },
    {
      label: "Pedidos",
      value: formatNumber(summary.ordersCount),
      caption: "Sin contar cancelados",
      icon: ShoppingCart,
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(summary.averageTicketCents),
      caption: "Ingreso por pedido",
      icon: ReceiptText,
    },
    {
      label: "Margen bruto",
      value: formatPercent(summary.grossMarginRatio),
      caption: `${formatCurrency(summary.grossMarginCents)} de utilidad`,
      icon: Percent,
    },
  ];
}

/**
 * Fila de KPIs (stat tiles): etiqueta, valor y contexto. Los valores usan
 * cifras proporcionales (no tabular-nums): son números sueltos, no columnas.
 */
export function KpiCards({ summary }: { summary: Summary }) {
  return (
    <section aria-label="Indicadores del periodo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles(summary).map(({ label, value, caption, icon: Icon }) => (
        <article key={label} className="rounded-xl border border-border bg-white p-5" data-testid={`kpi-${label}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-muted">{label}</h2>
            <Icon className="size-4 text-brand-olive" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
          <p className="mt-1 text-xs text-ink-muted">{caption}</p>
        </article>
      ))}
    </section>
  );
}
