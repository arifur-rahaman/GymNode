import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Shared workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@gymnode/core", "@gymnode/db"],
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
