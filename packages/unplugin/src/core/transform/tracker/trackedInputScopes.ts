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
 */
export function trackedInputScopes(props: {
  filesystem: TtscTransformFilesystemOperations;
  inputs: readonly string[];
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): Map<string, TtscTrackedInputScope> {
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
    const spelling = path.resolve(input);
    // A plugin's source is proven by its digest, which any file below it can
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
