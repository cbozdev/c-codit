import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wider whitespace-nowrap",
  {
    variants: {
      variant: {
        gold: "bg-brand-gold/20 text-brand-gold border border-brand-gold/30",
        new: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        sale: "bg-red-500/20 text-red-400 border border-red-500/30",
        info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        muted: "bg-white/10 text-text-muted border border-border-subtle",
        success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        error: "bg-red-500/20 text-red-400 border border-red-500/30",
      },
      size: {
        sm: "px-2 py-0.5 text-2xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "muted",
      size: "sm",
    },
  }
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    dot?: boolean;
  };

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}
