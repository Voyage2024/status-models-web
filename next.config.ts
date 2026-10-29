import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Comp Card: react-pdf тянет свои воркеры и fontkit, бандлить его webpack-ом не нужно.
  serverExternalPackages: ["@react-pdf/renderer"],
  // TTF для PDF читаются с диска, без этого Vercel не положит их в функцию.
  outputFileTracingIncludes: { "/[locale]/models/[slug]/comp-card": ["./lib/comp-card/fonts/*.ttf"] },
  // Слеш на конце снимает middleware: так старые URL WordPress («/kira_raab/») получают один 301, без промежуточного 308.
  skipTrailingSlashRedirect: true,
  images: {
    // Фото моделей лежат в публичном bucket Supabase Storage (models-public).
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" }],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
