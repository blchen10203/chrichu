import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // static site, no server (spec section 2)
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
