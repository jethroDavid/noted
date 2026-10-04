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
                "@noted/infra",
                "@noted/infra/**",
                "@noted/ui",
                "@noted/ui/**",
                "@noted/web",
                "@noted/web/**",
              ],
              message:
                "packages/api must only import the auth, db, domain, media, queue, realtime, and validators libraries (see README Layout).",
            },
          ],
        },
      ],
    },
  },
];
