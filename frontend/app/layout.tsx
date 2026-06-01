import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { CookieBanner } from "@/components/cookie-banner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CourseKin",
  description: "Generate study reviewers from your notes, PDFs, and links",
  applicationName: "CourseKin",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CourseKin",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#161a17" },
  ],
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
          <ServiceWorkerRegister />
        </body>
      </html>
    </ClerkProvider>
  );
}
