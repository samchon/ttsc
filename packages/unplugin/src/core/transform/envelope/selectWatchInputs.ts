import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { derivationIdentity } from "./derivationIdentity";
import { deriveWatchInputs } from "./deriveWatchInputs";
import { envelopeDerivation } from "./envelopeDerivation";

/**
 * Derive the absolute, deduplicated watch-input list for a single file.
 *
 * By default the derivation unions plugin dependencies, the reachable graph,
 * globals, configs, importer resolver inputs, and universal resolver inputs.
 * The plugin-reported list can only widen the host-owned language-semantic
 * bound, never narrow it. Resolver inputs remain in that bound in both modes.
 *
 * An envelope that lists `file` in `dependenciesComplete` narrows it to
 * `dependencies[file] ∪ configs`: the plugin declared its reported list the
 * complete input set for that file, which transfers responsibility for the
 * dropped `reach(edges, file) ∪ globals` bound to the plugin (see the protocol
 * page's completeness contract). The config chain stays universal regardless,
 * because compiler options reach generated code through the host rather than
 * through any file a plugin could consult. A file the plugin also declared
 * volatile keeps the baseline: the two declarations contradict, so the
 * conservative one wins.
 *
 * The derived list is a pure function of the envelope and the delivered file's
 * normalized lexical spelling. Graph traversal uses its filesystem identity,
 * but lexical inputs exclude only that exact spelling, so two aliases of one
 * source require distinct lists. Repeated deliveries of one spelling replay the
 * per-envelope memo ({@link envelopeDerivation}) instead of re-walking the
 * graph. Returns an empty list on exceptions.
 */
export function selectWatchInputs(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  scratchDirectory?: string;
  temporaryTsconfig?: string;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const state = envelopeDerivation(props);
  const fileIdentity = derivationIdentity(state, props.file);
  const fileSpelling = path.resolve(props.file);
  const memoized = state.watchInputs.get(fileSpelling);
  if (memoized !== undefined) {
    return memoized;
  }
  const derived = deriveWatchInputs(state, props, fileIdentity);
  state.watchInputs.set(fileSpelling, derived);
  return derived;
}
