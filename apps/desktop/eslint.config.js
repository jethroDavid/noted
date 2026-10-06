import base from "@noted/eslint-config/base";

// No boundary markers: the Electron main process is plain Node outside the
// Next server/client model (mirrors apps/mobile, which sets no boundary).
export default [
  ...base,
  {
    ignores: ["release/**"],
  },
];
