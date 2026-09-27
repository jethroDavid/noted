import base from "@noted/eslint-config/base";

export default [
  ...base,
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
                "packages/domain must not import other workspace libraries (see README Layout).",
            },
          ],
        },
      ],
    },
  },
];
