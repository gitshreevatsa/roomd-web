import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab icon — roomd mark (green tile + white dot). */
export default function Icon() {
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
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            background: "#ffffff",
            borderRadius: 2,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
