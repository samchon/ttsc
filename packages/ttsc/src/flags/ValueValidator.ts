/**
 * Validation predicate for `value`-kind flags. `none` is the default (accept
 * any string).
 *
 * @evidence contracts/common.md#principled-implementation The validator vocabulary distinguishes unrestricted strings from the native checkers option's positive decimal integer requirement; parseFlags owns the actual lexical and range validation.
 * @evidence contracts/common.md#clear-and-simple-design A literal selector keeps validation choice declarative without carrying executable predicates in schema rows or duplicating parser logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts positiveInt represents the compiler's real minimum-value contract and does not encode expected test answers.
 * @evidence contracts/common.md#meaningful-documentation The comment states the default's acceptance behavior; the declaration and parser documentation supply the numeric contract using the documentation skill's brief purpose-focused prose.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type ValueValidator = "none" | "positiveInt";
