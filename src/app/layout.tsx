import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "@/components/Providers";
import { BottomNav } from "@/components/Shell";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ServiceWorker } from "@/components/ServiceWorker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const anton = Anton({
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Daet Watch — what's still broken in Daet",
    template: "%s · Daet Watch",
  },
  description:
    "Community-reported civic issues in Daet, Camarines Norte. Every issue carries a public DAYS UNFIXED counter. Only residents can mark an issue fixed.",
  applicationName: "Daet Watch",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Daet Watch", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "Daet Watch",
    locale: "en_PH",
    title: "Daet Watch — what's still broken in Daet",
    description:
      "Community-reported civic issues in Daet, Camarines Norte. DAYS UNFIXED, counted in public.",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
  maximumScale: 5,
};

/** Sets the theme class before first paint so a dark-mode user never sees a flash. */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('dw-theme') || 'system';
    var dark = stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) { document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = 'dark'; }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-surface-2 font-sans antialiased">
        <Providers>
          <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col border-line bg-paper sm:border-x">
            <main className="flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">{children}</main>
            <BottomNav />
            <InstallPrompt />
            <ServiceWorker />
          </div>
        </Providers>
      </body>
    </html>
  );
}
