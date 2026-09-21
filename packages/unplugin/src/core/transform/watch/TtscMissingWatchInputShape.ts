/**
 * What must appear at a `missing` watch input for the compiler's view of it to
 * change, decided by `missingWatchInputShape` from the predicate the compiler
 * recorded, and handed to a host's missing channel beside the path.
 *
 * - `directory`: only a directory appearing changes the compiler's answer.
 * - `file`: only a file appearing does.
 * - `either`: the registration cannot say which; a recovery registration after a
 *   failed compile carries no evidence at all, and the compiler probes a
 *   directory it resolves through exactly like a file it could not find.
 *
 * A host whose channels each observe one kind of creation, or whose file
 * channel reads the path and fails on a directory, takes the channel the shape
 * allows: see `registerBuildWatchInputs` and the Turbopack loader.
 */
export type TtscMissingWatchInputShape = "directory" | "either" | "file";
