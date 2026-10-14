import { Familjen_Grotesk, Inter_Tight, Martian_Mono } from "next/font/google";

const sans = Familjen_Grotesk({ variable: "--font-familjen", subsets: ["latin"] });
const display = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const mono = Martian_Mono({ variable: "--font-martian", subsets: ["latin"], weight: ["300", "400"] });

export default function ArclineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sans.variable} ${display.variable} ${mono.variable}`} style={{ fontFamily: "var(--font-familjen), system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
