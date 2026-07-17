"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/owner", label: "Invite", exact: true },
  { href: "/owner/waitlist", label: "Waitlist" },
  { href: "/owner/users", label: "Users" },
  { href: "/owner/usage", label: "Usage" },
];

export function OwnerNav() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-3">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const pending = pendingHref === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => {
              if (!active) setPendingHref(link.href);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              pending && "opacity-70",
            )}
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
