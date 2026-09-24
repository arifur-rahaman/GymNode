"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" className="self-center print:hidden" onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  );
}
