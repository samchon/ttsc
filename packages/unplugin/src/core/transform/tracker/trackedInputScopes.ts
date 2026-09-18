import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../envelope/envelopeGraphIndexes";
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
 * compiler listed still hears its entries change.
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
  const scopes = new Map<string, TtscTrackedInputScope>();
  for (const input of props.inputs) {
    const spelling = path.resolve(input);
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
