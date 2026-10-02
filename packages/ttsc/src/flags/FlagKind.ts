/**
 * Argument shape of a flag.
 *
 * - `boolean` — `--flag` with an optional spaced `true` / `false`. Launcher flags
 *   also accept `--flag=true` / `--flag=false`; tsgo-forwarded flags stay
 *   verbatim because pinned tsgo does not split `=`.
 * - `value` — `--flag value`. Launcher flags also accept `--flag=value`.
 * - `valueOptional` — reserved optional-value shape. No current schema row uses
 *   it, and the launcher consumption helper does not implement a standalone
 *   optional-value branch. This literal does not advertise an active CLI feature.
 *
 * @evidence contracts/common.md#principled-implementation The active schema's boolean and value rows are parsed locally when launcher-owned, while compiler-owned spellings retain native parser semantics. valueOptional remains an unused vocabulary member without a launcher consumption branch.
 * @evidence contracts/common.md#clear-and-simple-design Arity belongs to each FlagSpec through one small vocabulary instead of being inferred independently by every forwarding layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The documented distinction between launcher equals forms and native verbatim forwarding follows the pinned compiler's option grammar rather than patching its parser.
 * @evidence contracts/common.md#meaningful-documentation The native bullet list explains each arity and the equals-form boundary; it explicitly identifies the unused optional-value shape rather than implying an active CLI feature.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type FlagKind = "boolean" | "value" | "valueOptional";
