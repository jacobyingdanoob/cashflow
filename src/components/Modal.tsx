import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  children,
  onClose,
  wide = false,
  dismissOnBackdrop = true,
  eyebrow = "MAKE IT YOURS",
  className = "",
  hidden = false,
  dismissible = true,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  dismissOnBackdrop?: boolean;
  eyebrow?: string;
  className?: string;
  hidden?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Capture before the render commits: making the page inert can blur its opener.
  const returnFocus = useRef(document.activeElement as HTMLElement);
  useEffect(() => {
    if (hidden) return;
    const last = returnFocus.current;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    node?.focus();
    function key(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key === "Escape" && dismissible) onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          node?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]',
          ) ?? [],
        ).filter((item) => item.getClientRects().length > 0);
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === node)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      last?.focus();
    };
  }, [onClose, hidden, dismissible]);
  return (
    <div
      className="modal-backdrop"
      style={hidden ? { display: "none" } : undefined}
      inert={hidden}
      onMouseDown={(e) => {
        if (dismissible && dismissOnBackdrop && e.target === e.currentTarget)
          onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          {dismissible && (
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
