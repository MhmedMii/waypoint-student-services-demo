/** @type {import('next').NextConfig} */

// هيدرز الأمان تنطبق على كل المسارات. ما ضفنا Content-Security-Policy هنا عن قصد —
// Next يحقن سكربتات inline، و CSP غلط يكسر الصفحات بصمت بالمتصفح بدون ما يطلع أي
// خطأ بالبِلد أو التستات، فلازم تتضبط وتتجرب بمتصفح لحالها.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  devIndicators: false,
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
module.exports = nextConfig
