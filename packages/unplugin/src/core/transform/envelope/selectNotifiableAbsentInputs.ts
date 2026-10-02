import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { relativeToProject } from "../filesystem/relativeToProject";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";
import { envelopeDerivation } from "./envelopeDerivation";
import { envelopeGraphIndexes } from "./envelopeGraphIndexes";

/**
 * The generation's resolution candidates recorded as not files, so its
 * host-input watcher can be told to announce a later file-availability change.
 *
 * A missing candidate is the one input class no proof can be memoized for: its
 * metadata cannot be read, so the signature shortcut that stands in for every
 * other input's comparison never applies, and every delivery that reaches it
 * probes the filesystem again. Watching the name instead turns that repeated
 * probe into one notification for the whole generation, using the same channel
 * and the same failure rules the universal inputs already run under
 * (samchon/ttsc#1261).
 *
 * Compiler fileExists:false can describe either an absent path or a directory.
 * Without a predicate observation, the fallback requires the host existence
 * probe to fail. The returned candidates are the names whose probes may be
 * replaced; watched also includes their project-local ancestor components so
 * link retargeting cannot leave observers attached only to the old target.
 *
 * Outside-project paths and selections requiring more than 512 parent-directory
 * locations retain direct probing. This function selects paths; the tracker
 * owns actual watcher acquisition, notifications and release.
 *
 * @evidence contracts/common.md#principled-implementation Exact failed file predicates select unavailable resolver names, while the lexical ancestor chain witnesses component creation and retargeting; selections outside the root retain direct probes because their chain cannot be covered by project-local watchers.
 * @evidence contracts/common.md#clear-and-simple-design Separate candidate and ancestor sets expose probe-replacement names versus required watcher paths; resource acquisition remains with the tracker instead of occurring during envelope selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The 512-location bound rejects the entire selection so direct validation remains active; it does not return an incomplete watch claim or special-case known candidate names to fit a measurement.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish not-file from missing, candidate versus watched lists, root coverage, the population bound and tracker ownership; acknowledgments are separate under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native dirname/resolve and filesystem-aware root relations derive lexical ancestor chains on the host, preserving symlink and junction retarget sensitivity; physical identity is used only for temporary-input exclusion, not to collapse alias watcher names.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Visits each candidate once and walks its parent chain only up to the
 *   project root; the chain set stops repeats and the directory limit bounds
 *   the result.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The seen and chain sets skip candidates and parent directories already
 *   handled.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Its sets are local to the call and released on return; the directory
 *   limit bounds the returned watch list.
 */
export function selectNotifiableAbsentInputs(props: {
  filesystem: TtscTransformFilesystemOperations;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
  temporaryTsconfig?: string;
}): { candidates: string[]; watched: string[] } {
  const empty = { candidates: [], watched: [] };
  if (props.result.type === "exception") {
    return empty;
  }
  const graph = props.result.graph;
  if (graph === undefined) {
    return empty;
  }
  const identities = createHostPathIdentityContext(props.filesystem);
  const graphState = envelopeDerivation({
    projectRoot: props.projectRoot,
    result: props.result,
  });
  const graphIndexes = envelopeGraphIndexes(graphState, {
    projectRoot: props.projectRoot,
    result: props.result,
  });
  const excluded =
    props.temporaryTsconfig === undefined
      ? undefined
      : pathIdentityKey(props.temporaryTsconfig, identities);
  const output: string[] = [];
  const watched: string[] = [];
  const directories = new Set<string>();
  // Two namespaces, deliberately not one set: candidates are the paths a
  // delivery may stop probing, while the chain holds the directories that carry
  // them. Sharing a set would let one silently answer for the other.
  const seen = new Set<string>();
  const chain = new Set<string>();
  for (const candidates of [
    ...Object.values(graph.candidates ?? {}),
    graph.resolutionInputs ?? [],
  ]) {
    if (!Array.isArray(candidates)) {
      continue;
    }
    for (const candidate of candidates) {
      if (typeof candidate !== "string" || candidate.length === 0) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, candidate);
      const spelling = path.resolve(absolute);
      const observation = graphIndexes.inputObservations.get(spelling);
      const absentAsFile =
        observation?.fileExists === false ||
        (observation === undefined && !props.filesystem.exists(absolute));
      if (
        seen.has(spelling) ||
        isTransformScratchInput(absolute, props.scratchDirectory) ||
        (excluded !== undefined &&
          pathIdentityKey(absolute, identities) === excluded) ||
        !absentAsFile
      ) {
        continue;
      }
      seen.add(spelling);
      // Collect the components of the lexical path, by the name each carries in
      // its own parent. The watcher a missing path opens follows the spelling
      // to a physical directory, so retargeting a link along the way moves the
      // answer without touching what is watched: in a pnpm layout
      // `node_modules/<pkg>` is exactly such a link, and reinstalling it makes
      // a candidate appear behind a watch still looking at the old store
      // directory. Watching `<pkg>` inside `node_modules` is what reports that.
      //
      // The collection stops at the project root, and a spelling that leaves
      // the project subtree before reaching it is not claimed at all. Above
      // that line the components are the machine's own layout rather than the
      // project's, and watching those entries costs a generation whenever an
      // unrelated process touches anything inside them; a candidate whose path
      // runs outside the subtree therefore keeps the probe it always had rather
      // than a proof this cannot complete.
      const components: string[] = [];
      let reachedProject = false;
      for (
        let child = path.dirname(spelling), parent = path.dirname(child);
        parent !== child;
        child = parent, parent = path.dirname(child)
      ) {
        const below = relativeToProject(child, graphState.project);
        if (below !== undefined && below !== "") {
          components.push(child);
          continue;
        }
        // Compared through `path.relative` rather than by string, so a
        // spelling that differs from the root only in case still counts as
        // having arrived where the platform says it has; and against both of
        // the root's spellings, since the compiler names a candidate
        // physically while the project was named through a link.
        reachedProject = below === "";
        break;
      }
      if (!reachedProject) {
        continue;
      }
      output.push(absolute);
      watched.push(absolute);
      for (const component of components) {
        if (chain.has(component)) break;
        chain.add(component);
        watched.push(component);
        directories.add(path.dirname(component));
      }
      directories.add(path.dirname(spelling));
    }
  }
  if (directories.size > NOTIFIABLE_ABSENCE_DIRECTORY_LIMIT) {
    // Past this many distinct directories the watch registration is the more
    // expensive half: a host that runs out of watch descriptors fails the
    // tracker, and a failed tracker sends every delivery to complete-snapshot
    // validation, which re-hashes the whole project. Declining to watch leaves
    // the per-delivery probe in place, which is what this replaces and is far
    // cheaper than that.
    return empty;
  }
  output.sort();
  watched.sort();
  return { candidates: output, watched };
}

/**
 * Distinct directories the absent-candidate watch may open before it declines.
 *
 * Sized well below the inotify per-user default so a project's own walk keeps
 * its share, and far above the distinct `node_modules` package directories a
 * real dependency graph produces.
 *
 * Counted lexically, over the parents of every watched name. A missing subtree
 * collapses onto the one watch its nearest existing ancestor carries, so the
 * count is an upper bound on the watches actually opened rather than their
 * number; the bound stays sound and is merely not tight.
 */
const NOTIFIABLE_ABSENCE_DIRECTORY_LIMIT = 512;
