import { cn } from "@/lib/utils";

function publicLogoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gym-logos/${path}`;
}

/** Gym logo, or the first letter of the gym name as in the designs. */
export function GymLogo({
  name,
  logoPath,
  className,
}: {
  name: string;
  logoPath: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-accent font-bold text-on-accent",
        className,
      )}
    >
      {logoPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny pre-compressed WebP from our own storage
        <img src={publicLogoUrl(logoPath)} alt="" className="size-full object-cover" />
      ) : (
        name.trim().charAt(0) || "G"
      )}
    </span>
  );
}
