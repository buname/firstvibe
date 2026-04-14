import type { NextConfig } from "next";
import WebpackObfuscator from "webpack-obfuscator";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Force Next to use this project folder as root (avoids parent lockfile inference).
    root: process.cwd(),
  },
  // Keep source maps off in production so readable source is not shipped.
  productionBrowserSourceMaps: false,
  compiler: {
    // Strip console.* calls in production bundles.
    removeConsole: process.env.NODE_ENV === "production",
  },
  webpack: (config, { dev, isServer }) => {
    const obfuscationEnabled =
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_ENABLE_OBFUSCATION !== "false";

    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          chunks: "all",
        },
      };
    }

    if (!dev && !isServer && obfuscationEnabled) {
      config.plugins.push(
        new WebpackObfuscator(
          {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            stringArray: true,
            stringArrayEncoding: ["rc4"],
            rotateStringArray: true,
            transformObjectKeys: true,
            renameGlobals: false,
          },
          [
            "**/framework-*.js",
            "**/main-*.js",
            "**/polyfills-*.js",
            "**/webpack-*.js",
          ]
        )
      );
    }

    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
