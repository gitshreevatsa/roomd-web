import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS / Apple touch icon — larger roomd mark. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a9e48",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            background: "#ffffff",
            borderRadius: 12,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
