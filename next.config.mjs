import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  outputFileTracingExcludes: {
    "/*": ["./data/**/*"],
  },
};

export default nextConfig;
