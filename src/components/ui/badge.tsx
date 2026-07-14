import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        green:
          "border-primary/25 bg-primary/10 text-primary",
        blue: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        orange: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
        red: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        gray: "border-border bg-muted text-muted-foreground",
        purple: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
