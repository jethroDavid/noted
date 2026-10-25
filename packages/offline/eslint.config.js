import base from "@noted/eslint-config/base";
import { boundaryConfig } from "@noted/eslint-config/boundaries";

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
                "@noted/api",
                "@noted/api/**",
                "@noted/auth/**",
                "@noted/db/**",
                "@noted/media/**",
                "@noted/queue/**",
                "@noted/realtime/**",
                "@noted/infra/**",
                "@noted/web/**",
              ],
              message:
                "Offline persistence cannot import backend implementations or app shells.",
            },
          ],
        },
      ],
    },
  },
];
