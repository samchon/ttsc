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
 * A failed file predicate supplies no readable-file byte signature. A retained
 * candidate tracker can qualify the narrower unavailable-file comparison only
 * while its native coverage and notification authority remain valid; selection
 * alone does not acquire that permission. Universal absence validation retains
 * its own native candidate probes.
 *
 * Compiler fileExists:false can describe either an absent path or a directory.
 * Without a predicate observation, the fallback requires the host existence
 * probe to fail. The returned candidates are the names whose probes may be
 * replaced; watched also includes their project-local ancestor components so
 * link retargeting cannot leave observers attached only to the old target.
 *
 * A chain that does not reach a captured project root before the
 * filesystem-root stopping condition retains direct probing. More than 512
 * distinct lexical parent locations rejects the whole selection after
 * collection; this limits admitted directory locations, not candidate count,
 * temporary memory or scan work. The tracker owns actual watcher acquisition,
 * notifications and release.
 *
 * @evidence contracts/common.md#principled-implementation Exact failed file predicates select unavailable resolver names, while the lexical ancestor chain witnesses component creation and retargeting; selections outside the root retain direct probes because their chain cannot be covered by project-local watchers.
 * @evidence contracts/common.md#clear-and-simple-design Separate candidate and ancestor sets expose probe-replacement names versus required watcher paths; resource acquisition remains with the tracker instead of occurring during envelope selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The 512-location bound rejects the entire selection so direct validation remains active; it does not return an incomplete watch claim or special-case known candidate names to fit a measurement.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish not-file from missing, candidate versus watched lists, root coverage, the population bound and tracker ownership; acknowledgments are separate under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native dirname/resolve and lexical containment against captured named/physical roots derive ancestor spellings on the host. Path grammar containment is not a certificate of filesystem case or notification coverage; the tracker owns that native admission. Physical identity excludes the temporary input without collapsing alias watcher names, and supplied/result-derived views must remain coherent.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Cold graph construction and the materialized candidate-list array precede
 *   a scan of every candidate occurrence. Path/predicate checks precede seen
 *   rejection; each admitted candidate constructs its parent chain again before
 *   chain deduplication limits appended components. Cost includes path/root
 *   text, chain depth, cold native identity/existence work and two final string
 *   sorts. Candidate, component and directory populations allocate storage
 *   before the 512-directory rejection, so that limit does not bound scan cost.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Seen suppresses repeated candidate admission after predicate/path work;
 *   chain suppresses repeated component output after constructing the chain.
 *   Shared generation parsing and this call's identity context reuse qualified
 *   observations under coherent supplied/result native views. No completed
 *   selection is memoized here across calls.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Temporary collections retain no call history or native handles. Returned
 *   candidate/watched arrays transfer to the caller; directory admission caps
 *   neither candidate-name count nor bytes, and the tracker separately owns
 *   actual subscriptions and release.
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
        // Native lexical path grammar compares both captured root spellings.
        // Its root match selects an ancestor chain, not an independent proof
        // of filesystem case equivalence or healthy notification coverage.
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
    // Decline the whole candidate selection past the lexical directory policy
    // limit. Returning partial names would claim only part of the intended
    // chain; an empty selection leaves direct candidate validation active.
    return empty;
  }
  output.sort();
  watched.sort();
  return { candidates: output, watched };
}

/**
 * Distinct directories the absent-candidate watch may open before it declines.
 *
 * This admission policy declines a larger lexical directory population instead
 * of claiming partial candidate coverage. It does not reserve descriptors or
 * certify the native backend's available capacity.
 *
 * Counted lexically, over the parents of every watched name. A missing subtree
 * collapses onto the one watch its nearest existing ancestor carries, so the
 * count describes requested lexical parent locations, not an exact handle
 * count. Native resolution, coverage and acquisition failures remain tracker
 * responsibilities.
 */
const NOTIFIABLE_ABSENCE_DIRECTORY_LIMIT = 512;
