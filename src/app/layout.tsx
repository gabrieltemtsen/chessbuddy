import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { CirclesProvider } from "@/contexts/CirclesContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChessBuddy — Play Chess, Earn CRC",
  description:
    "ChessBuddy is a Web3 chess platform built on Circles. Stake CRC, play chess, and win rewards. Challenge human players or our AI agent.",
  keywords: ["chess", "web3", "circles", "crc", "gnosis", "blockchain", "game"],
  openGraph: {
    title: "ChessBuddy",
    description: "Play chess. Stake CRC. Win rewards.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <CirclesProvider>{children}</CirclesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
