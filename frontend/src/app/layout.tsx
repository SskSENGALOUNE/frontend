import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Noto_Sans_Lao } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const notoLao = Noto_Sans_Lao({
  variable: "--font-noto-lao",
  subsets: ["lao", "latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Money Manager",
  description: "ບັນທຶກລາຍຮັບ ລາຍຈ່າຍ ແລະ ເບິ່ງລາຍງານ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#111613" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="lo" className={`${notoLao.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
