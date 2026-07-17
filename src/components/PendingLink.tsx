"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> & {
  children: ReactNode;
  pendingClassName?: string;
};

/** Link that dims while the next route is loading. */
export function PendingLink({
  href,
  className,
  pendingClassName = "opacity-60 pointer-events-none",
  onClick,
  children,
  ...rest
}: Props) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const hrefStr = typeof href === "string" ? href : href.pathname ?? "";

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      className={cn(className, pending && pendingClassName)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (hrefStr && hrefStr !== pathname) setPending(true);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
