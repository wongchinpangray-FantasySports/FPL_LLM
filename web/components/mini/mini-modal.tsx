"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function MiniModal({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mini-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-[101] w-full max-w-md rounded-xl border border-border",
          "bg-background p-5 shadow-2xl",
        )}
      >
        <h2
          id="mini-modal-title"
          className="text-base font-semibold text-foreground sm:text-lg"
        >
          {title}
        </h2>
        {children ? (
          <div className="mt-3 text-sm leading-relaxed text-foreground/70">
            {children}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function MiniModalActions({
  onCancel,
  onConfirm,
  cancelLabel,
  confirmLabel,
  confirmLoading,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel: string;
  confirmLabel: string;
  confirmLoading?: boolean;
}) {
  return (
    <>
      <Button type="button" variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        type="button"
        disabled={confirmLoading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </>
  );
}
