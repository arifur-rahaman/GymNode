"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toast notifications, themed with our tokens. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
      {...props}
    />
  );
}

export { Toaster };
