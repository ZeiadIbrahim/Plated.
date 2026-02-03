import type { Metadata } from "next";
import { Inter, Lora, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {\n  try {\n    const stored = localStorage.getItem("plated.theme");\n    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;\n    const isDark = stored ? stored === "dark" : prefersDark;\n    if (isDark) document.documentElement.classList.add("theme-dark");\n  } catch (e) {}\n})();`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${playfair.variable} ${lora.variable} ${inter.variable} antialiased`}
      >
        <ThemeToggle />
        {children}
        <footer
          className="mt-20 bg-[#111111] text-[#FAFAFA]"
          suppressHydrationWarning
        >
          <div
            className="mx-auto w-full max-w-2xl px-6 py-12"
            suppressHydrationWarning
          >
            <div className="flex flex-col gap-8" suppressHydrationWarning>
              <div className="flex flex-col gap-3" suppressHydrationWarning>
                <p className="text-xs uppercase tracking-[0.3em] text-[#FAFAFA]/60">
                  Plated
                </p>
                <h2 className="text-2xl">A modern editorial cookbook.</h2>
                <p className="text-sm text-[#FAFAFA]/70">
                  Save, parse, and perfect recipes with a calm, premium reading
                  experience.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2" suppressHydrationWarning>
                <div className="grid gap-2 text-sm" suppressHydrationWarning>
                  <a className="text-[#FAFAFA]/80 hover:text-white" href="/faq">
                    FAQs
                  </a>
                  <a className="text-[#FAFAFA]/80 hover:text-white" href="/support">
                    Support
                  </a>
                  <a className="text-[#FAFAFA]/80 hover:text-white" href="/privacy">
                    Privacy
                  </a>
                  <a className="text-[#FAFAFA]/80 hover:text-white" href="/terms">
                    Terms
                  </a>
                </div>
                <div className="grid gap-0" suppressHydrationWarning>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#FAFAFA]/60">
                    Coming soon on
                  </p>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-4"
                    suppressHydrationWarning
                  >
                    <button
                      type="button"
                      className="inline-flex items-center text-xs uppercase tracking-[0.3em] text-[#FAFAFA]/80 hover:text-white"
                    >
                      App Store
                    </button>
                    <span className="text-[#FAFAFA]/30">•</span>
                    <button
                      type="button"
                      className="inline-flex items-center text-xs uppercase tracking-[0.3em] text-[#FAFAFA]/80 hover:text-white"
                    >
                      Google Play
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#FAFAFA]/50" suppressHydrationWarning>
                © {new Date().getFullYear()} Plated. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
