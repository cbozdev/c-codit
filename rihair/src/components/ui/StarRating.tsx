"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type StarRatingProps = {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  count?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
};

const sizeMap = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  showCount = false,
  count,
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const stars = Array.from({ length: maxRating }, (_, i) => i + 1);
  const starClass = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {stars.map((star) => {
          const filled = star <= Math.floor(rating);
          const partial = !filled && star === Math.ceil(rating) && rating % 1 !== 0;
          const fillPercent = partial ? (rating % 1) * 100 : 0;

          return (
            <span
              key={star}
              className={cn(
                "relative",
                interactive && "cursor-pointer transition-transform hover:scale-110"
              )}
              onClick={() => interactive && onChange?.(star)}
            >
              {partial ? (
                <span className="relative inline-block">
                  <Star className={cn(starClass, "text-border-default fill-border-default")} />
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${fillPercent}%` }}
                  >
                    <Star className={cn(starClass, "text-brand-gold fill-brand-gold")} />
                  </span>
                </span>
              ) : (
                <Star
                  className={cn(
                    starClass,
                    filled
                      ? "text-brand-gold fill-brand-gold"
                      : "text-border-default fill-border-default"
                  )}
                />
              )}
            </span>
          );
        })}
      </div>

      {showCount && count !== undefined && (
        <span className="text-sm text-text-muted ml-1">
          {count.toLocaleString()} review{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
