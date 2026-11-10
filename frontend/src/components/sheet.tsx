"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet on phones, centered dialog on wider screens. Built on <dialog> so focus is
 * trapped and Esc closes it. Children mount only while open, so forms start fresh each time.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // a click on the backdrop lands on the <dialog> element itself
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-line py-1 pr-1 pl-5">
            <h2 className="font-semibold">{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="ປິດ">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
        </div>
      )}
    </dialog>
  );
}
