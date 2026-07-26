import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";
import { ThemeProvider } from "@/components/ThemeProvider";

// Money Moves design system: Sora for headings/stat figures, Inter for
// body/UI. See claudemd/design-system.md.
const sora = Sora({
  variable: "--font-sora",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Money Moves",
  description: "Personal budgeting",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Money Moves",
  },
};

export const viewport: Viewport = {
  themeColor: "#171614",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Runs before hydration so the correct theme is set before first paint.
// Duplicates the default-to-dark logic in lib/theme.ts's readStoredTheme —
// inline scripts can't import modules, so this stays a plain string.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RegisterSW />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
