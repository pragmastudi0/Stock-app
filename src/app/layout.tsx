import type { Metadata } from "next";
import { SupabaseProvider } from "@/contexts/supabase-provider";
import { AppHeader } from "@/components/layout/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock App",
  description: "Stock, ventas y escaneo QR",
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
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </SupabaseProvider>
      </body>
    </html>
  );
}
