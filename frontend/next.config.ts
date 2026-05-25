import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const apiUpstreamUrl = (
  process.env.COURSEKIN_API_UPSTREAM_URL ??
  process.env.NEXT_PUBLIC_COURSEKIN_API_URL ??
  process.env.NEXT_PUBLIC_REVIEWFLOW_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/api/:path*",
        destination: `${apiUpstreamUrl}/:path*`,
      },
    ],
  }),
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "coursekin-web",
  authToken: process.env.SENTRY_AUTH_TOKEN, // server-side only, for source map uploads
});
