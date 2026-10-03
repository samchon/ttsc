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
 * The derived list uses the envelope, fixed project/options and the generation's
 * observed native identity view, keyed by the delivered file's normalized
 * lexical spelling. Graph traversal uses its filesystem identity,
 * but lexical inputs exclude only that exact spelling, so two aliases of one
 * source require distinct lists. Repeated deliveries of one spelling replay the
 * per-envelope memo ({@link envelopeDerivation}) instead of re-walking the
 * graph. Returns an empty list on exceptions.
 *
 * The returned array is the generation's cached list and must not be mutated.
 * Project root, scratch exclusions and temporary config options must stay fixed
 * for the result object's lifetime, since the memo key includes only module
 * spelling within that generation. The native identity view must remain valid
 * for that generation; this memo does not independently prove current inputs.
 *
 * @evidence contracts/common.md#principled-implementation The final list follows deriveWatchInputs' conservative union and conditional completeness rule; exact lexical module keys keep alias-sensitive exclusions distinct even when graph identity is shared.
 * @evidence contracts/common.md#clear-and-simple-design This entry point owns final-list memoization and delegates input policy and merging to deriveWatchInputs, sharing state through envelopeDerivation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Completeness cannot remove host-owned resolver inputs, and volatility retains the baseline; exceptions produce no fabricated watch list or guessed substitute dependency.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain baseline and narrowed bounds, contradictory declarations, lexical memo keys and exception results with documentation-skill paragraph and tag separation.
 * @evidence contracts/portability.md#os-neutral-implementation Native absolute lexical spellings key alias-sensitive lists, while the envelope context supplies physical identity to graph traversal; these domains remain distinct instead of using manual case or separator normalization.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One array and lexical key per requested module spelling is retained in envelope state, alongside shared indexes and native context observations. List members follow selected generation inputs, but distinct requested spellings and their text have no capacity or byte cap. Weak association does not keep the envelope alive; a borrower retaining returned state or arrays can extend storage lifetime. No watcher handle is opened here.
 * @evidence contracts/performance.md#efficient-algorithms Even a cached list request selects envelope state, queries the delivered path identity and resolves its lexical spelling before the final Map lookup, paying path/key text and any cold native identity observations. A first list additionally derives the dependency/graph/resolver union and deduplication with their visited/selected/index populations; later identical spellings avoid that derivation, not all path work.
 * @evidence contracts/performance.md#reuse-equivalent-work Reuse requires one immutable envelope/root, stable scratch and temporary-config options and a still-valid native identity view. The key is lexical module spelling because different aliases exclude different paths; final lists do not certify current filesystem freshness. Callers must treat the returned cached array as read-only.
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
