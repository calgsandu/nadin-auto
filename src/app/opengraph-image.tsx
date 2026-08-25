import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Caros — piese de caroserie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Cardul care apare când linkul e trimis pe WhatsApp/Facebook/Telegram.
 * Ruta n-are parametri, deci imaginea se generează la build, nu la fiecare
 * cerere. `proxy.ts` o lasă publică — crawlerele o cer fără cookie.
 */
export default async function OpengraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public", "logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#f6f6f4",
          color: "#1b1a17",
          padding: "40px 88px 84px",
        }}
      >
        {/* Logoul are ~13% margine transparentă în fișier — de aceea e împins
            spre margini, ca să nu lase o gaură în mijlocul cardului. */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginRight: -52 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" width={420} height={280} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>
            Caros
          </div>
          <div style={{ fontSize: 42, color: "#57534a", marginTop: 8 }}>
            Piese de caroserie pentru mașina ta.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 14,
            backgroundColor: "#2e90fa",
          }}
        />
      </div>
    ),
    size,
  );
}
