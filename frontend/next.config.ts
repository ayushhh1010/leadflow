import type { NextConfig } from "next";

// The browser only ever talks to this Next.js server; `/api/*` is proxied to FastAPI,
// so there is no CORS surface. Rewrites are resolved at build time for `next build`.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // The Docker image sets NEXT_OUTPUT=standalone to ship a minimal Node server.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // End-to-end tests build into their own folder so they never overwrite your build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Don't let `next dev` write AGENTS.md into the project.
  agentRules: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
