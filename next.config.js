/** @type {import('next').NextConfig} */
module.exports = {
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'eiigkxxfusblunuwfzkt.supabase.co', pathname: '/storage/v1/object/**' }] },
  async headers() { return [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ] }, { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }] },
}
