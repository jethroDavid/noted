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
                "@noted/api/**",
                "@noted/auth/**",
                "@noted/db/**",
                "@noted/realtime/**",
                "@noted/queue/**",
                "@noted/media/**",
                "@noted/infra/**",
              ],
              allowTypeImports: true,
              message:
                "The native renderer may import backend types only. Use its typed tRPC client for requests.",
            },
          ],
        },
      ],
    },
  },
];
