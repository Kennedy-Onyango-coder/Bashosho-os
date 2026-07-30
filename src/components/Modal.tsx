import React, { useEffect } from "react";
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

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
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={`relative bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden my-auto z-10 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {!hideHeader && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-150 bg-neutral-50/80 shrink-0">
              <div>
                {typeof title === "string" ? (
                  <h3 className="text-sm font-bold text-neutral-900 font-sans tracking-tight">{title}</h3>
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
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-full transition-colors cursor-pointer"
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
              className="absolute top-4 right-4 z-20 p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full bg-white/90 backdrop-blur-xs shadow-xs transition-colors cursor-pointer border border-neutral-200"
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
