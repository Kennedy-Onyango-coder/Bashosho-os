import React, { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g., "max-w-md", "max-w-xl", "max-w-2xl", "max-w-4xl"
  className?: string;
  hideHeader?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-2xl",
  className = "",
  hideHeader = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Hold the latest onClose in a ref so the effect below can depend solely on [isOpen].
  // The parent of a controlled form passes onClose as an inline arrow, which gets a
  // brand-new identity on every render. If the effect listed onClose as a dependency it
  // would tear down and re-run on every keystroke — and its cleanup restores focus to the
  // element that opened the dialog — yanking the user's cursor out of the field they're
  // typing in after every single character. Reading onClose from a ref keeps the whole
  // focus-management effect tied to open/close transitions only.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Accessibility: this Modal is the single dialog primitive used across the whole
  // app (dozens of forms/edit screens), so fixing it once here fixes it everywhere.
  // Adds the three things a real dialog needs beyond Escape-to-close (already
  // present): (1) focus moves INTO the dialog when it opens, so a keyboard/screen-
  // reader user isn't left back wherever they were when the backdrop appeared; (2)
  // Tab/Shift+Tab is trapped inside the dialog while it's open, so focus can't
  // silently wander onto page content hidden behind the backdrop; (3) focus returns
  // to whatever triggered the dialog once it closes, preserving the user's place.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Defer to the next tick so the panel has actually mounted/animated in before we
    // try to find something inside it to focus.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable[0] || panel).focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const allFocusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const focusable: HTMLElement[] = allFocusable.filter((el) => (el as HTMLElement).offsetParent !== null) as HTMLElement[];
      if (focusable.length === 0) return;
      const first: HTMLElement = focusable[0];
      const last: HTMLElement = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Return focus to whatever opened this dialog, if it's still on the page. Because
      // this effect only runs on open/close (dependency: [isOpen]) and NOT on every
      // re-render, this restore fires once when the dialog truly closes — never while the
      // user is mid-keystroke inside a field.
      if (previouslyFocusedRef.current && document.contains(previouslyFocusedRef.current)) {
        previouslyFocusedRef.current.focus();
      }
    };
    // Intentionally depend only on isOpen (not onClose): see the onCloseRef note above.
    // The effect must not re-run on parent re-renders, or it would steal focus from the
    // active input on every keystroke — the exact bug this file fixes.
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />

        {/* Dialog Panel */}
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={!hideHeader && typeof title === "string" ? titleId : undefined}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={`relative bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden my-auto z-10 outline-none ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {!hideHeader && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-150 bg-neutral-50/80 shrink-0">
              <div>
                {typeof title === "string" ? (
                  <h3 id={titleId} className="text-sm font-bold text-neutral-900 font-sans tracking-tight">{title}</h3>
                ) : (
                  title
                )}
                {subtitle && (
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-full transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* If header is hidden, render a floating close button in top right */}
          {hideHeader && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-full bg-white/90 backdrop-blur-xs shadow-xs transition-colors cursor-pointer border border-neutral-200"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          )}

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1">{children}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default Modal;
