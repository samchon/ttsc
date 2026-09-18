import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { toProjectKey } from "../project/toProjectKey";
import { createEnvelopeKeyIndex } from "./createEnvelopeKeyIndex";
import { derivationIdentity } from "./derivationIdentity";
import { envelopeDerivation } from "./envelopeDerivation";

/**
 * Extract the absolute, lexical-spelling-deduplicated dependency list for a
 * single file from the compiler result. Mirrors `selectTransformedSource`'s key
 * lookup: fast project-relative match first, then a per-envelope identity
 * index. Distinct lexical aliases must survive so bundlers observe a later
 * symlink or junction retarget. Returns an empty list on exceptions or when the
 * plugin reported nothing.
 */
export function selectFileDependencies(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const dependencies = props.result.dependencies;
  if (dependencies === undefined) {
    return [];
  }
  const state = envelopeDerivation(props);
  const key = toProjectKey(
    props.projectRoot,
    props.file,
    state.identityContext,
  );
  let entries = dependencies[key];
  if (entries === undefined) {
    const index = (state.dependencyIndex ??= createEnvelopeKeyIndex(
      state,
      props.projectRoot,
      dependencies,
    ));
    entries = index.get(derivationIdentity(state, props.file)) as
      | string[]
      | undefined;
  }
  if (!Array.isArray(entries)) {
    return [];
  }
  const output: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, entry);
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    output.push(absolute);
  }
  return output;
}
