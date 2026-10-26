"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmación de acciones destructivas con <dialog> nativo: showModal() da
 * el foco atrapado, Esc para cerrar y el fondo inerte sin dependencias.
 */
export function ConfirmDialog({ open, title, description, confirmLabel, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Esc: se cierra por el estado del padre, no por el navegador.
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-white p-6 text-left text-ink shadow-xl backdrop:bg-ink/40"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div id={descriptionId} className="mt-2 text-sm text-ink-muted">
        {description}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Eliminando…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
