import { TriangleAlert } from "lucide-react";

/** Form-level error (e.g. wrong password). Announced to screen readers. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-danger/40 bg-badge-red-bg px-3.5 py-3 text-sm font-medium text-badge-red-fg"
    >
      <TriangleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
