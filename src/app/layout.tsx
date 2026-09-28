import type { Metadata, Viewport } from "next";
import { Instrument_Serif, DM_Sans, Caveat, Amatic_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-instrument-serif",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
});

// Handwriting for the journal. Caveat has no Hebrew glyphs, so Hebrew text
// falls through to Amatic SC's Hebrew subset.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-caveat",
});

const amatic = Amatic_SC({
  subsets: ["hebrew"],
  weight: ["400"],
  variable: "--font-amatic",
  // Only needed when a caption contains Hebrew; don't block first paint on it.
  preload: false,
});

export const metadata: Metadata = {
  title: "CheckMate",
  description: "Track your goals together",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CheckMate",
    startupImage: [],
  },
};

// maximumScale stops iOS from auto-zooming into focused inputs; iOS still
// allows pinch-zoom regardless (it ignores user-scalable for accessibility).
export const viewport: Viewport = {
  themeColor: "#F8F4F0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${caveat.variable} ${amatic.variable} h-full`}
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="h-full bg-background font-[family-name:var(--font-dm-sans)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
