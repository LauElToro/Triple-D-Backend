/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],
  // CORS (incl. preflight) is handled centrally in src/middleware.ts so that
  // credentials + custom headers + OPTIONS work correctly cross-origin.
};

export default nextConfig;
