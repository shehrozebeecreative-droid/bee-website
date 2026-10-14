import type { Metadata } from "next";
import Home from "@/components/Home";

export const metadata: Metadata = { title: "Arcline — motion study" };

export default function Page() {
  return <Home />;
}
