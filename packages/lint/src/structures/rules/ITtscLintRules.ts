import type { ITtscLintBoundariesRules } from "./ITtscLintBoundariesRules";
import type { ITtscLintContributorRules } from "./ITtscLintContributorRules";
import type { ITtscLintCoreRules } from "./ITtscLintCoreRules";
import type { ITtscLintCypressRules } from "./ITtscLintCypressRules";
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
import type { TtscLintRuleOptionsOverlay } from "./ITtscLintRuleOptionsMap";
import type { ITtscLintSecurityRules } from "./ITtscLintSecurityRules";
import type { ITtscLintSolidRules } from "./ITtscLintSolidRules";
import type { ITtscLintStorybookRules } from "./ITtscLintStorybookRules";
import type { ITtscLintTanstackQueryRules } from "./ITtscLintTanstackQueryRules";
import type { ITtscLintTestingLibraryRules } from "./ITtscLintTestingLibraryRules";
import type { ITtscLintTypeScriptRules } from "./ITtscLintTypeScriptRules";
import type { ITtscLintUnicornRules } from "./ITtscLintUnicornRules";
import type { ITtscLintVitestRules } from "./ITtscLintVitestRules";

/**
 * Rule severity map accepted by `ITtscLintConfig.rules`.
 *
 * Built-in rule families are exposed as separate interfaces under this
 * directory so users can import a narrow family type when composing configs.
 * `ITtscLintRules` is the intersection of every built-in family plus the
 * open-ended contributor plugin signature.
 *
 * Rule id conventions:
 *
 * - Bare kebab-case ids (`eqeqeq`, `no-console`) belong to
 *   {@link ITtscLintCoreRules} — generic ESLint-compatible rules that apply to
 *   both JS and TS source.
 * - `typescript/*` ids belong to {@link ITtscLintTypeScriptRules} —
 *   TypeScript-only and `@typescript-eslint` plugin rules. `@ttsc/lint` does
 *   not accept legacy bare names or `@typescript-eslint/*` aliases for these
 *   rules.
 * - `react/*` ids in {@link ITtscLintReactRules} bundle `eslint-plugin-react`,
 *   `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`.
 *   Performance-only React rules live separately in
 *   {@link ITtscLintReactPerfRules} because they are opt-in toggles rather than
 *   correctness checks (matching Oxlint).
 * - Every other namespaced id (`boundaries/*`, `cypress/*`, `functional/*`, ...)
 *   is a built-in family with a matching interface in this directory.
 * - Formatter behavior is **not** configured here. Use the top-level `format`
 *   block (typed as `ITtscLintFormat`); `format/*` is an internal
 *   implementation detail of `ttsc format` and is deliberately absent from the
 *   public rules surface.
 * - Any other `"<namespace>/<rule>"` key is accepted via
 *   {@link ITtscLintContributorRules} so plugin-shipped rules compose cleanly
 *   without ambient module augmentation. A plugin publishes an exported rule
 *   interface that the user passes to `ITtscLintConfig` as its generic argument;
 *   {@link TtscLintContributorOverlay} then tightens those rules' options while
 *   the open fallback remains for unlisted contributor names.
 *
 * @evidence contracts/common.md#principled-implementation Intersecting family maps and the contributor overlay preserves concrete built-in properties while keeping the open contributor fallback for unlisted names; the typed contributor overlay is added by the config type that uses this alias.
 * @evidence contracts/common.md#clear-and-simple-design One composition alias assembles independently owned rule families and the contributor extension boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Rule families enter through explicit types rather than consumer-specific aliases or runtime mutation.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes bare, namespaced, formatter and contributor identities and explains the generic contributor overlay; lists, paragraphs and tag separation follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintRules is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintRules is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintRules is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintRules is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type ITtscLintRules = ITtscLintCoreRules &
  ITtscLintTypeScriptRules &
  ITtscLintBoundariesRules &
  ITtscLintCypressRules &
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
  ITtscLintUnicornRules &
  ITtscLintVitestRules &
  ITtscLintContributorRules &
  TtscLintRuleOptionsOverlay;
