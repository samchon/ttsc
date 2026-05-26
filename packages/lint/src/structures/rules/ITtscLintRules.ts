import type { ITtscLintBoundariesRules } from "./ITtscLintBoundariesRules";
import type { ITtscLintContributorRules } from "./ITtscLintContributorRules";
import type { ITtscLintCoreRules } from "./ITtscLintCoreRules";
import type { ITtscLintCypressRules } from "./ITtscLintCypressRules";
import type { ITtscLintEslintCommentsRules } from "./ITtscLintEslintCommentsRules";
import type { ITtscLintFunctionalRules } from "./ITtscLintFunctionalRules";
import type { ITtscLintJestRules } from "./ITtscLintJestRules";
import type { ITtscLintJsdocRules } from "./ITtscLintJsdocRules";
import type { ITtscLintJsxA11yRules } from "./ITtscLintJsxA11yRules";
import type { ITtscLintNextjsRules } from "./ITtscLintNextjsRules";
import type { ITtscLintPlaywrightRules } from "./ITtscLintPlaywrightRules";
import type { ITtscLintPromiseRules } from "./ITtscLintPromiseRules";
import type { ITtscLintReactPerfRules } from "./ITtscLintReactPerfRules";
import type { ITtscLintReactRules } from "./ITtscLintReactRules";
import type { ITtscLintRegexpRules } from "./ITtscLintRegexpRules";
import type { ITtscLintSecurityRules } from "./ITtscLintSecurityRules";
import type { ITtscLintSolidRules } from "./ITtscLintSolidRules";
import type { ITtscLintStorybookRules } from "./ITtscLintStorybookRules";
import type { ITtscLintTanstackQueryRules } from "./ITtscLintTanstackQueryRules";
import type { ITtscLintTestingLibraryRules } from "./ITtscLintTestingLibraryRules";
import type { ITtscLintTypeScriptRules } from "./ITtscLintTypeScriptRules";
import type { ITtscLintVitestRules } from "./ITtscLintVitestRules";

/**
 * Rule severity map accepted by `ITtscLintConfig.rules`.
 *
 * Built-in rule families are exposed as separate interfaces under this
 * directory so users can import a narrow family type when composing
 * configs. `ITtscLintRules` is the intersection of every built-in
 * family plus the open-ended contributor plugin signature.
 *
 * Rule id conventions:
 *
 * - Bare kebab-case ids (`eqeqeq`, `no-console`) belong to
 *   {@link ITtscLintCoreRules} — generic ESLint-compatible rules
 *   that apply to both JS and TS source.
 * - `typescript/*` ids belong to {@link ITtscLintTypeScriptRules} —
 *   TypeScript-only and `@typescript-eslint` plugin rules.
 *   `@ttsc/lint` does not accept legacy bare names or
 *   `@typescript-eslint/*` aliases for these rules.
 * - `react/*` ids in {@link ITtscLintReactRules} bundle
 *   `eslint-plugin-react`, `eslint-plugin-react-hooks`, and
 *   `eslint-plugin-react-refresh`. Performance-only React rules live
 *   separately in {@link ITtscLintReactPerfRules} because they are
 *   opt-in toggles rather than correctness checks (matching Oxlint).
 * - Every other namespaced id (`boundaries/*`, `cypress/*`,
 *   `functional/*`, ...) is a built-in family with a matching
 *   interface in this directory.
 * - Formatter behavior is **not** configured here. Use the top-level
 *   `format` block (typed as `ITtscLintFormat`); `format/*` is an
 *   internal implementation detail of `ttsc format` and is
 *   deliberately absent from the public rules surface.
 * - Any other `"<namespace>/<rule>"` key is accepted via
 *   {@link ITtscLintContributorRules} so plugin-shipped rules
 *   compose cleanly without ambient module augmentation.
 */
export type ITtscLintRules = ITtscLintCoreRules &
  ITtscLintTypeScriptRules &
  ITtscLintBoundariesRules &
  ITtscLintCypressRules &
  ITtscLintEslintCommentsRules &
  ITtscLintFunctionalRules &
  ITtscLintJestRules &
  ITtscLintJsdocRules &
  ITtscLintJsxA11yRules &
  ITtscLintNextjsRules &
  ITtscLintPlaywrightRules &
  ITtscLintPromiseRules &
  ITtscLintReactRules &
  ITtscLintReactPerfRules &
  ITtscLintRegexpRules &
  ITtscLintSecurityRules &
  ITtscLintSolidRules &
  ITtscLintStorybookRules &
  ITtscLintTanstackQueryRules &
  ITtscLintTestingLibraryRules &
  ITtscLintVitestRules &
  ITtscLintContributorRules;
