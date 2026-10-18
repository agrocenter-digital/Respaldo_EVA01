import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: { default: "AgroCenter Digital", template: "%s | AgroCenter Digital" },
    description: "Plataforma operativa para compras, ventas e inventario de AgroCenter.",
    openGraph: {
      title: "AgroCenter Digital",
      description: "Compras, ventas e inventario bajo control.",
      type: "website",
      images: [{ url: image, width: 1734, height: 907, alt: "AgroCenter Digital" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AgroCenter Digital",
      description: "Compras, ventas e inventario bajo control.",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
