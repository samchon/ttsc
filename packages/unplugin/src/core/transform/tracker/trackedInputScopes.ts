import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../envelope/envelopeGraphIndexes";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscTrackedInputScope } from "./TtscTrackedInputScope";
import { trackedInputScope } from "./trackedInputScope";

/**
 * The event scope of every input a generation tracks, keyed by resolved
 * spelling, from the compiler observation recorded for each.
 *
 * `TypeScript-Go` probes `DirectoryExists(<root>/node_modules)` for every
 * package resolution, so this is what keeps a write anywhere under
 * `node_modules` from counting against the generation, while a directory the
 * compiler listed still hears its entries change. A plugin's source directory
 * is a `tree`, whatever the compiler observed of it (samchon/ttsc#1487).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Generation observations determine event scope; plugin source state requires
 *   whole-tree coverage even when a compiler predicate is narrower.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Shared envelope indexes supply observations, the plugin selector supplies
 *   tree authority and trackedInputScope owns fallback classification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A plugin source is selected from the transformation contract rather than
 *   arbitrary directory names; missing graphs retain conservative classification.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain the input-key convention and why observed
 *   presence differs from plugin-tree coverage under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral code resolves spellings with the filesystem view's path grammar and obtains fallback
 *   metadata through the injected filesystem; spelling is not physical identity.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Inputs receive one map insertion each; shared graph indexes and a plugin-root map
 *   avoid rescanning all observations or plugin roots for each input.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   envelopeDerivation and envelopeGraphIndexes reuse generation-owned graph
 *   derivations; each new scope map reflects this call's inputs and filesystem.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The returned map transfers to the tracker constructor; this derivation
 *   retains no independent map or native handle after returning.
 */
export function trackedInputScopes(props: {
  filesystem: TtscTransformFilesystemOperations;
  inputs: readonly string[];
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): Map<string, TtscTrackedInputScope> {
  const paths =
    (props.filesystem.platform ?? process.platform) === "win32"
      ? path.win32
      : path.posix;
  const observations =
    props.result.type === "exception" || props.result.graph === undefined
      ? undefined
      : envelopeGraphIndexes(
          envelopeDerivation({
            projectRoot: props.projectRoot,
            result: props.result,
          }),
          { projectRoot: props.projectRoot, result: props.result },
        ).inputObservations;
  const trees = selectPluginSourceInputs(props.result);
  const scopes = new Map<string, TtscTrackedInputScope>();
  for (const input of props.inputs) {
    const spelling = paths.resolve(input);
    // A plugin's source is proven by its state, which any file below it can
    // move (samchon/ttsc#1487).
    if (trees.has(spelling)) {
      scopes.set(spelling, "tree");
      continue;
    }
    scopes.set(
      spelling,
      trackedInputScope(
        spelling,
        observations?.get(spelling),
        props.filesystem,
      ),
    );
  }
  return scopes;
}
