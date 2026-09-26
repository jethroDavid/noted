import nextPlugin from "@next/eslint-plugin-next";
import reactConfig from "@noted/eslint-config/react";
import tseslint from "typescript-eslint";

export default tseslint.config(...reactConfig, {
  plugins: { "@next/next": nextPlugin },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
  },
});
