import type { Provider } from "next-auth/providers";
import { apikeyProvider } from "./apikey";
import { emailProvider } from "./email";
import { googleProvider } from "./google";
import { githubProvider } from "./github";

const AUTH_MODE = process.env.AUTH_MODE ?? "apikey";

export function getAuthProviders(): Provider[] {
  const providers: Provider[] = [];

  if (AUTH_MODE === "apikey" || AUTH_MODE === "both") {
    providers.push(apikeyProvider);
  }

  if (AUTH_MODE === "email" || AUTH_MODE === "both") {
    providers.push(emailProvider);
    if (process.env.GOOGLE_CLIENT_ID) providers.push(googleProvider);
    if (process.env.GITHUB_CLIENT_ID) providers.push(githubProvider);
  }

  return providers;
}

export { AUTH_MODE };
