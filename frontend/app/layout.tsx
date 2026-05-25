import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { CookieBanner } from "@/components/cookie-banner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CourseKin",
  description: "Generate study reviewers from your notes, PDFs, and links",
};

const themeScript = `
(function () {
  try {
    function applyTheme(preference) {
      var resolved =
        preference === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : preference;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.dataset.theme = resolved;
    }

    var raw = localStorage.getItem("reviewflow_ui_preferences_v1");
    var parsed = raw ? JSON.parse(raw) : {};
    var preference = parsed.theme ?? "system";
    applyTheme(preference);

    if (preference === "system") {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        var r = localStorage.getItem("reviewflow_ui_preferences_v1");
        var p = r ? JSON.parse(r) : {};
        if ((p.theme ?? "system") === "system") {
          applyTheme("system");
        }
      });
    }
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
    >
      <html lang="en" suppressHydrationWarning className={inter.variable}>
        <body className="min-h-screen font-sans antialiased">
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          {children}
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}
