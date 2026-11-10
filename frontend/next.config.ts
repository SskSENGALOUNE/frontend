import type { NextConfig } from "next";

// The browser calls /api/v1/* on the Next server, which forwards to the Go backend,
// so no CORS setup is needed.
// NOTE: rewrites are resolved when the app is built (`next build`) and when `next dev` starts,
// so BACKEND_URL must be set at that moment; changing it later has no effect on an existing build.
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // e2e builds go to their own folder so they never overwrite (or get mixed up with) the normal build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // self-contained server in .next/standalone, only for the Docker image (frontend/Dockerfile sets this);
  // `next start` (dev machine, e2e) does not support standalone output
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*` }];
  },
};

export default nextConfig;
