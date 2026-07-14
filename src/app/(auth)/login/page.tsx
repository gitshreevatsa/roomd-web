"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "apikey";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"apikey" | "email">("apikey");
  const [apiKey, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleApiKeyLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("apikey", {
        apiKey,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid API key. Please try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("email", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const showApiKey = AUTH_MODE === "apikey" || AUTH_MODE === "both";
  const showEmail = AUTH_MODE === "email" || AUTH_MODE === "both";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">roomd</h1>
          <p className="text-sm text-muted-foreground">Agent coordination dashboard</p>
        </div>

        {AUTH_MODE === "both" && (
          <div className="flex border rounded-md overflow-hidden">
            <button
              className={`flex-1 text-sm py-2 transition-colors ${
                tab === "apikey"
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "hover:bg-muted"
              }`}
              onClick={() => setTab("apikey")}
            >
              API Key
            </button>
            <button
              className={`flex-1 text-sm py-2 transition-colors ${
                tab === "email"
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "hover:bg-muted"
              }`}
              onClick={() => setTab("email")}
            >
              Email / OAuth
            </button>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            {(AUTH_MODE === "apikey" || (AUTH_MODE === "both" && tab === "apikey")) && (
              <>
                <CardTitle className="text-base">Sign in with API key</CardTitle>
                <CardDescription>Enter the key you received from the operator.</CardDescription>
              </>
            )}
            {(AUTH_MODE === "email" || (AUTH_MODE === "both" && tab === "email")) && (
              <>
                <CardTitle className="text-base">Sign in</CardTitle>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {(showApiKey && (AUTH_MODE === "apikey" || tab === "apikey")) && (
              <form onSubmit={handleApiKeyLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in →"}
                </Button>
              </form>
            )}

            {(showEmail && (AUTH_MODE === "email" || tab === "email")) && (
              <div className="space-y-3">
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in →"}
                  </Button>
                </form>

                {(process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" ||
                  process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true") && (
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">or</span>
                      </div>
                    </div>
                    {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                      >
                        Continue with Google
                      </Button>
                    )}
                    {process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true" && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                      >
                        Continue with GitHub
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {AUTH_MODE === "apikey" && (
          <p className="text-center text-sm text-muted-foreground">
            This is invite-only.{" "}
            <Link href="/waitlist" className="text-primary hover:underline">
              Join the waitlist →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
