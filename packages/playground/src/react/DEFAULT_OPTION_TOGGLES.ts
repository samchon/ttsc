import type { IOptionToggle } from "../structures/IOptionToggle";

/** Default toggles for sites that wire the bundled typia / lint plugins. */
export const DEFAULT_OPTION_TOGGLES: readonly IOptionToggle[] = [
  {
    key: "typia",
    label: "typia",
    description: "Generate runtime validators from TypeScript types.",
  },
  {
    key: "lint",
    label: "@ttsc/lint",
    description: "Report a subset of lint rules over the source AST.",
  },
];
