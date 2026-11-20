import { AlertCircle, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import React, { useRef } from "react";
import { Button } from "@/components/ui/Primitives";
import { useModalA11y } from "@/hooks/useModalA11y";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = React.memo(
  ({
    isOpen,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    tone = "danger",
    isLoading = false,
    onConfirm,
    onCancel,
  }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const confirmBtnRef = useRef<HTMLButtonElement>(null);

    useModalA11y({
      isOpen,
      onClose: onCancel,
      containerRef: modalRef,
      initialFocusRef: confirmBtnRef,
      closeOnEscape: !isLoading,
    });

    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoading) {
            onCancel();
          }
        }}
      >
        <div
          ref={modalRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirmation-modal-title"
          aria-describedby="confirmation-modal-description"
          tabIndex={-1}
          className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl focus:outline-none"
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                tone === "danger"
                  ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
                  : tone === "warning"
                    ? "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"
                    : "bg-primary/10 text-primary ring-1 ring-primary/20"
              }`}
            >
              {tone === "danger" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : tone === "warning" ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <HelpCircle className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3
                id="confirmation-modal-title"
                className="text-base font-semibold text-foreground"
              >
                {title}
              </h3>
              <p
                id="confirmation-modal-description"
                className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
              >
                {description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-border pt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isLoading}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
            <Button
              ref={confirmBtnRef}
              type="button"
              variant={tone === "danger" ? "danger" : "primary"}
              size="sm"
              disabled={isLoading}
              onClick={() => void onConfirm()}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
ConfirmationModal.displayName = "ConfirmationModal";
