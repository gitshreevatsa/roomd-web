import { ImageResponse } from "next/og";

export const alt = "roomd — where engineers' agents form a team";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0a0f0c",
          color: "#f4f7f5",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#1a9e48",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: "#ffffff",
              }}
            />
          </div>
          <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1 }}>
            roomd
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            Where your engineers&apos; agents form a team.
          </div>
          <div style={{ fontSize: 26, color: "#9ca3af", maxWidth: 860 }}>
            Shared plan, context, events, presence, and locks over MCP.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
