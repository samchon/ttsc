/**
 * Which events can change what the compiler observed about one tracked input
 * (samchon/ttsc#1384).
 *
 * Every scope counts a rename of the input's own path and a rename of any of
 * its ancestors, since replacing or moving a directory moves everything below
 * it without an event on each descendant. A content change of an ancestor never
 * counts. The scopes differ in what else they admit:
 *
 * - `content`: a file read or a file-compatible mixed observation, so a content
 *   change of the path itself counts too.
 * - `presence`: `FileExists`, `DirectoryExists`, `Stat`, or `Realpath` alone.
 *   Only a rename can change those answers, so neither a content change of the
 *   path (Windows reports a write below a directory as one) nor anything below
 *   it counts. This is what keeps a write under `node_modules`, which the
 *   resolver probes for existence alone, from counting against a generation.
 * - `children`: a directory-qualified listing (`GetAccessibleEntries`). Empty
 *   entry arrays alone do not establish this kind. A rename of a direct child
 *   adds or removes an entry; anything deeper does not.
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
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The variants define the native notification boundary's content, direct-child
 *   and recursive dependencies. Supplied file kind and watch capability govern
 *   classification and admission; event spelling does not prove native identity.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscTrackedInputScope only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscTrackedInputScope only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscTrackedInputScope only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export type TtscTrackedInputScope =
  | "children"
  | "content"
  | "presence"
  | "subtree"
  | "tree";
