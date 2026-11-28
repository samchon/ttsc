import path from "node:path";

import { HostInputObservationPhase } from "./HostInputObservationPhase";

/**
 * The physical target of each host input, keyed by its resolved path; `null`
 * where it does not resolve. A reserved byte witness preserves POSIX paths
 * outside UTF-8. Record physical identity beside the content hashes because
 * retargeting a symlinked input changes what it names without changing any
 * bytes a hash has seen yet.
 *
 * When a caller supplies a {@link HostInputObservationPhase.Phase}, realpath
 * resolution reuses the `lstatSync` and absent-parent observations taken during
 * hashing. A dense batch can share a physical parent and bounded listing for
 * exact leaf spellings. The phase memo ends with that synchronous phase.
 *
 * @evidence contracts/common.md#principled-implementation Each resolved lexical key retains native realpath identity as a path, a reversible POSIX byte witness, or unresolved null, preserving retargeting independently of content.
 * @evidence contracts/common.md#clear-and-simple-design The collection mapper delegates phase-scoped lstat, absent-parent and ancestor-cached physical resolution to HostInputObservationPhase and leaves content hashing and proof acceptance separate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed canonicalization remains null instead of borrowing a recorded target or assuming the lexical path is physical identity; non-symlink leaf names come from directory listings or native realpathSync.native, never from lexical basenames.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains unresolved values, phase-scoped sharing and why realpaths accompany hashes, with prose/tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve and delegated realpath/listing observation support OS-neutral symlink/junction and case-insensitive identity without blanket lowercasing or slash-only parsing.
 * @evidence contracts/performance.md#efficient-algorithms Each path reuses its phase lstat. Positives resolve directly or share a listing bounded by the number of known leaves. Previously proved absences need no native lookup.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work An optional caller-owned phase memo shares lstat, physical-target, ancestor-realpath and listing observations across overlapping checks within one synchronous verification phase and is dropped when that phase ends; without a caller phase, a call-local phase serves only the current call and is dropped on return.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It returns caller-owned observations and retains no cross-call population or resource.
 */
export function realpathHostInputPaths(
  files: readonly string[],
  observed?: Map<string, string | null> | HostInputObservationPhase.Phase,
  observe?: (file: string) => string | null,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (observe !== undefined) {
    const map = HostInputObservationPhase.isPhase(observed)
      ? observed.realpaths
      : observed;
    for (const file of files) {
      const resolved = path.resolve(file);
      if (Object.prototype.hasOwnProperty.call(out, resolved)) continue;
      let target: string | null;
      if (map !== undefined && map.has(resolved)) {
        target = map.get(resolved)!;
      } else {
        target = observe(resolved);
        map?.set(resolved, target);
      }
      out[resolved] = target;
    }
    return out;
  }
  const phase = HostInputObservationPhase.isPhase(observed)
    ? observed
    : HostInputObservationPhase.create();
  const legacyMap = HostInputObservationPhase.isPhase(observed)
    ? undefined
    : observed;
  for (const file of files) {
    const resolved = path.resolve(file);
    if (Object.prototype.hasOwnProperty.call(out, resolved)) continue;
    let target: string | null;
    if (legacyMap !== undefined && legacyMap.has(resolved)) {
      target = legacyMap.get(resolved)!;
    } else {
      target = HostInputObservationPhase.realpath(resolved, phase);
      legacyMap?.set(resolved, target);
    }
    out[resolved] = target;
  }
  return out;
}
