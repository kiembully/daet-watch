import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  // eslint-config-next 16 exports flat configs directly. Wrapping them in
  // FlatCompat throws "Converting circular structure to JSON" on eslint 9+.
  ...coreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "public/sw.js", "scripts/gen-icons.mjs"],
  },
  {
    rules: {
      // Issue photos come from Cloudinary with their own transforms; next/image
      // would add a second optimizer hop and count against the plan's quota.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
