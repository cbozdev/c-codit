import { cn } from "@/lib/utils/cn";

type GoldDividerProps = {
  label?: string;
  className?: string;
};

export function GoldDivider({ label, className }: GoldDividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-4 w-full", className)}>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-brand-gold/40" />
        <span className="text-label text-brand-gold whitespace-nowrap">{label}</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-brand-gold/40" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent",
        className
      )}
    />
  );
}

export function GoldAccent({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="w-8 h-px bg-brand-gold" />
      <div className="w-2 h-2 rounded-full bg-brand-gold" />
      <div className="w-8 h-px bg-brand-gold" />
    </div>
  );
}
