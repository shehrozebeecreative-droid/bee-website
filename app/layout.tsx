import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["700", "800"] });
const dmSans = DM_Sans({ variable: "--font-dm", subsets: ["latin"] });
const jet = JetBrains_Mono({ variable: "--font-jet", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Bee Creative — Shopify Select Partner Agency in Karachi",
  description:
    "Shopify Select Partner crafting high-performance stores for global brands. Shopify development, web design, branding and digital marketing.",
  icons: { icon: "/bee/faviccon.png" },
};

export const viewport: Viewport = { themeColor: "#0a0a08" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jet.variable} antialiased`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
