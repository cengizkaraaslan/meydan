import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // iyzipay paketi `fs.readdirSync` + dinamik require kullanır; Turbopack/webpack
  // bundle edemediği için server external olarak işaretle.
  serverExternalPackages: ["iyzipay"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "cdn.biletix.com" },
      { protocol: "https", hostname: "cdn.bubilet.com.tr" },
      { protocol: "https", hostname: "cdn.passo.com.tr" },
      { protocol: "https", hostname: "www.ibb.istanbul" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "randomuser.me" },
      { protocol: "https", hostname: "muze.gov.tr" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default withNextIntl(nextConfig);
