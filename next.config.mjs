/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ably ships build output with syntax webpack's parser rejects; let Next's
  // SWC compiler transpile the package so it bundles cleanly.
  transpilePackages: ["ably"],
};

export default nextConfig;
