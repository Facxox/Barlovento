/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        // Forzar no-store en chunks JS para que el navegador no
        // sirva versiones viejas después de un deploy. Es la causa
        // de los React #425/#418/#423 que el usuario seguía viendo
        // después de los fixes: el bundle viejo seguía cargado en
        // la cache del browser y producía mismatches con el HTML
        // nuevo del server.
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;