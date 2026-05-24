import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
};

export function Dialog({ open, title, description, children, footer, onClose, wide }: DialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-layer" role="presentation">
      <div className="dialog-backdrop" onClick={onClose} />
      <section className={wide ? "dialog dialog-wide" : "dialog"} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className="dialog-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "success" | "default";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "default",
  busy,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : tone === "success" ? "success" : "default"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmLabel}
          </Button>
        </>
      }
    >
      <div className={`confirm-block confirm-${tone}`}>{description}</div>
    </Dialog>
  );
}

