import { boundaryConfig } from "@noted/eslint-config/boundaries";
import reactConfig from "@noted/eslint-config/react";

export default [
  ...reactConfig,
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
                "@noted/auth",
                "@noted/auth/**",
                "@noted/db",
                "@noted/db/**",
                "@noted/domain",
                "@noted/domain/**",
                "@noted/infra",
                "@noted/infra/**",
                "@noted/media",
                "@noted/media/**",
                "@noted/queue",
                "@noted/queue/**",
                "@noted/realtime",
                "@noted/realtime/**",
                "@noted/ui",
                "@noted/ui/**",
                "@noted/validators",
                "@noted/validators/**",
                "@noted/web",
                "@noted/web/**",
              ],
              message:
                "packages/ui must not import other workspace libraries (see README Layout).",
            },
          ],
        },
      ],
    },
  },
];
