import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import base from "./base.js";

export default tseslint.config(...base, {
  plugins: {
    react,
    "react-hooks": reactHooks,
    "jsx-a11y": jsxA11y,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...react.configs["jsx-runtime"].rules,
    ...reactHooks.configs.recommended.rules,
    ...jsxA11y.configs.recommended.rules,
  },
});
