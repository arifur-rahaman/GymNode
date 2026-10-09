import Image from "next/image";
import { cn } from "@/lib/utils";

/** GymNode logo tile (lime "G–N" dumbbell on a dark rounded square), readable in both themes. */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/gymnode-icon.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[22%]", className)}
      priority
    />
  );
}
