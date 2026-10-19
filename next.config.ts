import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite"],
  // Drop screenshots are uploaded through a server action (nginx allows 5m).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
