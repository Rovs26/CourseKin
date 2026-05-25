import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const apiUrl =
  process.env.NEXT_PUBLIC_REVIEWFLOW_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ],
  }),
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: "reviewflow-web",
  authToken: process.env.SENTRY_AUTH_TOKEN, // server-side only, for source map uploads
});
