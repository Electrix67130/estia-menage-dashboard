import { SelectHTMLAttributes, forwardRef, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, hint, id, children, ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border bg-white pl-3 pr-10 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-zinc-900 dark:text-zinc-100",
            error
              ? "border-rose-500 focus:border-rose-500"
              : "border-zinc-300 focus:border-blue-500 dark:border-zinc-700",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
});

export default Select;
