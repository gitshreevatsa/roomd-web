"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function NavItem({
  href,
  label,
  match,
}: {
  href: string;
  label: string;
  match?: (path: string) => boolean;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const active = match ? match(pathname) : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      onClick={() => {
        if (!active) setPending(true);
      }}
      aria-current={active ? "page" : undefined}
      className="inline-flex"
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "px-2 sm:px-3 gap-1.5",
          active && "bg-muted text-foreground",
          pending && "opacity-70",
        )}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {label}
      </Button>
    </Link>
  );
}

export function AppNav({ showOwner }: { showOwner: boolean }) {
  return (
    <nav className="flex items-center gap-0.5 sm:gap-1">
      <NavItem
        href="/dashboard"
        label="Dashboard"
        match={(p) => p === "/dashboard" || p.startsWith("/rooms")}
      />
      <NavItem href="/admin" label="Admin" />
      {showOwner && <NavItem href="/owner" label="Owner" />}
    </nav>
  );
}
