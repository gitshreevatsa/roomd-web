"use client";

import { useEffect, useState } from "react";
import NextTopLoader from "nextjs-toploader";

const LIGHT = "hsl(142 68% 32%)";
const DARK = "hsl(142 78% 48%)";

/** Thin top bar during App Router navigations (Link + router.push). */
export function NavigationProgress() {
  const [color, setColor] = useState(LIGHT);

  useEffect(() => {
    const sync = () => {
      setColor(
        document.documentElement.classList.contains("dark") ? DARK : LIGHT,
      );
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return (
    <NextTopLoader
      color={color}
      initialPosition={0.18}
      crawlSpeed={180}
      height={2}
      crawl
      showSpinner={false}
      easing="ease"
      speed={200}
      shadow={`0 0 8px ${color.replace(")", " / 0.45)")}`}
      zIndex={9999}
    />
  );
}
