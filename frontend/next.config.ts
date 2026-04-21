import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_REVIEWFLOW_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ],
  }),
};

export default nextConfig;
