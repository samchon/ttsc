/**
 * Supported compiler commands sharing the launcher build adapter. Mutation
 * commands reject watch and single-file modes; check suppresses one-shot emit.
 *
 * @evidence contracts/common.md#principled-implementation Four literal commands represent exactly the existing launcher's compatible build lanes.
 * @evidence contracts/common.md#clear-and-simple-design A closed union lets the same command decision serve CLI execution and direct unit verification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported command strings cannot enter the adapter through this maintained type.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the supported command distinction and its mutation/check consequences.
 */
export type TtscBuildMode = "build" | "check" | "fix" | "format";
