import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "dist/**",
      "docs/source-material/**",
      "node_modules/**",
      "out/**",
    ],
  },
  ...nextVitals,
  ...nextTypescript,
];

export default eslintConfig;
