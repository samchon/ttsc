import type { ITtscEvidenceDocumentedConfig } from "./ITtscEvidenceDocumentedConfig";
import type { ITtscEvidenceGraphConfig } from "./ITtscEvidenceGraphConfig";

/**
 * Rule names of the Evidence lint contributor with their option contracts.
 *
 * Pass this interface as the generic argument of `ITtscLintConfig` so every
 * Evidence rule receives exact severity-plus-options checking, and a rule that
 * takes no options accepts a severity only:
 *
 * ```ts
 * import type { ITtscLintConfig } from "@ttsc/lint";
 * import type { ITtscEvidenceRules } from "@ttsc/evidence";
 *
 * export default {
 *   rules: { "evidence/singular": "error" },
 * } satisfies ITtscLintConfig<ITtscEvidenceRules>;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Each rule name maps to the options object the rule accepts, or to `void` when it takes severity only, which is exactly the shape the lint package's contributor overlay consumes.
 * @evidence contracts/common.md#clear-and-simple-design One ordinary exported interface lists the five rules once, so no ambient module augmentation is needed and the member comments stay beside the names they describe.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The options of the two configurable rules reference their declared config types rather than an unknown slot, and the optionless rules are not given an invented options object.
 * @evidence contracts/common.md#meaningful-documentation The example shows the user side of the pattern and each member explains the rule it names, following the documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This interface lists rule names and option types and names no path, file, filesystem or process itself.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no algorithm and performs no computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration coordinates no computation across requests, so there is no result to share.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration owns no retained state, handle or running task.
 */
export interface ITtscEvidenceRules {
  /**
   * Declares this project's evidence graph.
   *
   * The claims define the citing populations and the independently complete
   * evidence references each one must acknowledge.
   */
  "evidence/graph": ITtscEvidenceGraphConfig;

  /**
   * Requires a JSDoc block on every selected export.
   *
   * A JSDoc block is the only place a TypeScript declaration's `@evidence`
   * tag is read from, so an export without one cannot cite anything.
   */
  "evidence/documented": ITtscEvidenceDocumentedConfig;

  /**
   * Requires one public identity per TypeScript file, named after the file.
   *
   * The counted unit is an identity rather than an export, so declaration
   * merging of a single name stays legal: `export interface ISomething`
   * beside `export namespace ISomething`, `export class Something` beside
   * `export namespace Something`, and `export const something` beside `export
   * default something` are each one identity.
   *
   * A file that only re-exports owns no identity and is never reported, and
   * an `index` file is exempt from the name match while still limited to one
   * identity.
   *
   * The rule takes no options; per-directory scoping belongs in the outer
   * `files` setting of `lint.config.ts`.
   */
  "evidence/singular": void;

  /**
   * Reports every JSDoc `@todo` tag in a checked file.
   *
   * A remaining `@todo` is a contract the declaration has not realized yet,
   * so each tag fails the build with its own text until the declaration is
   * realized and the tag removed. Every declaration's block is read, exported
   * or not, on any symbol kind.
   *
   * The rule takes no options; per-directory scoping belongs in the outer
   * `files` setting of `lint.config.ts`.
   */
  "evidence/todo": void;

  /**
   * Requires a review beside every acknowledgement.
   *
   * Every `@evidence` and `@evidenceExclude` on a public identity must be
   * answered by `@evidenceReview` or `@evidenceExcludeReview`, respectively,
   * naming the same target. The citation states why this declaration answers
   * for that target; the review states what was verified. Those are different
   * questions, and only the first one is written unless something asks for
   * the second.
   *
   * A review is an annotation of a citation, never an acknowledgement of a
   * unit. It discharges no coverage, contributes no host to `uniqueEvidence`,
   * and counts toward no `singleEvidencePerSymbol` total, so enabling this
   * rule cannot change a single `evidence/graph` diagnostic.
   *
   * The optional `#`-prefixed fingerprint token is carried without being
   * interpreted here. `evidence/graph` validates it against the cited content
   * under a reference's `requireReview`, which is what makes a review expire
   * when the thing it reviewed moves.
   *
   * The rule takes no options; per-directory scoping belongs in the outer
   * `files` setting of `lint.config.ts`.
   */
  "evidence/review": void;
}
