/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genera un sitio 100% estático en `out/` (despliegue con Nginx en EC2).
  output: "export",
  images: {
    // Requerido por `output: "export"`: no hay servidor de optimización de imágenes.
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
