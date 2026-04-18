import type { Metadata, Viewport } from "next";
import { SupabaseProvider } from "@/contexts/supabase-provider";
import { AppHeader } from "@/components/layout/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock App",
  description: "Stock, ventas y escaneo QR",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <SupabaseProvider>
          <AppHeader />
          <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </SupabaseProvider>
      </body>
    </html>
  );
}
