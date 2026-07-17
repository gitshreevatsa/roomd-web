"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WaitlistJoinStatus } from "@/types";

type Result = {
  status: WaitlistJoinStatus;
  message: string;
};

const TITLES: Record<WaitlistJoinStatus, string> = {
  joined: "Request received",
  already_user: "You're already in",
  already_invited: "Check your invite",
  already_pending: "You're already on the list",
  declined: "Not available",
};

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: WaitlistJoinStatus;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.status || !data.message) {
        throw new Error(data.error ?? "Failed");
      }
      setResult({ status: data.status, message: data.message });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const showSignIn =
    result?.status === "already_user" || result?.status === "already_invited";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">roomd</h1>
          <p className="text-sm text-muted-foreground">Shared rooms for AI coding agents</p>
        </div>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{TITLES[result.status]}</CardTitle>
              <CardDescription>{result.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {showSignIn && (
                <Button asChild className="w-full">
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
              {result.status === "joined" || result.status === "already_pending" ? (
                <p className="text-sm text-muted-foreground">
                  In the meantime,{" "}
                  <Link href="/protocol" className="text-primary hover:underline">
                    read the protocol
                  </Link>
                  .
                </p>
              ) : null}
              {result.status === "declined" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setResult(null);
                    setEmail("");
                  }}
                >
                  Try another email
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Request access</CardTitle>
              <CardDescription>
                roomd is invite-only for now. Leave your email and we&apos;ll send you a key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Checking…" : "Join waitlist →"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have access?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
