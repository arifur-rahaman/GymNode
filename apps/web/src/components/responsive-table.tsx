import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A table on tablet/desktop that becomes a list of cards on phones (<768px),
 * as DESIGN_SYSTEM §5 requires. Columns are declared once and used by both views.
 */
export type Column<Row> = {
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  /** CSS grid track size for the desktop view, e.g. "2fr" or "110px". */
  width?: string;
  align?: "start" | "end";
  /** On phones, show this cell as the card's title row. */
  primary?: boolean;
  /** Hide on phones (e.g. checkbox, low-value columns). */
  hideOnMobile?: boolean;
  /** On phones, show this cell full-width at the bottom of the card without a label (e.g. action buttons). */
  mobileFooter?: boolean;
};

type ResponsiveTableProps<Row> = {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  caption: string;
  className?: string;
};

function ResponsiveTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  className,
}: ResponsiveTableProps<Row>) {
  const template = columns.map((c) => c.width ?? "1fr").join(" ");
  const primary = columns.find((c) => c.primary);
  const secondary = columns.filter((c) => !c.primary && !c.hideOnMobile && !c.mobileFooter);
  const footer = columns.filter((c) => c.mobileFooter);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      {/* Tablet & desktop: grid table */}
      <div role="table" aria-label={caption} className="hidden md:block">
        <div role="rowgroup">
          <div
            role="row"
            className="grid items-center gap-3 bg-surface-2 px-5 py-3 text-[13px] text-muted"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((c) => (
              <span
                key={c.key}
                role="columnheader"
                className={cn(c.align === "end" && "text-right")}
              >
                {c.header}
              </span>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row) => (
            <div
              key={rowKey(row)}
              role="row"
              className="grid items-center gap-3 border-t border-border px-5 py-2.5 text-sm"
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((c) => (
                <span
                  key={c.key}
                  role="cell"
                  className={cn("min-w-0", c.align === "end" && "text-right")}
                >
                  {c.cell(row)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Phones: card list */}
      <ul aria-label={caption} className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="flex flex-col gap-2 p-4">
            {primary ? <div>{primary.cell(row)}</div> : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {secondary.map((c) => (
                <div key={c.key} className="flex min-w-0 flex-col">
                  <dt className="text-xs text-muted">{c.header}</dt>
                  <dd className="min-w-0">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {footer.map((c) => (
              <div key={c.key} className="empty:hidden">
                {c.cell(row)}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ResponsiveTable };
