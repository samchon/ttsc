import fs from "node:fs";

import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Physical identity selected by a host input, or null while it is unresolved. A
 * POSIX target outside UTF-8 returns an opaque byte witness for equality
 * checks.
 *
 * An `lstat` preflight short-circuits missing paths (`ENOENT` or `ENOTDIR`) to
 * `null` without calling `realpath`, since `realpath` cannot succeed for a path
 * that `lstat` reports missing. Any existing entry (including links) or other
 * `lstat` failure proceeds to native `realpath`.
 *
 * @evidence contracts/common.md#principled-implementation An lstat preflight maps ENOENT and ENOTDIR (RuntimeFilesystem.isMissingPathError) directly to null because realpath cannot resolve a missing entry or a path beneath a non-directory; every other case delegates to native realpath and maps any unresolved failure to null so cache comparison never assumes lexical spelling is physical identity.
 * @evidence contracts/common.md#clear-and-simple-design One stateless owner gives all host-input snapshot consumers the same lstat-first absence rule and nullable failure policy, with an optional realpath callback seam for testing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Canonicalization failure stays unresolved, and the default resolver preserves native bytes through RuntimeFilesystem.realpathWitness.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states physical identity, opaque byte witnesses, lstat-first absence and unresolved semantics.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs.lstatSync classifies ENOENT and ENOTDIR. RuntimeFilesystem.realpathWitness handles native path and link semantics, preserving POSIX byte targets and Windows native spelling.
 * @evidence contracts/performance.md#efficient-algorithms Absent candidates stop after one native lstat without a realpath walk or content read; existing entries pay one lstat plus one native realpath, whose path/link resolution work and returned target bytes depend on supplied path and topology rather than a constant-time query count.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fresh target observation is required for cache validity; this function retains no realpath cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous lstat and realpath return a caller-owned string or null and retain no handle or population.
 */
export function realpathHostInput(
  file: string,
  realpath: (file: string) => string = RuntimeFilesystem.realpathWitness,
): string | null {
  try {
    fs.lstatSync(file);
  } catch (error) {
    if (RuntimeFilesystem.isMissingPathError(error)) return null;
  }
  try {
    return realpath(file);
  } catch {
    return null;
  }
}
