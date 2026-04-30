import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skytech Green — Doğaya Yatırım, Geleceğe Miras",
  description:
    "Kurumsal ve bireysel ağaçlandırma platformu. Tohum satın alın, arazilere ekin, karbon ayak izinizi nötrleyin.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--bg-base)] text-[var(--text-primary)]`}
      >
        {children}
      </body>
    </html>
  );
}
