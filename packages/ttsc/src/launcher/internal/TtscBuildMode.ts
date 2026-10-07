/**
 * Supported compiler commands sharing the launcher build adapter. Mutation
 * commands reject watch and single-file modes; check suppresses one-shot emit.
 *
 * @evidence contracts/common.md#principled-implementation Four literal commands represent exactly the compiler commands that share the launcher build adapter.
 * @evidence contracts/common.md#clear-and-simple-design A closed union lets the same command decision serve CLI execution and direct unit verification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported command strings cannot enter the adapter through this maintained type.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the supported command distinction and its mutation/check consequences.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type TtscBuildMode = "build" | "check" | "fix" | "format";
