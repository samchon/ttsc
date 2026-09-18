/**
 * The predicate the compiler observed on one watch input, which decides the
 * host channel that can observe its change (samchon/ttsc#1388).
 *
 * - `file`: content or existence of a path that exists. Any file channel observes
 *   it.
 * - `missing`: a path observed absent, whose creation is the change. Only a
 *   channel that observes creation will see it.
 * - `listing`: a directory's entries, enumerated by the compiler. Only a
 *   directory channel sees an entry appear or disappear.
 * - `presence`: a directory observed to exist, and nothing more. The compiler
 *   consults this only to gate descendant probes, each of which is a watch
 *   input in its own right, so build hosts are given no registration for it.
 * - `membership`: the project's root files, which the adapter's own project walk
 *   decides (samchon/ttsc#1419). Only a watching session observes it, through
 *   its bridge or dev server watcher, and esbuild through `watchDirs`. A
 *   one-shot build host has no channel for it: its directory channel is
 *   recursive, so registering the project's directories would invalidate every
 *   module on any edit below them.
 */
export type TtscWatchInputKind =
  | "file"
  | "listing"
  | "membership"
  | "missing"
  | "presence";
