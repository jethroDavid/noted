import sortImports from "@ianvs/prettier-plugin-sort-imports";
import * as tailwind from "prettier-plugin-tailwindcss";

/** @type {import("prettier").Config} */
export default {
  plugins: [sortImports, tailwind],
};
