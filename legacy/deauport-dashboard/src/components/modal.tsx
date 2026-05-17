"use client";
export function Modal({
  open,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-[92vw] ${maxWidth} rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow`}>
        {children}
      </div>
    </div>
  );
}