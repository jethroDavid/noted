import type { Linter } from "eslint";

type Boundary = "server" | "client" | "shared" | "explicit";

const serverMarker =
  "[body.0.type='ImportDeclaration'][body.0.source.value='server-only'][body.0.specifiers.length=0][body.0.importKind!='type']";
const clientMarker = "[body.0.directive='use client']";
const actionMarker = "[body.0.directive='use server']";

const restrictions = {
  server: [
    {
      selector: `Program:not(${serverMarker})`,
      message: 'Backend files must start with import "server-only";.',
    },
    {
      selector:
        "Program > ExpressionStatement[directive=/^use (client|server)$/], ImportDeclaration[source.value='client-only']",
      message:
        'Backend packages use import "server-only"; rather than React client or Server Function directives.',
    },
  ],
  client: [
    {
      selector: `Program:not(${clientMarker})`,
      message: 'Client modules must start with "use client";.',
    },
    {
      selector:
        "Program > ExpressionStatement[directive='use server'], ImportDeclaration[source.value='server-only']",
      message: "Client modules must not contain server boundary markers.",
    },
  ],
  shared: [
    {
      selector:
        "Program > ExpressionStatement[directive=/^use (client|server)$/], ImportDeclaration[source.value=/^(server|client)-only$/]",
      message:
        "Shared packages must remain usable by both the server and browser, without environment markers.",
    },
  ],
  explicit: [
    {
      selector: `Program:not(${serverMarker}):not(${clientMarker}):not(${actionMarker})`,
      message:
        'App modules must declare their boundary: import "server-only";, "use client";, or "use server"; for Server Functions.',
    },
  ],
} satisfies Record<Boundary, { selector: string; message: string }[]>;

export function boundaryConfig(
  boundary: Boundary,
  files = ["src/**/*.{ts,tsx}"],
): Linter.Config {
  return {
    name: `noted/${boundary}-boundary`,
    files,
    ignores: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...restrictions[boundary]],
    },
  };
}
