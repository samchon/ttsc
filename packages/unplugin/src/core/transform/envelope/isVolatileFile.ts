import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { collectDeclaredIdentities } from "./collectDeclaredIdentities";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Report whether the plugin declared `file` volatile: its output depends on
 * non-file inputs (environment, time, network), so neither the project
 * transform cache nor a bundler's persistent cache may replay it. Reads the
 * per-envelope identity set instead of rescanning the member list.
 *
 * @evidence contracts/common.md#principled-implementation Volatility is explicit producer membership by file identity, not an inference from output contents; an exception result supplies no declaration for this predicate.
 * @evidence contracts/common.md#clear-and-simple-design The predicate reads the declaration while cache and bundler owners enforce their respective replay restrictions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported non-file dependencies are honestly represented by volatility rather than replaced by fixture hashes or a promise that file inputs prove them stable.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains non-file inputs and both replay consequences, along with per-envelope set reuse; separated tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Declaration and queried file share the envelope's native filesystem identity context, so relative/absolute aliases and filesystem case behavior are not hand-normalized.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The set retains only declared physical identities on weakly owned generation state and opens no watcher or file handle; its lifetime ends with that state.
 * @evidence contracts/performance.md#efficient-algorithms One linear declaration fold builds a set; subsequent module queries use keyed membership and memoized path identity instead of repeated whole-list scans.
 * @evidence contracts/performance.md#reuse-equivalent-work The memoized set is valid for the immutable declaration, project root and identity context of one envelope generation; unrelated result objects cannot share it.
 */
export function isVolatileFile(
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): boolean {
  if (props.result.type === "exception") {
    return false;
  }
  const declared = (state.volatileFiles ??= collectDeclaredIdentities(
    state,
    props.projectRoot,
    props.result.volatile,
  ));
  return declared.has(derivationIdentity(state, props.file));
}
