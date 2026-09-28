import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const productImagesDirectory = fileURLToPath(new URL("./public/produtos/", import.meta.url));
const merchantImages = readdirSync(productImagesDirectory, { recursive: true })
  .filter((file) => /\.(png|jpe?g|webp|gif|avif)$/i.test(file))
  .filter((file) => {
    const asset = statSync(path.join(productImagesDirectory, file));
    return asset.isFile() && asset.size > 0;
  })
  .map((file) => `/produtos/${file.replace(/\\/g, "/")}`);
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { MERCHANT_PRODUCT_IMAGES: JSON.stringify(merchantImages) },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  }
};

export default nextConfig;
