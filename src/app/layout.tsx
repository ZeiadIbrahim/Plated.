import type { Metadata } from "next";
import { Inter, Lora, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-body",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plated",
  description: "A high-end personal cookbook & recipe parser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${playfair.variable} ${lora.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
