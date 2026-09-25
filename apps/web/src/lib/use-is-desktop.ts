"use client";

import { useEffect, useState } from "react";

/** True on the desktop layout (≥1200px, DESIGN_SYSTEM §5); null until measured in the browser. */
export function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 75rem)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}
