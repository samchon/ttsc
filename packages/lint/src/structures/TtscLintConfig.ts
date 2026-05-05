import type { TtscLintRule } from "./TtscLintRule";
import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * Inline rule map accepted by the `@ttsc/lint` tsconfig plugin entry.
 *
 * Each property key is a native lint rule name. Omitted rules are disabled,
 * while present rules enable or disable that rule for the current project.
 */
export type TtscLintConfig = {
  [P in TtscLintRule]?: TtscLintSeverity;
};
