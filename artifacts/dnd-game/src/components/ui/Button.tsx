import * as React from "react"
import { cn } from "@/lib/utils"
import { sound } from "@/lib/sound"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Set false to opt out of the click sound effect. */
  silent?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', silent = false, onClick, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-display font-bold tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed uppercase";

    const variants = {
      default: "bg-gradient-to-b from-primary to-yellow-700 text-primary-foreground border border-yellow-300 shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:brightness-110",
      outline: "border-2 border-primary text-primary hover:bg-primary/10 shadow-[inset_0_0_10px_rgba(212,175,55,0)] hover:shadow-[inset_0_0_15px_rgba(212,175,55,0.2)]",
      ghost: "text-foreground hover:text-primary hover:bg-white/5",
      danger: "bg-gradient-to-b from-secondary to-red-900 text-white border border-red-500 shadow-[0_0_15px_rgba(139,0,0,0.3)] hover:shadow-[0_0_25px_rgba(139,0,0,0.5)]"
    };

    const sizes = {
      sm: "h-9 px-4 text-xs",
      md: "h-12 px-8 text-sm",
      lg: "h-16 px-12 text-base"
    };

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      if (!silent && !e.currentTarget.disabled) {
        // Variant-aware click tone for slight character.
        if (variant === "danger") {
          sound.toggleOff();
        } else if (variant === "default") {
          sound.toggleOn();
        } else {
          sound.click();
        }
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
