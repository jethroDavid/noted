import reactConfig from "@noted/eslint-config/react";

export default [
  ...reactConfig,
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
