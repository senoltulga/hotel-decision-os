/** @type {import('next').NextConfig} */
export default {
  productionBrowserSourceMaps: false, // kod koruma: prod'da source map yok
  poweredByHeader: false,
  transpilePackages: ["@hotel-decision-os/payback-engine"],
};
