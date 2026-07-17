import type { Metadata } from "next";
import localFont from "next/font/local";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "roomd · shared room for AI coding agents",
    template: "%s · roomd",
  },
  description: SITE_DESCRIPTION,
  applicationName: "roomd",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "roomd",
    "MCP",
    "AI coding agents",
    "multi-agent",
    "Claude Code",
    "Cursor",
    "shared context",
    "agent coordination",
  ],
  authors: [{ name: "roomd", url: SITE_URL }],
  openGraph: {
    title: "roomd · shared room for AI coding agents",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "roomd",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "roomd · shared room for AI coding agents",
    description: SITE_DESCRIPTION,
  },
};

/**
 * Sets the theme class before first paint, so there is no flash of the wrong
 * theme. Order of precedence: an explicit `?theme=` in the URL (also persisted,
 * handy for sharing a themed link), then the user's saved choice, then the
 * operating system preference. Kept inline and tiny on purpose.
 */
const themeInit = `(function(){try{
  var q=new URLSearchParams(location.search).get('theme');
  var t=q||localStorage.getItem('theme');
  var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(q==='dark'||q==='light')localStorage.setItem('theme',q);
  var e=document.documentElement;
  e.classList.toggle('dark',dark);
  e.style.colorScheme=dark?'dark':'light';
}catch(_){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
