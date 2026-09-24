import { cn } from "@/lib/utils";

/** Member photo (signed URL) or the first letter of the name, as in the designs. */
export function MemberAvatar({
  name,
  photoUrl,
  size = 36,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-bold",
        className,
      )}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small signed URL from private storage
        <img src={photoUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        name.trim().charAt(0)
      )}
    </span>
  );
}
