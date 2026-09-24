import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { THEME_COOKIE, parseTheme } from "@/lib/preferences";
import "./globals.css";

// Bangla + UI text (DESIGN_SYSTEM §3). The bengali subset is required for Bangla glyphs.
const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Numbers, money and English headings.
const space = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  display: "swap",
});

// Demo deployments (NEXT_PUBLIC_DEMO_MODE=true) show a banner and ask search engines not to index them.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("tagline"),
    ...(DEMO_MODE ? { robots: { index: false, follow: false } } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: "#0E0F12",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("app");
  // Theme is read on the server so the first paint is already correct (no flash).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang={locale}
      data-theme={theme}
      style={{ colorScheme: theme }}
      className={`${hind.variable} ${space.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {DEMO_MODE ? (
          <div
            role="note"
            className="bg-badge-blue-bg px-4 py-2 text-center text-[13px] font-medium text-badge-blue-fg"
          >
            {t("demoBanner")}
          </div>
        ) : null}
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
