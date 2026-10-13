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
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { MERCHANT_PRODUCT_IMAGES: JSON.stringify(merchantImages) },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      ...(supabaseHostname ? [{
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/ecommerce-product-images/**"
      }] : [])
    ]
  }
};

export default nextConfig;
