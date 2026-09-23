/**
 * The predicate the compiler observed on one watch input, which decides how the
 * adapter's own observer watches it for a change (samchon/ttsc#1388).
 *
 * - `file`: content or existence of a path that exists, watched for its edit.
 * - `missing`: a path observed absent, whose creation is the change.
 * - `listing`: a directory's entries, enumerated by the compiler, watched for an
 *   entry appearing or disappearing.
 * - `presence`: a directory observed to exist, and nothing more. The compiler
 *   consults this only to gate descendant probes, each of which is a watch
 *   input in its own right, so nothing is watched for it.
 * - `membership`: the project's root files, which the adapter's own project walk
 *   decides (samchon/ttsc#1419), observed by walking the project again when a
 *   directory the walk enters changes.
 */
export type TtscWatchInputKind =
  | "file"
  | "listing"
  | "membership"
  | "missing"
  | "presence";
