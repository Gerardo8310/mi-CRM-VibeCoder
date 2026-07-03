import nextConfig from "eslint-config-next";

/** eslint-config-next ya exporta config plano (flat) — no hace falta FlatCompat. */
const eslintConfig = [
  ...nextConfig,
  {
    // convex/_generated es autogenerado por `npx convex dev`.
    // Design/ es la carpeta de maquetas de diseño (.dc.html + support.js),
    // no forma parte del código fuente de la app.
    ignores: ["convex/_generated/**", "Design/**"],
  },
];

export default eslintConfig;
