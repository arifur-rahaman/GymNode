import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** One-tap WhatsApp chat (wa.me). Real reminders/receipts arrive with M6 messaging. */
export function whatsappUrl(e164Phone: string, text?: string) {
  const digits = e164Phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function WhatsAppIconLink({
  phone,
  label,
  className,
}: {
  phone: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={whatsappUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-sm border border-border bg-surface text-success hover:bg-surface-2",
        className,
      )}
    >
      <MessageCircle className="size-[18px]" aria-hidden />
    </a>
  );
}
