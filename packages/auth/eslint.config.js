import base from "@noted/eslint-config/base";
import { boundaryConfig } from "@noted/eslint-config/boundaries";

export default [
  ...base,
  boundaryConfig("server"),
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
                "packages/auth must not import other workspace libraries (see README Layout).",
            },
          ],
        },
      ],
    },
  },
];
