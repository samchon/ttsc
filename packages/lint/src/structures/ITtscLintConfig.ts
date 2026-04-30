import type { ITtscLintRule } from "./ITtscLintRule";
import type { ITtscLintSeverity } from "./ITtscLintSeverity";

export type ITtscLintConfig = {
  [P in ITtscLintRule]?: ITtscLintSeverity;
};
