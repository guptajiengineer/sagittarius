/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sagittarius/db', '@sagittarius/queue', '@sagittarius/shared-types', '@sagittarius/config'],
}

export default nextConfig
