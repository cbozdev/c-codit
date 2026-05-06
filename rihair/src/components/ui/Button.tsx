"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-gold text-brand-black hover:shadow-gold-lg hover:scale-[1.02] active:scale-[0.98]",
        secondary:
          "bg-transparent border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-black",
        ghost:
          "bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5",
        outline:
          "bg-transparent border border-border-default text-text-primary hover:border-brand-gold hover:text-brand-gold",
        destructive:
          "bg-feedback-error/10 border border-feedback-error/30 text-feedback-error hover:bg-feedback-error hover:text-white",
        link: "bg-transparent text-brand-gold underline-offset-4 hover:underline p-0 h-auto",
        dark: "bg-surface-elevated border border-border-default text-text-primary hover:border-border-emphasis",
      },
      size: {
        xs: "h-7 px-3 text-xs rounded-lg",
        sm: "h-9 px-4 text-sm rounded-xl",
        md: "h-11 px-6 text-sm rounded-full",
        lg: "h-12 px-8 text-base rounded-full",
        xl: "h-14 px-10 text-lg rounded-full",
        icon: "h-10 w-10 rounded-full",
        "icon-sm": "h-8 w-8 rounded-full",
        "icon-lg": "h-12 w-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    loading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
    fullWidth?: boolean;
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      icon,
      iconPosition = "left",
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            {children && <span>{children}</span>}
          </>
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <span className="flex-shrink-0" aria-hidden>
                {icon}
              </span>
            )}
            {children}
            {icon && iconPosition === "right" && (
              <span className="flex-shrink-0" aria-hidden>
                {icon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
