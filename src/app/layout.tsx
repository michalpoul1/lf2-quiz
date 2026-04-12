import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import SWRegister from "./sw-register";
import { ThemeProvider } from "@/lib/theme";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e3a5f",
};

export const metadata: Metadata = {
  title: "Přijímačky na 2. LF UK",
  description: "Procvičování modelových otázek pro přijímací zkoušky na 2. lékařskou fakultu UK",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "2. LF UK Přijímačky",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('lf2-quiz-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col safe-area-top">
        <ThemeProvider>
          <SWRegister />
          <ThemeToggle />
          <div className="flex-1 w-full max-w-[640px] mx-auto px-4 pb-20">
            {children}
          </div>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
