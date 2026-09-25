import { formatDateShort, formatTimeDhaka } from "@gymnode/core";
import { cn } from "@/lib/utils";

export type TicketMessage = {
  id: string;
  author_name: string;
  from_platform: boolean;
  body: string;
  created_at: string;
};

/** A support conversation: the gym's messages on one side, the GymNode team's on the other. */
export function TicketThread({
  messages,
  teamLabel,
  viewer,
}: {
  messages: TicketMessage[];
  teamLabel: string;
  viewer: "team" | "gym";
}) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = viewer === "team" ? m.from_platform : !m.from_platform;
        const d = new Date(m.created_at);
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg border px-4 py-3",
                mine ? "border-accent/40 bg-surface-2" : "border-border bg-surface",
              )}
            >
              <p className="mb-1 text-xs text-muted">
                <span className="font-semibold text-text">
                  {m.from_platform
                    ? `${teamLabel}${m.author_name ? ` · ${m.author_name}` : ""}`
                    : m.author_name || "—"}
                </span>{" "}
                <span className="num">
                  {formatDateShort(d)} · {formatTimeDhaka(d)}
                </span>
              </p>
              <p className="text-[15px] whitespace-pre-wrap">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
