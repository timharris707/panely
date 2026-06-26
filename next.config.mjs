/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingExcludes: {
    "/*": ["./data/**/*"],
  },
};

export default nextConfig;
