import { cn, initials } from "@/lib/utils";

interface Props {
  firstName?: string;
  lastName?: string;
  src?: string;
  /** Miniature à privilégier si disponible (retombe sur `src`). */
  thumbnailSrc?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export default function Avatar({ firstName, lastName, src, thumbnailSrc, size = "md", className }: Props) {
  const cls = cn(
    "inline-flex items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    sizes[size],
    className,
  );
  const resolved = thumbnailSrc || src;
  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolved} alt="" loading="lazy" decoding="async" className={cn(cls, "object-cover")} />
    );
  }
  return <span className={cls}>{initials(firstName, lastName)}</span>;
}
