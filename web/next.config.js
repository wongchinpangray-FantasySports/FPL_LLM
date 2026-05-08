const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Required by OpenNext for Cloudflare Workers builds */
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "resources.premierleague.com" },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
