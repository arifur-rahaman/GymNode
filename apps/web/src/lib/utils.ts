import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes, letting later classes win (standard shadcn/ui helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
