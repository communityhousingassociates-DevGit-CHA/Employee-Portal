import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname }]
      : [],
  },
  // middleware.ts sets the full header set (CSP included) on every page/API
  // response, but its matcher deliberately excludes _next/static, favicon,
  // and image files. Those still deserve the two headers that are safe to
  // apply blindly to static assets — a ZAP baseline scan flagged them missing.
  async headers() {
    return [
      {
        source: "/(_next/static/.*|favicon.ico|icon.png|apple-icon.png)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
