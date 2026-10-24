import { OrderStatus } from "@/generated/prisma/enums";

/** Orden de las columnas del Kanban (flujo natural del pedido). */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

type StatusMeta = {
  label: string;
  /** Punto de color / acento de la columna. */
  dot: string;
  /** Chip de estado: fondo claro + texto oscuro de la misma familia (contraste AA). */
  badge: string;
  /** Borde superior de la columna. */
  accent: string;
};

// Colores semánticos por estado: ámbar = espera, azul = en curso,
// índigo = en tránsito, verde = completado, rojo = cancelado.
export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: { label: "Pendiente", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-900", accent: "border-t-amber-500" },
  PROCESSING: { label: "En proceso", dot: "bg-sky-500", badge: "bg-sky-100 text-sky-900", accent: "border-t-sky-500" },
  SHIPPED: { label: "Enviado", dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-900", accent: "border-t-indigo-500" },
  DELIVERED: { label: "Entregado", dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-900", accent: "border-t-emerald-600" },
  CANCELLED: { label: "Cancelado", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-900", accent: "border-t-rose-500" },
};

export const statusLabel = (status: OrderStatus) => ORDER_STATUS_META[status].label;
