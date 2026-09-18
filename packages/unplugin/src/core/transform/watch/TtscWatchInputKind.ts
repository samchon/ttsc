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
 */
export type TtscWatchInputKind = "file" | "listing" | "missing" | "presence";
