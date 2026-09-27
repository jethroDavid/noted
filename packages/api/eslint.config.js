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
                "@noted/ui",
                "@noted/ui/**",
                "@noted/web",
                "@noted/web/**",
              ],
              message:
                "packages/api must only import the auth, db, domain, realtime, and validators libraries (see README Layout).",
            },
          ],
        },
      ],
    },
  },
];
