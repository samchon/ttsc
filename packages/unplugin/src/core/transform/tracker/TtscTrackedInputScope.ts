/**
 * Which events can change what the compiler observed about one tracked input
 * (samchon/ttsc#1384).
 *
 * Every scope counts a rename of the input's own path and a rename of any of
 * its ancestors, since replacing or moving a directory moves everything below
 * it without an event on each descendant. A content change of an ancestor never
 * counts. The scopes differ in what else they admit:
 *
 * - `content`: a `ReadFile`, so a content change of the path itself counts too.
 * - `presence`: `FileExists`, `DirectoryExists`, `Stat`, or `Realpath` alone.
 *   Only a rename can change those answers, so neither a content change of the
 *   path (Windows reports a write below a directory as one) nor anything below
 *   it counts. This is what keeps a write under `node_modules`, which the
 *   resolver probes for existence alone, from counting against a generation.
 * - `children`: a directory listing (`GetAccessibleEntries`). A rename of a
 *   direct child adds or removes an entry; anything deeper does not.
 * - `subtree`: a missing path's first missing component, whose creation can
 *   arrive through any descendant, or a directory whose observation is unknown
 *   and so keeps the conservative answer: any event on or below it.
 * - `tree`: a plugin's Go source directory (samchon/ttsc#1487), whose state any
 *   file below it can move. Any event on or below it counts, except below a
 *   directory the plugin build passes over (`pluginSourceCovers`), and it is
 *   watched as a whole subtree wherever it lies.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The finite union represents distinct compiler observation authorities:
 *   contents, presence, direct entries, conservative subtree and plugin tree.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Literal variants carry no redundant flags; scope derivation and event
 *   interpretation share this one vocabulary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Each variant describes an observed dependency class, including ancestor
 *   replacement, rather than a special list of test paths.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose and the parallel variant list explain events and reasons;
 *   the type remains the documentation authority under the documentation skill.
 */
export type TtscTrackedInputScope =
  | "children"
  | "content"
  | "presence"
  | "subtree"
  | "tree";
