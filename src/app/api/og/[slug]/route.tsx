import { ImageResponse } from "next/og";
import QRCode from "qrcode";

import { getIssueBySlug } from "@/lib/queries";
import { dayTone } from "@/lib/rules";

export const runtime = "nodejs";
export const revalidate = 21_600; // the day counter must not be a day stale

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const TONE = {
  neutral: "#e8e6df",
  amber: "#f5b301",
  red: "#d92b1f",
} as const;
const TONE_INK = {
  neutral: "#14181d",
  amber: "#1a1200",
  red: "#ffffff",
} as const;

async function loadFonts(origin: string) {
  try {
    const [anton, inter] = await Promise.all([
      fetch(`${origin}/fonts/anton.woff`).then((r) => (r.ok ? r.arrayBuffer() : null)),
      fetch(`${origin}/fonts/inter-bold.woff`).then((r) => (r.ok ? r.arrayBuffer() : null)),
    ]);
    const fonts = [];
    if (anton) fonts.push({ name: "Anton", data: anton, weight: 400 as const, style: "normal" as const });
    if (inter) fonts.push({ name: "Inter", data: inter, weight: 700 as const, style: "normal" as const });
    // No fonts option at all degrades to a plain card instead of a 500.
    return fonts.length > 0 ? fonts : undefined;
  } catch {
    return undefined;
  }
}

async function qrDataUri(value: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(value, { type: "svg", margin: 0, width: 132 });
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const portrait = url.searchParams.get("format") === "portrait";

  const issue = await getIssueBySlug(slug).catch(() => null);
  if (!issue) return new Response("Not found", { status: 404 });

  const width = portrait ? 1080 : 1200;
  const height = portrait ? 1350 : 630;

  const fixed = issue.status === "fixed";
  const bigNumber = fixed ? (issue.daysToFix ?? issue.days) : issue.days;
  const tone = dayTone(issue.days);
  const accent = fixed ? "#12a86b" : TONE[tone];
  const accentInk = fixed ? "#04150d" : TONE_INK[tone];
  const photo = issue.photos[0]?.url;

  const [fonts, qr] = await Promise.all([
    loadFonts(url.origin),
    qrDataUri(`${SITE}/issue/${issue.slug}`),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0b0f14",
          color: "#ffffff",
          position: "relative",
          fontFamily: fonts ? "Inter" : undefined,
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            width={width}
            height={height}
            style={{ position: "absolute", inset: 0, width, height, objectFit: "cover", opacity: 0.17 }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg, rgba(11,15,20,0.95) 0%, rgba(11,15,20,0.86) 45%, rgba(11,15,20,0.98) 100%)",
          }}
        />

        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: portrait ? "56px 64px 0 64px" : "38px 56px 0 56px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: "#d92b1f" }} />
            <div style={{ fontSize: 24, letterSpacing: 6, fontWeight: 700, opacity: 0.92 }}>
              DAET WATCH
            </div>
          </div>
          <div style={{ fontSize: 22, letterSpacing: 1, opacity: 0.62 }}>
            {issue.barangay?.name ?? "Daet"}
          </div>
        </div>

        {/* counter */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            padding: portrait ? "28px 64px 0 64px" : "10px 56px 0 56px",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: portrait ? 22 : 18,
              letterSpacing: 7,
              fontWeight: 700,
              color: accent,
              opacity: 0.95,
            }}
          >
            {fixed ? "FIXED AFTER" : "DAYS UNFIXED"}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 22,
              fontFamily: fonts ? "Anton" : undefined,
              fontSize: portrait ? 300 : 190,
              lineHeight: 0.86,
              letterSpacing: -5,
              color: accent,
            }}
          >
            {fixed ? "FIXED" : bigNumber}
            {fixed ? (
              <div style={{ display: "flex", fontSize: portrait ? 110 : 84, letterSpacing: -2 }}>
                {bigNumber}d
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: portrait ? 34 : 16,
              fontSize: portrait ? 60 : 44,
              lineHeight: 1.16,
              fontWeight: 700,
              maxWidth: portrait ? 940 : 820,
            }}
          >
            {issue.title}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: portrait ? 26 : 14,
              fontSize: portrait ? 30 : 24,
              opacity: 0.9,
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "6px 14px",
                backgroundColor: accent,
                color: accentInk,
                borderRadius: 8,
                fontSize: portrait ? 26 : 21,
                fontWeight: 700,
              }}
            >
              +{issue.confirmations} neighbors affected
            </div>
            <div style={{ display: "flex", opacity: 0.7 }}>
              {fixed ? "problem resolved" : `since ${issue.reportedAt.slice(0, 10)}`}
            </div>
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: portrait ? "0 64px 56px 64px" : "0 56px 36px 56px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: portrait ? 28 : 22, opacity: 0.92 }}>
              {SITE.replace(/^https?:\/\//, "")}/issue/{issue.slug}
            </div>
            <div style={{ display: "flex", fontSize: portrait ? 23 : 18, opacity: 0.66, maxWidth: 740 }}>
              Community-reported. Not verified by the LGU.
            </div>
          </div>
          {qr ? (
            <div
              style={{
                display: "flex",
                padding: 10,
                backgroundColor: "#ffffff",
                borderRadius: 10,
              }}
            >
              <img src={qr} alt="" width={portrait ? 156 : 116} height={portrait ? 156 : 116} />
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts,
      headers: {
        // Day count is computed at request time; a 6-hour shared cache keeps
        // Facebook/Messenger previews fresh without rendering per hit.
        "cache-control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
      },
    },
  );
}
