import { boundaryConfig } from "@noted/eslint-config/boundaries";
import base from "@noted/eslint-config/react";

export default [
  ...base,
  boundaryConfig("client"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@noted/api/**",
                "@noted/auth/**",
                "@noted/db/**",
                "@noted/media/**",
                "@noted/queue/**",
                "@noted/realtime/**",
              ],
              allowTypeImports: true,
              message: "Use API types and the shell-provided runtime.",
            },
          ],
        },
      ],
    },
  },
];
