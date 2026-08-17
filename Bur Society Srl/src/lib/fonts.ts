import { Cormorant_Garamond, Geist } from "next/font/google";

export const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
