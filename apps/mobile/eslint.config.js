import base from "@noted/eslint-config/base";

export default [
  ...base,
  {
    ignores: ["android/**", "www/**"],
  },
];
